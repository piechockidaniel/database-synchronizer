"""CDC monitoring service with asyncio."""
import asyncio
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from backend.db.mssql_manager import MSSQLConnection
from backend.db.cdc_operations import CDCOperations
from backend.models.schemas import CDCEvent, CDCOperation, Mapping, MappingType
from backend.core.config_manager import config_manager
import uuid

logger = logging.getLogger(__name__)


class CDCMonitor:
    """CDC monitoring service that continuously polls for changes."""
    
    def __init__(self):
        """Initialize CDC monitor."""
        self.is_running = False
        self.is_paused = False
        self.source_connection: Optional[MSSQLConnection] = None
        self.cdc_ops: Optional[CDCOperations] = None
        self.event_queue: asyncio.Queue = asyncio.Queue()
        self.poll_interval = 5  # seconds
        self.monitor_task: Optional[asyncio.Task] = None
        self.active_mappings: List[Mapping] = []
        self.lsn_state: Dict[str, Optional[bytes]] = {}
    
    def set_connection(self, connection: MSSQLConnection):
        """Set source database connection.
        
        Args:
            connection: MSSQL connection
        """
        self.source_connection = connection
        self.cdc_ops = CDCOperations(connection)
        logger.info("CDC monitor connection set")
    
    def set_mappings(self, mappings: List[Mapping]):
        """Set active table mappings to monitor.
        
        Args:
            mappings: List of unified mappings (only TABLE type will be monitored)
        """
        # Filter to only TABLE type mappings and enabled ones
        self.active_mappings = [
            m for m in mappings 
            if m.mapping_type == MappingType.TABLE and m.enabled
        ]
        logger.info(f"CDC monitor tracking {len(self.active_mappings)} table mappings")
    
    @staticmethod
    def _get_operation_type(operation_code: int) -> CDCOperation:
        """Convert CDC operation code to CDCOperation enum.
        
        Args:
            operation_code: CDC operation code (1=delete, 2=insert, 3=before update, 4=after update)
            
        Returns:
            CDCOperation enum value
        """
        if operation_code == 1:
            return CDCOperation.DELETE
        elif operation_code == 2:
            return CDCOperation.INSERT
        elif operation_code in (3, 4):
            return CDCOperation.UPDATE
        else:
            return CDCOperation.INSERT
    
    def _load_lsn_state(self):
        """Load last processed LSN for each table from configuration."""
        for mapping in self.active_mappings:
            table_key = f"{mapping.source_schema}.{mapping.source_table}"
            last_lsn_hex = config_manager.get_last_lsn(table_key)
            
            if last_lsn_hex:
                # Convert hex string back to bytes
                try:
                    self.lsn_state[table_key] = bytes.fromhex(last_lsn_hex)
                    logger.info(f"Loaded LSN state for {table_key}: {last_lsn_hex}")
                except Exception as e:
                    logger.error(f"Error loading LSN state for {table_key}: {e}")
                    self.lsn_state[table_key] = None
            else:
                self.lsn_state[table_key] = None
    
    def _save_lsn_state(self, table_key: str, lsn: bytes):
        """Save last processed LSN for a table.
        
        Args:
            table_key: Table identifier
            lsn: LSN as bytes
        """
        try:
            # Convert bytes to hex string for storage
            lsn_hex = lsn.hex() if lsn else None
            if lsn_hex:
                config_manager.set_last_lsn(table_key, lsn_hex)
                self.lsn_state[table_key] = lsn
        except Exception as e:
            logger.error(f"Error saving LSN state for {table_key}: {e}")
    
    async def _poll_table_changes(self, mapping: Mapping):
        """Poll CDC changes for a specific table.
        
        Args:
            mapping: Unified mapping (must be TABLE type)
        """
        # Ensure this is a TABLE type mapping
        if mapping.mapping_type != MappingType.TABLE:
            logger.warning(f"Skipping non-TABLE mapping {mapping.id} in CDC monitor")
            return
        
        try:
            table_key = f"{mapping.source_schema}.{mapping.source_table}"
            capture_instance = f"{mapping.source_schema}_{mapping.source_table}"
            
            # Get LSN bounds
            from_lsn = self.lsn_state.get(table_key)
            if from_lsn is None:
                # Get minimum LSN for this table
                from_lsn = self.cdc_ops.get_min_lsn(capture_instance)
                if from_lsn is None:
                    logger.warning(f"No LSN available for {table_key}")
                    return
            
            # Get maximum LSN
            to_lsn = self.cdc_ops.get_max_lsn()
            if to_lsn is None or to_lsn <= from_lsn:
                return  # No new changes
            
            # Get changes
            changes = self.cdc_ops.get_cdc_changes(
                mapping.source_schema,
                mapping.source_table,
                from_lsn,
                to_lsn,
                "all"
            )
            
            if changes:
                logger.info(f"Found {len(changes)} CDC changes for {table_key}")
                
                # Process each change
                for change in changes:
                    # Determine operation type
                    operation_code = change.get('__$operation', 2)
                    operation = self._get_operation_type(operation_code)
                    
                    # Extract data (exclude CDC metadata columns)
                    data = {
                        k: v for k, v in change.items()
                        if not k.startswith('__$')
                    }
                    
                    # Create CDC event
                    event = CDCEvent(
                        id=str(uuid.uuid4()),
                        timestamp=datetime.now(),
                        source_table=table_key,
                        operation=operation,
                        lsn=change['__$start_lsn'].hex() if '__$start_lsn' in change else '',
                        seqval=change['__$seqval'].hex() if '__$seqval' in change else '',
                        data=data,
                        status="pending"
                    )
                    
                    # Add to queue
                    await self.event_queue.put((mapping, event))
                
                # Update LSN state
                self._save_lsn_state(table_key, to_lsn)
                
        except Exception as e:
            logger.error(f"Error polling changes for {mapping.source_schema}.{mapping.source_table}: {e}")
    
    async def _monitor_loop(self):
        """Main monitoring loop."""
        logger.info("CDC monitor loop started")
        
        # Load LSN state
        self._load_lsn_state()
        
        while self.is_running:
            try:
                if not self.is_paused:
                    # Poll each active mapping
                    for mapping in self.active_mappings:
                        if not self.is_running:
                            break
                        await self._poll_table_changes(mapping)
                
                # Wait before next poll
                await asyncio.sleep(self.poll_interval)
                
            except Exception as e:
                logger.error(f"Error in monitor loop: {e}")
                await asyncio.sleep(self.poll_interval)
        
        logger.info("CDC monitor loop stopped")
    
    async def start(self):
        """Start CDC monitoring."""
        if self.is_running:
            logger.warning("CDC monitor is already running")
            return
        
        if not self.source_connection:
            raise Exception("Source connection not set")
        
        if not self.active_mappings:
            raise Exception("No active mappings configured")
        
        # Ensure connection is active
        if not self.source_connection.is_connected():
            self.source_connection.connect()
        
        # Verify CDC is enabled
        if not self.cdc_ops.is_cdc_enabled_on_database():
            raise Exception("CDC is not enabled on source database")
        
        self.is_running = True
        self.is_paused = False
        
        # Start monitoring task
        self.monitor_task = asyncio.create_task(self._monitor_loop())
        
        logger.info("CDC monitor started")
    
    async def stop(self):
        """Stop CDC monitoring."""
        if not self.is_running:
            logger.warning("CDC monitor is not running")
            return
        
        logger.info("Stopping CDC monitor...")
        self.is_running = False
        
        # Wait for monitor task to complete
        if self.monitor_task:
            try:
                await asyncio.wait_for(self.monitor_task, timeout=10.0)
            except asyncio.TimeoutError:
                logger.warning("Monitor task did not stop gracefully, cancelling...")
                self.monitor_task.cancel()
        
        logger.info("CDC monitor stopped")
    
    def pause(self):
        """Pause CDC monitoring."""
        if not self.is_running:
            logger.warning("CDC monitor is not running")
            return
        
        self.is_paused = True
        logger.info("CDC monitor paused")
    
    def resume(self):
        """Resume CDC monitoring."""
        if not self.is_running:
            logger.warning("CDC monitor is not running")
            return
        
        self.is_paused = False
        logger.info("CDC monitor resumed")
    
    def get_event_queue(self) -> asyncio.Queue:
        """Get the event queue for processing.
        
        Returns:
            Event queue
        """
        return self.event_queue
    
    def get_status(self) -> Dict[str, Any]:
        """Get current monitor status.
        
        Returns:
            Status dictionary
        """
        return {
            'is_running': self.is_running,
            'is_paused': self.is_paused,
            'active_mappings': len(self.active_mappings),
            'poll_interval': self.poll_interval,
            'queue_size': self.event_queue.qsize()
        }


# Global CDC monitor instance
cdc_monitor = CDCMonitor()








