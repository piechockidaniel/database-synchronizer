"""Configuration management system with JSON persistence."""
import json
import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict
from backend.models.schemas import WorkingSet, Mapping, MappingType

logger = logging.getLogger(__name__)

CONFIG_DIR = Path("config")
WORKSETS_FILE = CONFIG_DIR / "worksets.json"
MAPPINGS_FILE = CONFIG_DIR / "mappings.json"
SQL_MAPPINGS_FILE = CONFIG_DIR / "sql_mappings.json"  # Kept for migration detection
LSN_STATE_FILE = CONFIG_DIR / "lsn_state.json"
CONNECTIONS_FILE = CONFIG_DIR / "connections.json"


class ConfigManager:
    """Configuration manager with JSON persistence."""
    
    def __init__(self):
        """Initialize configuration manager."""
        self._ensure_config_dir()
        self._worksets: Dict[str, WorkingSet] = {}
        self._mappings: Dict[str, Mapping] = {}  # Unified mappings storage
        self._connections: Dict[str, dict] = {}  # Stored connections library
        self._lsn_state: Dict[str, str] = {}
        self._migration_performed = False
        self.load_all()
    
    @staticmethod
    def _ensure_config_dir():
        """Ensure configuration directory exists."""
        CONFIG_DIR.mkdir(exist_ok=True)
    
    def load_all(self):
        """Load all configuration files."""
        self.load_connections()
        self.load_worksets()
        # Check for legacy mapping files and migrate if needed
        if self._needs_migration():
            self._migrate_legacy_mappings()
        self.load_mappings()
        self.load_lsn_state()
        # Migrate worksets to use unified mappings list
        if self._migration_performed:
            self._migrate_workset_mappings()
    
    def save_all(self):
        """Save all configuration files."""
        self.save_worksets()
        self.save_mappings()
        self.save_lsn_state()
    
    # Working Sets Management
    
    def load_worksets(self):
        """Load working sets from JSON file."""
        if WORKSETS_FILE.exists():
            try:
                with open(WORKSETS_FILE, 'r') as f:
                    data = json.load(f)
                    self._worksets = {
                        ws_id: WorkingSet(**ws_data)
                        for ws_id, ws_data in data.items()
                    }
                logger.info(f"Loaded {len(self._worksets)} working sets")
            except Exception as e:
                logger.error(f"Error loading working sets: {e}")
                self._worksets = {}
        else:
            self._worksets = {}
    
    def save_worksets(self):
        """Save working sets to JSON file."""
        try:
            data = {
                ws_id: ws.model_dump(mode='json')
                for ws_id, ws in self._worksets.items()
            }
            with open(WORKSETS_FILE, 'w') as f:
                json.dump(data, f, indent=2, default=str)
            logger.info(f"Saved {len(self._worksets)} working sets")
        except Exception as e:
            logger.error(f"Error saving working sets: {e}")
    
    def create_workset(self, workset: WorkingSet) -> bool:
        """Create a new working set.
        
        Args:
            workset: Working set to create
            
        Returns:
            True if created successfully
        """
        try:
            if workset.id in self._worksets:
                logger.warning(f"Working set {workset.id} already exists")
                return False
            
            self._worksets[workset.id] = workset
            self.save_worksets()
            logger.info(f"Created working set: {workset.name}")
            return True
        except Exception as e:
            logger.error(f"Error creating working set: {e}")
            return False
    
    def update_workset(self, workset: WorkingSet) -> bool:
        """Update an existing working set.
        
        Args:
            workset: Working set to update
            
        Returns:
            True if updated successfully
        """
        try:
            if workset.id not in self._worksets:
                logger.warning(f"Working set {workset.id} does not exist")
                return False
            
            workset.updated_at = datetime.now()
            self._worksets[workset.id] = workset
            self.save_worksets()
            logger.info(f"Updated working set: {workset.name}")
            return True
        except Exception as e:
            logger.error(f"Error updating working set: {e}")
            return False
    
    def delete_workset(self, workset_id: str) -> bool:
        """Delete a working set.
        
        Args:
            workset_id: Working set ID to delete
            
        Returns:
            True if deleted successfully
        """
        try:
            if workset_id in self._worksets:
                del self._worksets[workset_id]
                self.save_worksets()
                logger.info(f"Deleted working set: {workset_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting working set: {e}")
            return False
    
    def get_workset(self, workset_id: str) -> Optional[WorkingSet]:
        """Get a working set by ID.
        
        Args:
            workset_id: Working set ID
            
        Returns:
            Working set or None
        """
        return self._worksets.get(workset_id)
    
    def get_all_worksets(self) -> List[WorkingSet]:
        """Get all working sets.
        
        Returns:
            List of all working sets
        """
        return list(self._worksets.values())
    
    def get_active_workset(self) -> Optional[WorkingSet]:
        """Get the active working set.
        
        Returns:
            Active working set or None
        """
        for ws in self._worksets.values():
            if ws.is_active:
                return ws
        return None
    
    def set_active_workset(self, workset_id: str) -> bool:
        """Set a working set as active.
        
        Args:
            workset_id: Working set ID to activate
            
        Returns:
            True if activated successfully
        """
        try:
            # Deactivate all working sets
            for ws in self._worksets.values():
                ws.is_active = False
            
            # Activate the specified one
            if workset_id in self._worksets:
                self._worksets[workset_id].is_active = True
                self.save_worksets()
                logger.info(f"Activated working set: {workset_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error activating working set: {e}")
            return False
    
    # Unified Mappings Management
    
    def _needs_migration(self) -> bool:
        """Check if migration from legacy mapping files is needed.
        
        Returns:
            True if legacy files exist and unified mappings file doesn't exist or is empty
        """
        has_legacy_table = MAPPINGS_FILE.exists() and MAPPINGS_FILE.stat().st_size > 0
        has_legacy_sql = SQL_MAPPINGS_FILE.exists() and SQL_MAPPINGS_FILE.stat().st_size > 0
        
        # Check if unified file exists and has content
        unified_exists = MAPPINGS_FILE.exists()
        if unified_exists:
            try:
                with open(MAPPINGS_FILE, 'r') as f:
                    data = json.load(f)
                    # Check if it contains unified Mapping objects (have mapping_type field)
                    if data:
                        first_mapping = list(data.values())[0]
                        if 'mapping_type' in first_mapping:
                            return False  # Already unified
            except:
                pass
        
        return has_legacy_table or has_legacy_sql
    
    def _migrate_legacy_mappings(self):
        """Migrate legacy Mapping and SQLMapping to unified Mapping model."""
        logger.info("Starting migration of legacy mappings to unified Mapping model...")
        migrated_count = 0
        
        try:
            # Load legacy table mappings
            legacy_table_mappings: Dict[str, Mapping] = {}
            if MAPPINGS_FILE.exists():
                try:
                    with open(MAPPINGS_FILE, 'r') as f:
                        data = json.load(f)
                        # Check if already unified
                        if data and 'mapping_type' in list(data.values())[0]:
                            logger.info("Mappings file already contains unified mappings, skipping migration")
                            return
                        # Load as Mapping
                        legacy_table_mappings = {
                            mapping_id: Mapping(**mapping_data)
                            for mapping_id, mapping_data in data.items()
                        }
                        logger.info(f"Loaded {len(legacy_table_mappings)} legacy table mappings")
                except Exception as e:
                    logger.warning(f"Error loading legacy table mappings: {e}")
            
            # Load legacy SQL mappings
            legacy_sql_mappings: Dict[str, Mapping] = {}
            if SQL_MAPPINGS_FILE.exists():
                try:
                    with open(SQL_MAPPINGS_FILE, 'r') as f:
                        data = json.load(f)
                        legacy_sql_mappings = {
                            mapping_id: Mapping(**mapping_data)
                            for mapping_id, mapping_data in data.items()
                        }
                        logger.info(f"Loaded {len(legacy_sql_mappings)} legacy SQL mappings")
                except Exception as e:
                    logger.warning(f"Error loading legacy SQL mappings: {e}")
            
            # Convert Mapping to unified Mapping
            for mapping_id, table_mapping in legacy_table_mappings.items():
                unified_mapping = Mapping(
                    id=table_mapping.id,
                    name=f"{table_mapping.source_schema}.{table_mapping.source_table}",
                    mapping_type=MappingType.TABLE,
                    destination_schema=table_mapping.destination_schema,
                    destination_table=table_mapping.destination_table,
                    source_schema=table_mapping.source_schema,
                    source_table=table_mapping.source_table,
                    column_mappings=table_mapping.column_mappings,
                    enabled=table_mapping.enabled,
                    sync_deletes=table_mapping.sync_deletes,
                    sync_updates=table_mapping.sync_updates,
                    sync_inserts=table_mapping.sync_inserts,
                    use_duckdb_transformation=table_mapping.use_duckdb_transformation,
                    duckdb_script_name=table_mapping.duckdb_script_name,
                    duckdb_script_content=table_mapping.duckdb_script_content,
                    perform_initial_snapshot=table_mapping.perform_initial_snapshot,
                    snapshot_completed_at=table_mapping.snapshot_completed_at,
                    sync_mode="full",  # Default for table mappings
                    batch_size=1000,
                    timeout_seconds=300,
                    assigned_worksets=[]  # Will be populated from worksets
                )
                self._mappings[mapping_id] = unified_mapping
                migrated_count += 1
            
            # Convert SQLMapping to unified Mapping
            for mapping_id, sql_mapping in legacy_sql_mappings.items():
                unified_mapping = Mapping(
                    id=sql_mapping.id,
                    name=sql_mapping.name,
                    mapping_type=MappingType.SQL,
                    destination_schema=sql_mapping.destination_schema,
                    destination_table=sql_mapping.destination_table,
                    source_query=sql_mapping.source_query,
                    insert_query=sql_mapping.insert_query,
                    update_query=sql_mapping.update_query,
                    delete_query=sql_mapping.delete_query,
                    enabled=sql_mapping.enabled,
                    sync_mode=sql_mapping.sync_mode,
                    sync_schedule=sql_mapping.sync_schedule,
                    key_columns=sql_mapping.key_columns,
                    batch_size=sql_mapping.batch_size,
                    timeout_seconds=sql_mapping.timeout_seconds,
                    assigned_worksets=sql_mapping.assigned_worksets,
                    created_at=sql_mapping.created_at,
                    updated_at=sql_mapping.updated_at,
                    last_run_at=sql_mapping.last_run_at,
                    last_run_status=sql_mapping.last_run_status,
                    last_run_error=sql_mapping.last_run_error
                )
                self._mappings[mapping_id] = unified_mapping
                migrated_count += 1
            
            # Save unified mappings
            if migrated_count > 0:
                self.save_mappings()
                logger.info(f"Migrated {migrated_count} mappings to unified model")
                
                # Backup legacy files
                if legacy_table_mappings:
                    backup_path = MAPPINGS_FILE.with_suffix('.json.backup')
                    shutil.copy2(MAPPINGS_FILE, backup_path)
                    logger.info(f"Backed up legacy table mappings to {backup_path}")
                
                if legacy_sql_mappings:
                    backup_path = SQL_MAPPINGS_FILE.with_suffix('.json.backup')
                    shutil.copy2(SQL_MAPPINGS_FILE, backup_path)
                    logger.info(f"Backed up legacy SQL mappings to {backup_path}")
                
                self._migration_performed = True
            else:
                logger.info("No legacy mappings found to migrate")
                
        except Exception as e:
            logger.error(f"Error during migration: {e}", exc_info=True)
            raise
    
    def _migrate_workset_mappings(self):
        """Migrate worksets to use unified mappings list."""
        logger.info("Migrating worksets to use unified mappings list...")
        updated_count = 0
        
        for workset_id, workset in self._worksets.items():
            # Merge table_mappings and sql_mappings into unified mappings list
            unified_mappings = list(set(workset.table_mappings + workset.sql_mappings))
            
            if unified_mappings != workset.mappings:
                workset.mappings = unified_mappings
                updated_count += 1
        
        if updated_count > 0:
            self.save_worksets()
            logger.info(f"Updated {updated_count} worksets to use unified mappings list")
    
    def load_mappings(self):
        """Load unified mappings from JSON file."""
        if MAPPINGS_FILE.exists():
            try:
                with open(MAPPINGS_FILE, 'r') as f:
                    data = json.load(f)
                    self._mappings = {
                        mapping_id: Mapping(**mapping_data)
                        for mapping_id, mapping_data in data.items()
                    }
                logger.info(f"Loaded {len(self._mappings)} unified mappings")
            except Exception as e:
                logger.error(f"Error loading mappings: {e}")
                self._mappings = {}
        else:
            self._mappings = {}
    
    def save_mappings(self):
        """Save unified mappings to JSON file."""
        try:
            data = {
                mapping_id: mapping.model_dump(mode='json')
                for mapping_id, mapping in self._mappings.items()
            }
            with open(MAPPINGS_FILE, 'w') as f:
                json.dump(data, f, indent=2, default=str)
            logger.info(f"Saved {len(self._mappings)} unified mappings")
        except Exception as e:
            logger.error(f"Error saving mappings: {e}")
    
    def create_mapping(self, mapping: Mapping) -> bool:
        """Create a new unified mapping.
        
        Args:
            mapping: Unified mapping to create
            
        Returns:
            True if created successfully
        """
        try:
            if mapping.id in self._mappings:
                logger.warning(f"Mapping {mapping.id} already exists")
                return False
            
            mapping.updated_at = datetime.now()
            self._mappings[mapping.id] = mapping
            self.save_mappings()
            logger.info(f"Created mapping: {mapping.id} (type: {mapping.mapping_type.value})")
            return True
        except Exception as e:
            logger.error(f"Error creating mapping: {e}")
            return False
    
    def update_mapping(self, mapping: Mapping) -> bool:
        """Update an existing unified mapping.
        
        Args:
            mapping: Unified mapping to update
            
        Returns:
            True if updated successfully
        """
        try:
            if mapping.id not in self._mappings:
                logger.warning(f"Mapping {mapping.id} does not exist")
                return False
            
            mapping.updated_at = datetime.now()
            self._mappings[mapping.id] = mapping
            self.save_mappings()
            logger.info(f"Updated mapping: {mapping.id}")
            return True
        except Exception as e:
            logger.error(f"Error updating mapping: {e}")
            return False
    
    def delete_mapping(self, mapping_id: str) -> bool:
        """Delete a unified mapping.
        
        Args:
            mapping_id: Mapping ID to delete
            
        Returns:
            True if deleted successfully
        """
        try:
            if mapping_id in self._mappings:
                del self._mappings[mapping_id]
                self.save_mappings()
                logger.info(f"Deleted mapping: {mapping_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting mapping: {e}")
            return False
    
    def get_mapping(self, mapping_id: str) -> Optional[Mapping]:
        """Get a unified mapping by ID.
        
        Args:
            mapping_id: Mapping ID
            
        Returns:
            Unified mapping or None
        """
        return self._mappings.get(mapping_id)
    
    def get_all_mappings(self) -> List[Mapping]:
        """Get all unified mappings.
        
        Returns:
            List of all unified mappings
        """
        return list(self._mappings.values())
    
    def get_mappings_for_workset(self, workset_id: str) -> List[Mapping]:
        """Get all mappings (table and SQL) associated with a working set.
        
        Args:
            workset_id: Working set ID
            
        Returns:
            List of unified mappings
        """
        workset = self.get_workset(workset_id)
        if not workset:
            return []
        
        # Use unified mappings list, fallback to legacy lists for compatibility
        mapping_ids = workset.mappings if workset.mappings else (workset.table_mappings + workset.sql_mappings)
        
        return [
            self._mappings[mapping_id]
            for mapping_id in mapping_ids
            if mapping_id in self._mappings
        ]
    
    def get_mappings_by_type(self, mapping_type: MappingType) -> List[Mapping]:
        """Get all mappings of a specific type.
        
        Args:
            mapping_type: Type of mapping to filter
            
        Returns:
            List of mappings of the specified type
        """
        return [m for m in self._mappings.values() if m.mapping_type == mapping_type]
    
    # LSN State Management
    
    def load_lsn_state(self):
        """Load LSN state from JSON file."""
        if LSN_STATE_FILE.exists():
            try:
                with open(LSN_STATE_FILE, 'r') as f:
                    self._lsn_state = json.load(f)
                logger.info(f"Loaded LSN state for {len(self._lsn_state)} tables")
            except Exception as e:
                logger.error(f"Error loading LSN state: {e}")
                self._lsn_state = {}
        else:
            self._lsn_state = {}
    
    def save_lsn_state(self):
        """Save LSN state to JSON file."""
        try:
            with open(LSN_STATE_FILE, 'w') as f:
                json.dump(self._lsn_state, f, indent=2)
            logger.debug(f"Saved LSN state for {len(self._lsn_state)} tables")
        except Exception as e:
            logger.error(f"Error saving LSN state: {e}")
    
    def get_last_lsn(self, table_key: str) -> Optional[str]:
        """Get last processed LSN for a table.
        
        Args:
            table_key: Table identifier (e.g., 'schema.table')
            
        Returns:
            Last LSN as hex string or None
        """
        return self._lsn_state.get(table_key)
    
    def set_last_lsn(self, table_key: str, lsn: str):
        """Set last processed LSN for a table.
        
        Args:
            table_key: Table identifier (e.g., 'schema.table')
            lsn: LSN as hex string
        """
        self._lsn_state[table_key] = lsn
        self.save_lsn_state()
    
    def clear_lsn_state(self, table_key: Optional[str] = None):
        """Clear LSN state.
        
        Args:
            table_key: Table identifier to clear (None to clear all)
        """
        if table_key:
            if table_key in self._lsn_state:
                del self._lsn_state[table_key]
        else:
            self._lsn_state.clear()
        self.save_lsn_state()
    
    def export_config(self, export_path: str) -> bool:
        """Export all configuration to a single file.
        
        Args:
            export_path: Path to export file
            
        Returns:
            True if exported successfully
        """
        try:
            export_data = {
                'worksets': {ws_id: ws.model_dump(mode='json') for ws_id, ws in self._worksets.items()},
                'mappings': {m_id: m.model_dump(mode='json') for m_id, m in self._mappings.items()},
                'lsn_state': self._lsn_state,
                'export_date': datetime.now().isoformat()
            }
            
            with open(export_path, 'w') as f:
                json.dump(export_data, f, indent=2, default=str)
            
            logger.info(f"Exported configuration to {export_path}")
            return True
        except Exception as e:
            logger.error(f"Error exporting configuration: {e}")
            return False
    
    def import_config(self, import_path: str) -> bool:
        """Import configuration from a file.
        
        Args:
            import_path: Path to import file
            
        Returns:
            True if imported successfully
        """
        try:
            with open(import_path, 'r') as f:
                import_data = json.load(f)
            
            # Import worksets
            if 'worksets' in import_data:
                self._worksets = {
                    ws_id: WorkingSet(**ws_data)
                    for ws_id, ws_data in import_data['worksets'].items()
                }
            
            # Import mappings (try unified first, fallback to legacy)
            if 'mappings' in import_data:
                try:
                    # Try unified Mapping format
                    self._mappings = {
                        m_id: Mapping(**m_data)
                        for m_id, m_data in import_data['mappings'].items()
                    }
                except:
                    # Fallback to legacy Mapping format
                    self._mappings = {
                        m_id: Mapping(
                            id=m_data.get('id', m_id),
                            name=m_data.get('name', f"mapping_{m_id}"),
                            mapping_type=MappingType.TABLE,
                            destination_schema=m_data.get('destination_schema', ''),
                            destination_table=m_data.get('destination_table', ''),
                            source_schema=m_data.get('source_schema', ''),
                            source_table=m_data.get('source_table', ''),
                            column_mappings=m_data.get('column_mappings', []),
                            enabled=m_data.get('enabled', True),
                            sync_deletes=m_data.get('sync_deletes', True),
                            sync_updates=m_data.get('sync_updates', True),
                            sync_inserts=m_data.get('sync_inserts', True)
                        )
                        for m_id, m_data in import_data['mappings'].items()
                    }
            
            # Import LSN state
            if 'lsn_state' in import_data:
                self._lsn_state = import_data['lsn_state']
            
            self.save_all()
            logger.info(f"Imported configuration from {import_path}")
            return True
        except Exception as e:
            logger.error(f"Error importing configuration: {e}")
            return False

    # ========================================================================
    # CONNECTION LIBRARY MANAGEMENT
    # ========================================================================

    def load_connections(self):
        """Load saved connections from JSON file."""
        if CONNECTIONS_FILE.exists():
            try:
                with open(CONNECTIONS_FILE, 'r') as f:
                    content = f.read().strip()
                    if content:
                        self._connections = json.loads(content)
                    else:
                        self._connections = {}
                logger.info(f"Loaded {len(self._connections)} saved connections")
            except Exception as e:
                logger.error(f"Error loading connections: {e}")
                self._connections = {}
        else:
            self._connections = {}

    def save_connections(self):
        """Save connections to JSON file."""
        try:
            with open(CONNECTIONS_FILE, 'w') as f:
                json.dump(self._connections, f, indent=2, default=str)
            logger.info(f"Saved {len(self._connections)} connections")
        except Exception as e:
            logger.error(f"Error saving connections: {e}")

    def get_all_connections(self) -> List[dict]:
        """Get all saved connections."""
        return list(self._connections.values())

    def get_connection(self, connection_id: str) -> Optional[dict]:
        """Get a connection by ID."""
        return self._connections.get(connection_id)

    def save_connection(self, connection_id: str, connection_data: dict) -> tuple[bool, str]:
        """Save a connection to the library."""
        try:
            self._connections[connection_id] = connection_data
            self.save_connections()
            return True, f"Connection '{connection_id}' saved successfully"
        except Exception as e:
            logger.error(f"Error saving connection: {e}")
            return False, str(e)

    def delete_connection(self, connection_id: str) -> tuple[bool, str]:
        """Delete a connection from the library."""
        try:
            if connection_id in self._connections:
                del self._connections[connection_id]
                self.save_connections()
                return True, f"Connection '{connection_id}' deleted successfully"
            else:
                return False, f"Connection '{connection_id}' not found"
        except Exception as e:
            logger.error(f"Error deleting connection: {e}")
            return False, str(e)

    def update_connection(self, connection_id: str, connection_data: dict) -> tuple[bool, str]:
        """Update an existing connection."""
        try:
            if connection_id in self._connections:
                self._connections[connection_id] = connection_data
                self.save_connections()
                return True, f"Connection '{connection_id}' updated successfully"
            else:
                return False, f"Connection '{connection_id}' not found"
        except Exception as e:
            logger.error(f"Error updating connection: {e}")
            return False, str(e)


# Global configuration manager instance
config_manager = ConfigManager()








