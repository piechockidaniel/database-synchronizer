"""DuckDB processor for data staging and transformation."""
import logging
from typing import List, Dict, Any

import duckdb

from backend.models.schemas import Mapping

logger = logging.getLogger(__name__)


class DuckDBProcessor:
    """DuckDB processor for in-memory data operations."""
    
    def __init__(self):
        """Initialize DuckDB processor with in-memory database."""
        self.conn = duckdb.connect(':memory:')
        logger.info("Initialized DuckDB in-memory database")
    
    def close(self):
        """Close DuckDB connection."""
        if self.conn:
            self.conn.close()
            logger.info("Closed DuckDB connection")
    
    def create_staging_table(self, table_name: str, columns: Dict[str, str]):
        """Create a staging table in DuckDB.
        
        Args:
            table_name: Name for the staging table
            columns: Dictionary of column names to data types
        """
        try:
            # Drop table if exists
            self.conn.execute(f"DROP TABLE IF EXISTS {table_name}")
            
            # Create table
            column_defs = [f"{name} {dtype}" for name, dtype in columns.items()]
            create_sql = f"CREATE TABLE {table_name} ({', '.join(column_defs)})"
            self.conn.execute(create_sql)
            
            logger.debug(f"Created staging table: {table_name}")
        except Exception as e:
            logger.error(f"Error creating staging table {table_name}: {e}")
            raise
    
    def load_data(self, table_name: str, data: List[Dict[str, Any]]):
        """Load data into a staging table.
        
        Args:
            table_name: Name of the staging table
            data: List of data rows as dictionaries
        """
        try:
            if not data:
                return
            
            # Insert data
            columns = list(data[0].keys())
            placeholders = ', '.join(['?' for _ in columns])
            insert_sql = f"INSERT INTO {table_name} ({', '.join(columns)}) VALUES ({placeholders})"
            
            values = [tuple(row[col] for col in columns) for row in data]
            self.conn.executemany(insert_sql, values)
            
            logger.debug(f"Loaded {len(data)} rows into {table_name}")
        except Exception as e:
            logger.error(f"Error loading data into {table_name}: {e}")
            raise
    
    def transform_data(
        self, 
        source_table: str,
        mapping: Mapping
    ) -> List[Dict[str, Any]]:
        """Transform data according to column mappings.
        
        Args:
            source_table: Name of the source staging table
            mapping: Table mapping configuration
            
        Returns:
            List of transformed data rows
        """
        try:
            # Build SELECT statement with column mappings
            select_columns = []
            for col_mapping in mapping.column_mappings:
                if col_mapping.transformation:
                    # Use transformation expression
                    select_columns.append(
                        f"{col_mapping.transformation} AS {col_mapping.destination_column}"
                    )
                else:
                    # Direct mapping
                    select_columns.append(
                        f"{col_mapping.source_column} AS {col_mapping.destination_column}"
                    )
            
            query = f"SELECT {', '.join(select_columns)} FROM {source_table}"
            result = self.conn.execute(query).fetchall()
            
            # Convert to list of dictionaries
            columns = [col_mapping.destination_column for col_mapping in mapping.column_mappings]
            transformed_data = [dict(zip(columns, row)) for row in result]
            
            logger.debug(f"Transformed {len(transformed_data)} rows")
            return transformed_data
            
        except Exception as e:
            logger.error(f"Error transforming data: {e}")
            raise
    
    @staticmethod
    def generate_insert_sql(
            schema: str,
        table: str,
        data: Dict[str, Any]
    ) -> tuple[str, tuple]:
        """Generate INSERT SQL statement.
        
        Args:
            schema: Destination schema
            table: Destination table
            data: Data row as dictionary
            
        Returns:
            Tuple of (SQL statement, parameters)
        """
        columns = list(data.keys())
        column_str = ', '.join(columns)
        placeholders = ', '.join(['?' for _ in columns])
        
        sql = f"INSERT INTO {schema}.{table} ({column_str}) VALUES ({placeholders})"
        params = tuple(data[col] for col in columns)
        
        return sql, params
    
    @staticmethod
    def generate_update_sql(
            schema: str,
        table: str,
        data: Dict[str, Any],
        primary_keys: List[str]
    ) -> tuple[str, tuple]:
        """Generate UPDATE SQL statement.
        
        Args:
            schema: Destination schema
            table: Destination table
            data: Data row as dictionary
            primary_keys: List of primary key column names
            
        Returns:
            Tuple of (SQL statement, parameters)
        """
        # SET clause columns (exclude primary keys)
        set_columns = [col for col in data.keys() if col not in primary_keys]
        set_clause = ', '.join([f"{col} = ?" for col in set_columns])
        
        # WHERE clause
        where_clause = ' AND '.join([f"{pk} = ?" for pk in primary_keys])
        
        sql = f"UPDATE {schema}.{table} SET {set_clause} WHERE {where_clause}"
        
        # Parameters: set values + primary key values
        params = tuple(data[col] for col in set_columns) + tuple(data[pk] for pk in primary_keys)
        
        return sql, params
    
    @staticmethod
    def generate_delete_sql(
            schema: str,
        table: str,
        data: Dict[str, Any],
        primary_keys: List[str]
    ) -> tuple[str, tuple]:
        """Generate DELETE SQL statement.
        
        Args:
            schema: Destination schema
            table: Destination table
            data: Data row as dictionary (must contain primary key values)
            primary_keys: List of primary key column names
            
        Returns:
            Tuple of (SQL statement, parameters)
        """
        where_clause = ' AND '.join([f"{pk} = ?" for pk in primary_keys])
        sql = f"DELETE FROM {schema}.{table} WHERE {where_clause}"
        params = tuple(data[pk] for pk in primary_keys)
        
        return sql, params
    
    def compare_tables(
        self,
        table1: str,
        table2: str,
        join_columns: List[str]
    ) -> Dict[str, Any]:
        """Compare two tables for data quality verification.
        
        Args:
            table1: First table name
            table2: Second table name
            join_columns: Columns to join on
            
        Returns:
            Dictionary with comparison results
        """
        try:
            # Count rows in each table
            count1 = self.conn.execute(f"SELECT COUNT(*) FROM {table1}").fetchone()[0]
            count2 = self.conn.execute(f"SELECT COUNT(*) FROM {table2}").fetchone()[0]
            
            # Find mismatches
            join_clause = ' AND '.join([f"t1.{col} = t2.{col}" for col in join_columns])
            
            # Rows in table1 but not in table2
            missing_in_t2_query = f"""
                SELECT COUNT(*) FROM {table1} t1
                LEFT JOIN {table2} t2 ON {join_clause}
                WHERE t2.{join_columns[0]} IS NULL
            """
            missing_in_t2 = self.conn.execute(missing_in_t2_query).fetchone()[0]
            
            # Rows in table2 but not in table1
            missing_in_t1_query = f"""
                SELECT COUNT(*) FROM {table2} t2
                LEFT JOIN {table1} t1 ON {join_clause}
                WHERE t1.{join_columns[0]} IS NULL
            """
            missing_in_t1 = self.conn.execute(missing_in_t1_query).fetchone()[0]
            
            return {
                'table1_count': count1,
                'table2_count': count2,
                'missing_in_table2': missing_in_t2,
                'missing_in_table1': missing_in_t1,
                'match': count1 == count2 and missing_in_t2 == 0 and missing_in_t1 == 0
            }
            
        except Exception as e:
            logger.error(f"Error comparing tables: {e}")
            raise
    
    def sample_random_rows(
        self,
        table: str,
        sample_size: int
    ) -> List[Dict[str, Any]]:
        """Get random sample of rows from a table.
        
        Args:
            table: Table name
            sample_size: Number of rows to sample
            
        Returns:
            List of sampled rows
        """
        try:
            query = f"SELECT * FROM {table} ORDER BY RANDOM() LIMIT {sample_size}"
            result = self.conn.execute(query).fetchall()
            
            # Get column names
            columns = [desc[0] for desc in self.conn.description]
            
            # Convert to list of dictionaries
            return [dict(zip(columns, row)) for row in result]
            
        except Exception as e:
            logger.error(f"Error sampling rows: {e}")
            raise
    
    def execute_query(self, query: str) -> List[Dict[str, Any]]:
        """Execute a SQL query and return results.
        
        Args:
            query: SQL query to execute
            
        Returns:
            List of result rows as dictionaries
        """
        try:
            result = self.conn.execute(query).fetchall()
            
            if not self.conn.description:
                return []
            
            columns = [desc[0] for desc in self.conn.description]
            return [dict(zip(columns, row)) for row in result]
            
        except Exception as e:
            logger.error(f"Error executing query: {e}")
            raise
    
    def get_table_info(self, table: str) -> Dict[str, Any]:
        """Get information about a table.
        
        Args:
            table: Table name
            
        Returns:
            Dictionary with table information
        """
        try:
            # Get column information
            query = f"PRAGMA table_info('{table}')"
            result = self.conn.execute(query).fetchall()
            
            columns = []
            for row in result:
                columns.append({
                    'name': row[1],
                    'type': row[2],
                    'nullable': not bool(row[3]),
                    'primary_key': bool(row[5])
                })
            
            # Get row count
            count_query = f"SELECT COUNT(*) FROM {table}"
            row_count = self.conn.execute(count_query).fetchone()[0]
            
            return {
                'table_name': table,
                'columns': columns,
                'row_count': row_count
            }
            
        except Exception as e:
            logger.error(f"Error getting table info: {e}")
            raise


# Global DuckDB processor instance
duckdb_processor = DuckDBProcessor()








