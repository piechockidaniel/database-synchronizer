"""Initial snapshot service for synchronizing existing data before CDC monitoring."""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from backend.db.mssql_manager import MSSQLConnection
from backend.models.schemas import Mapping, MappingType
from backend.core.duckdb_processor import DuckDBProcessor

logger = logging.getLogger(__name__)


class SnapshotService:
    """Service for performing initial data snapshots."""
    
    def __init__(self):
        """Initialize snapshot service."""
        self.batch_size = 10000  # Process 10k rows at a time for large datasets
    
    def perform_snapshot(
        self,
        mapping: Mapping,
        source_connection: MSSQLConnection,
        destination_connection: MSSQLConnection,
        duckdb: DuckDBProcessor
    ) -> tuple[bool, str, int]:
        """Perform initial snapshot of source table to destination.
        
        Args:
            mapping: Unified mapping (must be TABLE type)
            source_connection: Source database connection
            destination_connection: Destination database connection
            duckdb: DuckDB processor for transformations
            
        Returns:
            Tuple of (success, message, rows_processed)
        """
        # Validate mapping type
        if mapping.mapping_type != MappingType.TABLE:
            return False, f"Snapshot only supported for TABLE mappings (got {mapping.mapping_type})", 0
        
        try:
            logger.info(f"Starting snapshot for {mapping.source_schema}.{mapping.source_table} -> "
                       f"{mapping.destination_schema}.{mapping.destination_table}")
            
            # Check if snapshot already completed
            if mapping.snapshot_completed_at:
                logger.info(f"Snapshot already completed at {mapping.snapshot_completed_at}. Skipping.")
                return True, f"Snapshot already completed at {mapping.snapshot_completed_at}", 0
            
            # Ensure connections are active
            if not source_connection.is_connected():
                source_connection.connect()
            if not destination_connection.is_connected():
                destination_connection.connect()
            
            # Step 1: Truncate destination table
            logger.info(f"Truncating destination table {mapping.destination_schema}.{mapping.destination_table}")
            truncate_sql = f"TRUNCATE TABLE {mapping.destination_schema}.{mapping.destination_table}"
            try:
                destination_connection.execute_non_query(truncate_sql)
                logger.info("Destination table truncated successfully")
            except Exception as e:
                logger.warning(f"Could not truncate table (might not exist or have constraints): {e}")
                # Try DELETE instead
                delete_sql = f"DELETE FROM {mapping.destination_schema}.{mapping.destination_table}"
                destination_connection.execute_non_query(delete_sql)
                logger.info("Destination table cleared using DELETE")
            
            # Step 2: Get source columns to read
            source_columns = self._get_source_columns(mapping)
            if not source_columns:
                return False, "No source columns found in mapping", 0
            
            # Step 3: Build SELECT query with potential timestamp column for latency tracking
            # Try to find a timestamp column (CreatedDate, CreatedAt, ModifiedDate, etc.)
            timestamp_column = self._find_timestamp_column(source_connection, mapping.source_schema, mapping.source_table)
            
            select_columns = source_columns.copy()
            if timestamp_column and timestamp_column not in select_columns:
                select_columns.append(timestamp_column)
            
            column_list = ', '.join([f"[{col}]" for col in select_columns])
            source_query = f"SELECT {column_list} FROM [{mapping.source_schema}].[{mapping.source_table}]"
            
            # Step 4: Read and process data in batches
            total_rows = 0
            batch_count = 0
            
            logger.info(f"Reading source data in batches of {self.batch_size} rows...")
            
            # Get total row count for progress tracking
            count_query = f"SELECT COUNT(*) as cnt FROM [{mapping.source_schema}].[{mapping.source_table}]"
            count_result = source_connection.execute_query(count_query)
            total_source_rows = count_result[0]['cnt'] if count_result else 0
            logger.info(f"Total source rows to process: {total_source_rows:,}")
            
            # Process in batches using cursor
            with source_connection.get_cursor() as cursor:
                cursor.execute(source_query)
                
                while True:
                    # Fetch batch
                    rows = cursor.fetchmany(self.batch_size)
                    if not rows:
                        break
                    
                    # Convert to list of dictionaries
                    batch_data = []
                    for row in rows:
                        row_dict = dict(zip(select_columns, row))
                        batch_data.append(row_dict)
                    
                    # Transform batch using DuckDB
                    transformed_batch = self._transform_batch(batch_data, mapping, duckdb, timestamp_column)
                    
                    # Bulk insert transformed batch
                    if transformed_batch:
                        rows_inserted = destination_connection.bulk_insert(
                            mapping.destination_schema,
                            mapping.destination_table,
                            transformed_batch
                        )
                        total_rows += rows_inserted
                        batch_count += 1
                        
                        if batch_count % 10 == 0:
                            logger.info(f"Processed {total_rows:,} / {total_source_rows:,} rows "
                                      f"({batch_count} batches)")
            
            logger.info(f"Snapshot completed successfully. Processed {total_rows:,} rows in {batch_count} batches")
            
            return True, f"Snapshot completed successfully. Processed {total_rows:,} rows", total_rows
            
        except Exception as e:
            error_msg = f"Error performing snapshot: {str(e)}"
            logger.error(error_msg)
            return False, error_msg, 0
    
    def _get_source_columns(self, mapping: TableMapping) -> List[str]:
        """Extract source column names from mapping.
        
        Args:
            mapping: Table mapping
            
        Returns:
            List of unique source column names
        """
        source_columns = set()
        
        for col_mapping in mapping.column_mappings:
            if col_mapping.source_column:
                source_columns.add(col_mapping.source_column)
            if col_mapping.source_columns:
                source_columns.update(col_mapping.source_columns)
        
        return list(source_columns)
    
    def _find_timestamp_column(
        self,
        connection: MSSQLConnection,
        schema: str,
        table: str
    ) -> Optional[str]:
        """Find a timestamp/date column in source table for latency tracking.
        
        Args:
            connection: Database connection
            schema: Schema name
            table: Table name
            
        Returns:
            Column name or None
        """
        try:
            # Common timestamp column names
            timestamp_patterns = [
                'CreatedDate', 'CreatedAt', 'CreateDate', 'CreateTime',
                'ModifiedDate', 'ModifiedAt', 'UpdateDate', 'UpdateTime',
                'Timestamp', 'ChangeDate', 'LastModified'
            ]
            
            columns = connection.get_columns(schema, table)
            
            # First, try exact matches (case-insensitive)
            for col in columns:
                if col.column_name in timestamp_patterns:
                    if col.data_type.lower() in ['datetime', 'datetime2', 'timestamp', 'date']:
                        return col.column_name
            
            # Then try pattern matching
            for col in columns:
                col_lower = col.column_name.lower()
                if col.data_type.lower() in ['datetime', 'datetime2', 'timestamp', 'date']:
                    if any(pattern.lower() in col_lower for pattern in timestamp_patterns):
                        return col.column_name
            
            # Last resort: find any datetime column
            for col in columns:
                if col.data_type.lower() in ['datetime', 'datetime2', 'timestamp']:
                    return col.column_name
            
            return None
            
        except Exception as e:
            logger.warning(f"Could not find timestamp column: {e}")
            return None
    
    def _transform_batch(
        self,
        batch_data: List[Dict[str, Any]],
        mapping: TableMapping,
        duckdb: DuckDBProcessor,
        timestamp_column: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Transform a batch of data using DuckDB.
        
        Args:
            batch_data: Source data batch
            mapping: Table mapping
            duckdb: DuckDB processor
            timestamp_column: Optional timestamp column for latency tracking
            
        Returns:
            Transformed data batch
        """
        if not batch_data:
            return []
        
        try:
            # Create staging table
            staging_table = f"snapshot_staging_{mapping.source_schema}_{mapping.source_table}"
            
            # Determine column types (simplified - using VARCHAR for most, detect dates)
            columns = {}
            for col_name in batch_data[0].keys():
                # Check if it's a datetime column
                sample_value = batch_data[0].get(col_name)
                if isinstance(sample_value, datetime):
                    columns[col_name] = 'TIMESTAMP'
                elif isinstance(sample_value, (int, float)):
                    columns[col_name] = 'DOUBLE'
                else:
                    columns[col_name] = 'VARCHAR'
            
            duckdb.create_staging_table(staging_table, columns)
            duckdb.load_data(staging_table, batch_data)
            
            # Transform according to mapping
            transformed_data = duckdb.transform_data(staging_table, mapping)
            
            # Add timestamp column to transformed data if available
            if timestamp_column and transformed_data:
                for i, row in enumerate(transformed_data):
                    # Try to preserve timestamp from original data
                    # This is a simplified approach - in production, you'd need to map it properly
                    pass
            
            return transformed_data
            
        except Exception as e:
            logger.error(f"Error transforming batch: {e}")
            raise


# Global snapshot service instance
snapshot_service = SnapshotService()

