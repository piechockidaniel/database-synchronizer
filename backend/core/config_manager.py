"""Configuration management system with JSON persistence."""
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict
from backend.models.schemas import WorkingSet, TableMapping

logger = logging.getLogger(__name__)

CONFIG_DIR = Path("config")
WORKSETS_FILE = CONFIG_DIR / "worksets.json"
MAPPINGS_FILE = CONFIG_DIR / "mappings.json"
LSN_STATE_FILE = CONFIG_DIR / "lsn_state.json"


class ConfigManager:
    """Configuration manager with JSON persistence."""
    
    def __init__(self):
        """Initialize configuration manager."""
        self._ensure_config_dir()
        self._worksets: Dict[str, WorkingSet] = {}
        self._mappings: Dict[str, TableMapping] = {}
        self._lsn_state: Dict[str, str] = {}
        self.load_all()
    
    @staticmethod
    def _ensure_config_dir():
        """Ensure configuration directory exists."""
        CONFIG_DIR.mkdir(exist_ok=True)
    
    def load_all(self):
        """Load all configuration files."""
        self.load_worksets()
        self.load_mappings()
        self.load_lsn_state()
    
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
    
    # Table Mappings Management
    
    def load_mappings(self):
        """Load table mappings from JSON file."""
        if MAPPINGS_FILE.exists():
            try:
                with open(MAPPINGS_FILE, 'r') as f:
                    data = json.load(f)
                    self._mappings = {
                        mapping_id: TableMapping(**mapping_data)
                        for mapping_id, mapping_data in data.items()
                    }
                logger.info(f"Loaded {len(self._mappings)} table mappings")
            except Exception as e:
                logger.error(f"Error loading mappings: {e}")
                self._mappings = {}
        else:
            self._mappings = {}
    
    def save_mappings(self):
        """Save table mappings to JSON file."""
        try:
            data = {
                mapping_id: mapping.model_dump(mode='json')
                for mapping_id, mapping in self._mappings.items()
            }
            with open(MAPPINGS_FILE, 'w') as f:
                json.dump(data, f, indent=2, default=str)
            logger.info(f"Saved {len(self._mappings)} table mappings")
        except Exception as e:
            logger.error(f"Error saving mappings: {e}")
    
    def create_mapping(self, mapping: TableMapping) -> bool:
        """Create a new table mapping.
        
        Args:
            mapping: Table mapping to create
            
        Returns:
            True if created successfully
        """
        try:
            if mapping.id in self._mappings:
                logger.warning(f"Mapping {mapping.id} already exists")
                return False
            
            self._mappings[mapping.id] = mapping
            self.save_mappings()
            logger.info(f"Created mapping: {mapping.source_schema}.{mapping.source_table} -> "
                       f"{mapping.destination_schema}.{mapping.destination_table}")
            return True
        except Exception as e:
            logger.error(f"Error creating mapping: {e}")
            return False
    
    def update_mapping(self, mapping: TableMapping) -> bool:
        """Update an existing table mapping.
        
        Args:
            mapping: Table mapping to update
            
        Returns:
            True if updated successfully
        """
        try:
            if mapping.id not in self._mappings:
                logger.warning(f"Mapping {mapping.id} does not exist")
                return False
            
            self._mappings[mapping.id] = mapping
            self.save_mappings()
            logger.info(f"Updated mapping: {mapping.id}")
            return True
        except Exception as e:
            logger.error(f"Error updating mapping: {e}")
            return False
    
    def delete_mapping(self, mapping_id: str) -> bool:
        """Delete a table mapping.
        
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
    
    def get_mapping(self, mapping_id: str) -> Optional[TableMapping]:
        """Get a table mapping by ID.
        
        Args:
            mapping_id: Mapping ID
            
        Returns:
            Table mapping or None
        """
        return self._mappings.get(mapping_id)
    
    def get_all_mappings(self) -> List[TableMapping]:
        """Get all table mappings.
        
        Returns:
            List of all table mappings
        """
        return list(self._mappings.values())
    
    def get_mappings_for_workset(self, workset_id: str) -> List[TableMapping]:
        """Get all mappings associated with a working set.
        
        Args:
            workset_id: Working set ID
            
        Returns:
            List of table mappings
        """
        workset = self.get_workset(workset_id)
        if not workset:
            return []
        
        return [
            self._mappings[mapping_id]
            for mapping_id in workset.table_mappings
            if mapping_id in self._mappings
        ]
    
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
            
            # Import mappings
            if 'mappings' in import_data:
                self._mappings = {
                    m_id: TableMapping(**m_data)
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


# Global configuration manager instance
config_manager = ConfigManager()








