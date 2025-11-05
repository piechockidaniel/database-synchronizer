"""Synchronization engine that applies CDC changes to destination."""
import asyncio
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from backend.db.mssql_manager import MSSQLConnection
from backend.models.schemas import CDCEvent, CDCOperation, TableMapping
from backend.core.duckdb_processor import DuckDBProcessor
from backend.core.cdc_monitor import cdc_monitor

logger = logging.getLogger(__name__)


class SyncEngine:
    """Synchronization engine for real-time data replication."""
    
    def __init__(self):
        """Initialize sync engine."""
        self.is_running = False
        self.destination_connection: Optional[MSSQLConnection] = None
        self.duckdb: Optional[DuckDBProcessor] = None
        self.sync_task: Optional[asyncio.Task] = None
        self.batch_size = 100
        self.events_processed = 0
        self.errors_count = 0
        self.start_time: Optional[datetime] = None
        self.last_event_time: Optional[datetime] = None
        self.event_listeners: List[callable] = []
    
    def set_destination_connection(self, connection: MSSQLConnection):
        """Set destination database connection.
        
        Args:
            connection: MSSQL connection
        """
        self.destination_connection = connection
        logger.info("Sync engine destination connection set")
    
    def set_duckdb_processor(self, processor: DuckDBProcessor):
        """Set DuckDB processor.
        
        Args:
            processor: DuckDB processor instance
        """
        self.duckdb = processor
        logger.info("Sync engine DuckDB processor set")
    
    def add_event_listener(self, listener: callable):
        """Add event listener for sync events.
        
        Args:
            listener: Callable that accepts (event, status, error) parameters
        """
        self.event_listeners.append(listener)
    
    async def _notify_listeners(self, event: CDCEvent, status: str, error: Optional[str] = None):
        """Notify event listeners.
        
        Args:
            event: CDC event
            status: Event status (processed, failed)
            error: Error message if failed
        """
        for listener in self.event_listeners:
            try:
                if asyncio.iscoroutinefunction(listener):
                    await listener(event, status, error)
                else:
                    listener(event, status, error)
            except Exception as e:
                logger.error(f"Error notifying listener: {e}")
    
    @staticmethod
    def _get_primary_key_columns(mapping: TableMapping) -> List[str]:
        """Get primary key columns from mapping.
        
        For now, we'll try to identify likely primary keys from the column mappings.
        In a production system, this should query the destination table schema.
        
        Args:
            mapping: Table mapping
            
        Returns:
            List of primary key destination column names
        """
        # Simple heuristic: columns containing 'id' are likely primary keys
        pk_columns = [
            cm.destination_column 
            for cm in mapping.column_mappings 
            if 'id' in cm.destination_column.lower()
        ]
        
        if not pk_columns:
            # If no obvious PKs, use first column
            pk_columns = [mapping.column_mappings[0].destination_column] if mapping.column_mappings else []
        
        return pk_columns
    
    async def _apply_change(self, mapping: TableMapping, event: CDCEvent) -> tuple[bool, Optional[str]]:
        """Apply a single CDC change to destination.
        
        Args:
            mapping: Table mapping
            event: CDC event
            
        Returns:
            Tuple of (success, error_message)
        """
        try:
            # Create staging table in DuckDB
            staging_table = f"staging_{mapping.source_schema}_{mapping.source_table}"
            
            # Prepare column types (simplified - using VARCHAR for all)
            columns = {cm.source_column: 'VARCHAR' for cm in mapping.column_mappings}
            self.duckdb.create_staging_table(staging_table, columns)
            
            # Load event data into staging
            self.duckdb.load_data(staging_table, [event.data])
            
            # Transform data according to mapping
            transformed_data = self.duckdb.transform_data(staging_table, mapping)
            
            if not transformed_data:
                return False, "No data to sync after transformation"
            
            transformed_row = transformed_data[0]
            
            # Generate and execute SQL based on operation type
            if event.operation == CDCOperation.INSERT and mapping.sync_inserts:
                sql, params = self.duckdb.generate_insert_sql(
                    mapping.destination_schema,
                    mapping.destination_table,
                    transformed_row
                )
                self.destination_connection.execute_non_query(sql, params)
                
            elif event.operation == CDCOperation.UPDATE and mapping.sync_updates:
                pk_columns = self._get_primary_key_columns(mapping)
                sql, params = self.duckdb.generate_update_sql(
                    mapping.destination_schema,
                    mapping.destination_table,
                    transformed_row,
                    pk_columns
                )
                self.destination_connection.execute_non_query(sql, params)
                
            elif event.operation == CDCOperation.DELETE and mapping.sync_deletes:
                pk_columns = self._get_primary_key_columns(mapping)
                sql, params = self.duckdb.generate_delete_sql(
                    mapping.destination_schema,
                    mapping.destination_table,
                    transformed_row,
                    pk_columns
                )
                self.destination_connection.execute_non_query(sql, params)
            
            else:
                # Operation type not enabled for sync
                return True, f"Skipped {event.operation.value} (disabled in mapping)"
            
            return True, None
            
        except Exception as e:
            error_msg = f"Error applying change: {str(e)}"
            logger.error(error_msg)
            return False, error_msg
    
    async def _sync_loop(self):
        """Main synchronization loop."""
        logger.info("Sync engine loop started")
        
        event_queue = cdc_monitor.get_event_queue()
        
        while self.is_running:
            try:
                # Get event from queue with timeout
                try:
                    mapping, event = await asyncio.wait_for(
                        event_queue.get(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                # Apply change to destination
                success, error = await self._apply_change(mapping, event)
                
                if success:
                    event.status = "processed"
                    self.events_processed += 1
                    logger.debug(f"Processed event {event.id}: {event.operation.value} on {event.source_table}")
                else:
                    event.status = "failed"
                    event.error = error
                    self.errors_count += 1
                    logger.error(f"Failed to process event {event.id}: {error}")
                
                self.last_event_time = datetime.now()
                
                # Notify listeners
                await self._notify_listeners(event, event.status, event.error)
                
            except Exception as e:
                logger.error(f"Error in sync loop: {e}")
                await asyncio.sleep(1.0)
        
        logger.info("Sync engine loop stopped")
    
    async def start(self):
        """Start synchronization engine."""
        if self.is_running:
            logger.warning("Sync engine is already running")
            return
        
        if not self.destination_connection:
            raise Exception("Destination connection not set")
        
        if not self.duckdb:
            raise Exception("DuckDB processor not set")
        
        # Ensure connection is active
        if not self.destination_connection.is_connected():
            self.destination_connection.connect()
        
        self.is_running = True
        self.events_processed = 0
        self.errors_count = 0
        self.start_time = datetime.now()
        
        # Start sync task
        self.sync_task = asyncio.create_task(self._sync_loop())
        
        logger.info("Sync engine started")
    
    async def stop(self):
        """Stop synchronization engine."""
        if not self.is_running:
            logger.warning("Sync engine is not running")
            return
        
        logger.info("Stopping sync engine...")
        self.is_running = False
        
        # Wait for sync task to complete
        if self.sync_task:
            try:
                await asyncio.wait_for(self.sync_task, timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning("Sync task did not stop gracefully, cancelling...")
                self.sync_task.cancel()
        
        logger.info("Sync engine stopped")
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get synchronization statistics.
        
        Returns:
            Statistics dictionary
        """
        uptime = (datetime.now() - self.start_time).total_seconds() if self.start_time else 0
        events_per_second = self.events_processed / uptime if uptime > 0 else 0
        
        return {
            'total_events': self.events_processed + self.errors_count,
            'successful_events': self.events_processed,
            'failed_events': self.errors_count,
            'events_per_second': round(events_per_second, 2),
            'uptime_seconds': round(uptime, 2),
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'last_event_time': self.last_event_time.isoformat() if self.last_event_time else None
        }


# Global sync engine instance
sync_engine = SyncEngine()





