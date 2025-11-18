"""Mapping manager for source-destination table and column mappings."""
import logging
from typing import List, Dict, Optional
from backend.models.schemas import TableMapping, ColumnMapping
from backend.core.config_manager import config_manager

logger = logging.getLogger(__name__)


class MappingManager:
    """Manager for table and column mappings."""
    
    def __init__(self):
        """Initialize mapping manager."""
        self.config = config_manager
    
    @staticmethod
    def validate_mapping(mapping: TableMapping) -> tuple[bool, List[str]]:
        """Validate a table mapping configuration.
        
        Args:
            mapping: Table mapping to validate
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        # Check if mapping has at least one column mapping
        if not mapping.column_mappings:
            errors.append("Mapping must have at least one column mapping")
        
        # Validate each column mapping
        all_source_cols = []
        for idx, cm in enumerate(mapping.column_mappings):
            # Each mapping must have either source_column OR source_columns
            if not cm.source_column and not cm.source_columns:
                errors.append(f"Column mapping {idx + 1}: must have either source_column or source_columns")
            
            # Cannot have both
            if cm.source_column and cm.source_columns:
                errors.append(f"Column mapping {idx + 1}: cannot have both source_column and source_columns")
        
            # Collect all source columns for duplicate check
            if cm.source_column:
                all_source_cols.append(cm.source_column)
            if cm.source_columns:
                all_source_cols.extend(cm.source_columns)
            
            # If using multiple source columns, transformation should be provided
            if cm.source_columns and len(cm.source_columns) > 1 and not cm.transformation and not cm.ignore_changes:
                logger.warning(f"Column mapping {idx + 1}: Multiple source columns without transformation. "
                             "Consider adding a transformation (e.g., JSON_OBJECT, CONCAT)")
            
            # Validate ignore_changes and auto_generate combination
            if cm.ignore_changes and cm.auto_generate and cm.auto_generate.value != 'none':
                errors.append(f"Column mapping {idx + 1}: Cannot have both ignore_changes and auto_generate enabled")
            
            # If auto_generate is set, expression should be provided
            if cm.auto_generate and cm.auto_generate.value != 'none':
                if not cm.auto_generate_expression:
                    errors.append(f"Column mapping {idx + 1}: auto_generate_expression required when auto_generate is enabled")
            
            # If ignored, transformation doesn't make sense
            if cm.ignore_changes and cm.transformation:
                logger.warning(f"Column mapping {idx + 1}: transformation specified but column is ignored")
        
        # Note: We now allow duplicate destination columns (many-to-one is OK with transformations)
        # but we still check for duplicate source columns being used individually
        
        # Validate table names
        if not mapping.source_schema or not mapping.source_table:
            errors.append("Source schema and table must be specified")
        
        if not mapping.destination_schema or not mapping.destination_table:
            errors.append("Destination schema and table must be specified")
        
        return len(errors) == 0, errors
    
    def create_mapping(self, mapping: TableMapping) -> tuple[bool, str]:
        """Create a new table mapping.
        
        Args:
            mapping: Table mapping to create
            
        Returns:
            Tuple of (success, message)
        """
        # Validate mapping
        is_valid, errors = self.validate_mapping(mapping)
        if not is_valid:
            return False, "; ".join(errors)
        
        # Create mapping
        if self.config.create_mapping(mapping):
            return True, f"Mapping created successfully: {mapping.id}"
        else:
            return False, "Failed to create mapping (ID already exists)"
    
    def update_mapping(self, mapping: TableMapping) -> tuple[bool, str]:
        """Update an existing table mapping.
        
        Args:
            mapping: Table mapping to update
            
        Returns:
            Tuple of (success, message)
        """
        # Validate mapping
        is_valid, errors = self.validate_mapping(mapping)
        if not is_valid:
            return False, "; ".join(errors)
        
        # Update mapping
        if self.config.update_mapping(mapping):
            return True, f"Mapping updated successfully: {mapping.id}"
        else:
            return False, "Failed to update mapping (ID not found)"
    
    def delete_mapping(self, mapping_id: str) -> tuple[bool, str]:
        """Delete a table mapping.
        
        Args:
            mapping_id: Mapping ID to delete
            
        Returns:
            Tuple of (success, message)
        """
        if self.config.delete_mapping(mapping_id):
            return True, f"Mapping deleted successfully: {mapping_id}"
        else:
            return False, "Failed to delete mapping (ID not found)"
    
    def get_mapping(self, mapping_id: str) -> Optional[TableMapping]:
        """Get a table mapping by ID.
        
        Args:
            mapping_id: Mapping ID
            
        Returns:
            Table mapping or None
        """
        return self.config.get_mapping(mapping_id)
    
    def list_mappings(self) -> List[TableMapping]:
        """Get all table mappings.
        
        Returns:
            List of all table mappings
        """
        return self.config.get_all_mappings()
    
    @staticmethod
    def get_column_mapping_dict(mapping: TableMapping) -> Dict[str, str]:
        """Get column mappings as a dictionary.
        
        Args:
            mapping: Table mapping
            
        Returns:
            Dictionary mapping source columns to destination columns
            Note: For many-to-one mappings, only includes simple 1:1 mappings
        """
        result = {}
        for cm in mapping.column_mappings:
            if cm.source_column:  # Simple 1:1 mapping
                result[cm.source_column] = cm.destination_column
        return result
    
    @staticmethod
    def get_reverse_column_mapping(mapping: TableMapping) -> Dict[str, str]:
        """Get reverse column mappings (destination to source).
        
        Args:
            mapping: Table mapping
            
        Returns:
            Dictionary mapping destination columns to source columns
        """
        return {
            cm.destination_column: cm.source_column
            for cm in mapping.column_mappings
        }
    
    @staticmethod
    def get_transformations(mapping: TableMapping) -> Dict[str, Optional[str]]:
        """Get column transformations.
        
        Args:
            mapping: Table mapping
            
        Returns:
            Dictionary mapping source columns to transformation expressions
        """
        return {
            cm.source_column: cm.transformation
            for cm in mapping.column_mappings
        }
    
    @staticmethod
    def auto_map_columns(
            source_columns: List[str],
        dest_columns: List[str]
    ) -> List[ColumnMapping]:
        """Automatically map columns by matching names (case-insensitive).
        
        Args:
            source_columns: List of source column names
            dest_columns: List of destination column names
            
        Returns:
            List of column mappings
        """
        mappings = []
        
        # Create lowercase lookup for destination columns
        dest_lookup = {col.lower(): col for col in dest_columns}
        
        for src_col in source_columns:
            # Try exact match (case-insensitive)
            if src_col.lower() in dest_lookup:
                mappings.append(ColumnMapping(
                    source_column=src_col,
                    destination_column=dest_lookup[src_col.lower()]
                ))
        
        return mappings
    
    @staticmethod
    def generate_mapping_id(source_schema: str, source_table: str) -> str:
        """Generate a unique mapping ID.
        
        Args:
            source_schema: Source schema name
            source_table: Source table name
            
        Returns:
            Unique mapping ID
        """
        import uuid
        base_id = f"{source_schema}_{source_table}"
        return f"{base_id}_{uuid.uuid4().hex[:8]}"


# Global mapping manager instance
mapping_manager = MappingManager()






