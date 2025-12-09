"""Latency monitoring service for tracking sync delays."""
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from backend.db.mssql_manager import MSSQLConnection
from backend.models.schemas import CDCEvent, Mapping, CDCOperation

logger = logging.getLogger(__name__)


class LatencyMonitor:
    """Monitor latency between source changes and destination updates."""
    
    def __init__(self):
        """Initialize latency monitor."""
        self.metrics_table_schema = "dbo"
        self.metrics_table_name = "sync_latency_metrics"
        self._table_created = False
    
    def ensure_metrics_table(self, connection: MSSQLConnection):
        """Ensure the latency metrics table exists.
        
        Args:
            connection: Database connection
        """
        if self._table_created:
            return
        
        try:
            # Check if table exists
            check_query = """
                SELECT COUNT(*) as cnt
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            """
            result = connection.execute_query(check_query, (self.metrics_table_schema, self.metrics_table_name))
            
            if result and result[0]['cnt'] > 0:
                self._table_created = True
                logger.debug("Latency metrics table already exists")
                return
            
            # Create table
            create_query = f"""
                CREATE TABLE [{self.metrics_table_schema}].[{self.metrics_table_name}] (
                    id BIGINT IDENTITY(1,1) PRIMARY KEY,
                    mapping_id NVARCHAR(255) NOT NULL,
                    source_table NVARCHAR(255) NOT NULL,
                    destination_table NVARCHAR(255) NOT NULL,
                    source_record_id NVARCHAR(500) NULL,
                    operation_type NVARCHAR(20) NOT NULL,
                    source_change_time DATETIME2 NULL,
                    destination_insert_time DATETIME2 NOT NULL DEFAULT GETDATE(),
                    latency_ms BIGINT NULL,
                    event_id NVARCHAR(255) NULL,
                    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
                    INDEX IX_latency_mapping (mapping_id),
                    INDEX IX_latency_source_change_time (source_change_time),
                    INDEX IX_latency_destination_insert_time (destination_insert_time)
                )
            """
            
            connection.execute_non_query(create_query)
            self._table_created = True
            logger.info(f"Created latency metrics table: {self.metrics_table_schema}.{self.metrics_table_name}")
            
        except Exception as e:
            logger.error(f"Error creating latency metrics table: {e}")
            # Don't raise - latency tracking is optional
    
    def record_latency(
        self,
        connection: MSSQLConnection,
        mapping: Mapping,
        event: CDCEvent,
        source_change_time: Optional[datetime] = None,
        source_record_id: Optional[str] = None
    ):
        """Record latency metric for a sync operation.
        
        Args:
            connection: Destination database connection
            mapping: Table mapping
            event: CDC event
            source_change_time: Original timestamp from source table
            source_record_id: Identifier for the source record (e.g., primary key value)
        """
        try:
            # Ensure table exists
            self.ensure_metrics_table(connection)
            
            # Use event timestamp as fallback if source_change_time not provided
            if not source_change_time:
                source_change_time = event.timestamp
            
            # Calculate latency
            destination_time = datetime.now()
            latency_ms = None
            if source_change_time:
                latency_ms = int((destination_time - source_change_time).total_seconds() * 1000)
            
            # Build source_record_id from event data if not provided
            if not source_record_id and event.data:
                # Try to find primary key columns
                pk_candidates = [k for k in event.data.keys() if 'id' in k.lower()]
                if pk_candidates:
                    source_record_id = str(event.data[pk_candidates[0]])
                else:
                    # Use first column value as identifier
                    first_key = list(event.data.keys())[0] if event.data else None
                    source_record_id = str(event.data[first_key]) if first_key else None
            
            # Insert latency record
            insert_query = f"""
                INSERT INTO [{self.metrics_table_schema}].[{self.metrics_table_name}]
                (mapping_id, source_table, destination_table, source_record_id, operation_type,
                 source_change_time, destination_insert_time, latency_ms, event_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            params = (
                mapping.id,
                f"{mapping.source_schema}.{mapping.source_table}",
                f"{mapping.destination_schema}.{mapping.destination_table}",
                source_record_id,
                event.operation.value,
                source_change_time,
                destination_time,
                latency_ms,
                event.id
            )
            
            connection.execute_non_query(insert_query, params)
            
        except Exception as e:
            # Don't fail sync if latency tracking fails
            logger.warning(f"Error recording latency metric: {e}")
    
    def get_latency_statistics(
        self,
        connection: MSSQLConnection,
        mapping_id: Optional[str] = None,
        hours: int = 24
    ) -> Dict[str, Any]:
        """Get latency statistics.
        
        Args:
            connection: Database connection
            mapping_id: Optional mapping ID to filter by
            hours: Number of hours to look back
            
        Returns:
            Dictionary with latency statistics
        """
        try:
            self.ensure_metrics_table(connection)
            
            where_clause = "WHERE destination_insert_time >= DATEADD(HOUR, -?, GETDATE())"
            params = [hours]
            
            if mapping_id:
                where_clause += " AND mapping_id = ?"
                params.append(mapping_id)
            
            # SQL Server compatible percentile calculation
            query = f"""
                SELECT 
                    COUNT(*) as total_records,
                    AVG(CAST(latency_ms AS FLOAT)) as avg_latency_ms,
                    MIN(latency_ms) as min_latency_ms,
                    MAX(latency_ms) as max_latency_ms,
                    COUNT(DISTINCT mapping_id) as mapping_count
                FROM [{self.metrics_table_schema}].[{self.metrics_table_name}]
                {where_clause}
            """
            
            # Get percentiles separately (SQL Server 2012+)
            percentile_query = f"""
                SELECT 
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) OVER () as median_latency_ms,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) OVER () as p95_latency_ms,
                    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) OVER () as p99_latency_ms
                FROM [{self.metrics_table_schema}].[{self.metrics_table_name}]
                {where_clause}
            """
            
            result = connection.execute_query(query, tuple(params))
            
            # Try to get percentiles (may fail on older SQL Server versions)
            median_latency = 0
            p95_latency = 0
            p99_latency = 0
            try:
                percentile_result = connection.execute_query(percentile_query, tuple(params))
                if percentile_result:
                    median_latency = round(float(percentile_result[0].get('median_latency_ms') or 0), 2)
                    p95_latency = round(float(percentile_result[0].get('p95_latency_ms') or 0), 2)
                    p99_latency = round(float(percentile_result[0].get('p99_latency_ms') or 0), 2)
            except Exception as e:
                logger.warning(f"Could not calculate percentiles (SQL Server version may not support): {e}")
                # Calculate approximate percentiles using simple method
                if result and result[0].get('total_records', 0) > 0:
                    # Fallback: use average as median approximation
                    median_latency = round(float(result[0].get('avg_latency_ms') or 0), 2)
                    p95_latency = median_latency * 1.5  # Rough approximation
                    p99_latency = median_latency * 2.0  # Rough approximation
            
            if result:
                stats = result[0]
                return {
                    'total_records': stats.get('total_records', 0),
                    'avg_latency_ms': round(float(stats.get('avg_latency_ms') or 0), 2),
                    'min_latency_ms': stats.get('min_latency_ms'),
                    'max_latency_ms': stats.get('max_latency_ms'),
                    'median_latency_ms': median_latency,
                    'p95_latency_ms': p95_latency,
                    'p99_latency_ms': p99_latency,
                    'mapping_count': stats.get('mapping_count', 0),
                    'hours': hours
                }
            
            return {
                'total_records': 0,
                'avg_latency_ms': 0,
                'min_latency_ms': None,
                'max_latency_ms': None,
                'median_latency_ms': 0,
                'p95_latency_ms': 0,
                'p99_latency_ms': 0,
                'mapping_count': 0,
                'hours': hours
            }
            
        except Exception as e:
            logger.error(f"Error getting latency statistics: {e}")
            return {
                'error': str(e),
                'total_records': 0
            }
    
    def get_recent_latency_records(
        self,
        connection: MSSQLConnection,
        mapping_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get recent latency records.
        
        Args:
            connection: Database connection
            mapping_id: Optional mapping ID to filter by
            limit: Maximum number of records to return
            
        Returns:
            List of latency records
        """
        try:
            self.ensure_metrics_table(connection)
            
            where_clause = ""
            params = []
            
            if mapping_id:
                where_clause = "WHERE mapping_id = ?"
                params.append(mapping_id)
            
            query = f"""
                SELECT TOP (?)
                    id,
                    mapping_id,
                    source_table,
                    destination_table,
                    source_record_id,
                    operation_type,
                    source_change_time,
                    destination_insert_time,
                    latency_ms,
                    event_id,
                    created_at
                FROM [{self.metrics_table_schema}].[{self.metrics_table_name}]
                {where_clause}
                ORDER BY destination_insert_time DESC
            """
            
            params.insert(0, limit)
            return connection.execute_query(query, tuple(params))
            
        except Exception as e:
            logger.error(f"Error getting recent latency records: {e}")
            return []


# Global latency monitor instance
latency_monitor = LatencyMonitor()

