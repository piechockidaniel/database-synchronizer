"""
Workflow Converter

Converts visual workflows into TableMapping configurations.
"""

import logging
from typing import List, Dict, Tuple, Optional, Set
from backend.models.workflow_schemas import VisualWorkflow, WorkflowNode, WorkflowEdge
from backend.models.schemas import TableMapping, ColumnMapping

logger = logging.getLogger(__name__)


class WorkflowConverter:
    """Converter for visual workflows to TableMapping configurations."""
    
    def __init__(self):
        """Initialize converter."""
        pass
    
    def compile_workflow(self, workflow: VisualWorkflow) -> Tuple[bool, Optional[TableMapping], List[str]]:
        """Compile visual workflow into TableMapping.
        
        Args:
            workflow: Visual workflow to compile
            
        Returns:
            Tuple of (success, mapping, error_messages)
        """
        errors = []
        
        try:
            # Build graph
            graph = self._build_graph(workflow)
            
            # Find source and destination nodes
            source_info = self._extract_source_info(workflow, graph, errors)
            dest_info = self._extract_dest_info(workflow, graph, errors)
            
            if errors:
                return False, None, errors
            
            # Extract transformations along the path
            transformations = self._extract_transformations(workflow, graph)
            
            # Build column mappings
            column_mappings = self._build_column_mappings(source_info, dest_info, transformations, errors)
            
            if errors:
                return False, None, errors
            
            # Create TableMapping
            mapping_id = f"mapping_{workflow.id}"
            
            table_mapping = TableMapping(
                id=mapping_id,
                source_schema=source_info.get('schema', 'dbo'),
                source_table=source_info.get('table', ''),
                destination_schema=dest_info.get('schema', 'dbo'),
                destination_table=dest_info.get('table', ''),
                column_mappings=column_mappings,
                enabled=True,
                sync_inserts=True,
                sync_updates=True,
                sync_deletes=True
            )
            
            # Check for DuckDB transformations
            duckdb_nodes = [n for n in workflow.nodes if n.type == 'transform_duckdb']
            if duckdb_nodes:
                table_mapping.use_duckdb_transformation = True
                # Use the first DuckDB node's script
                duckdb_node = duckdb_nodes[0]
                if duckdb_node.config.get('script_name'):
                    table_mapping.duckdb_script_name = duckdb_node.config['script_name']
                elif duckdb_node.config.get('script_content'):
                    table_mapping.duckdb_script_content = duckdb_node.config['script_content']
            
            logger.info(f"Successfully compiled workflow '{workflow.id}' to mapping '{mapping_id}'")
            return True, table_mapping, []
            
        except Exception as e:
            logger.error(f"Error compiling workflow: {e}")
            errors.append(f"Compilation error: {str(e)}")
            return False, None, errors
    
    def _build_graph(self, workflow: VisualWorkflow) -> Dict[str, List[str]]:
        """Build adjacency list graph from edges.
        
        Args:
            workflow: Visual workflow
            
        Returns:
            Adjacency list {node_id: [connected_node_ids]}
        """
        graph = {node.id: [] for node in workflow.nodes}
        
        for edge in workflow.edges:
            if edge.source in graph:
                graph[edge.source].append(edge.target)
        
        return graph
    
    def _extract_source_info(self, workflow: VisualWorkflow, graph: Dict, errors: List[str]) -> Dict:
        """Extract source database and table information.
        
        Args:
            workflow: Visual workflow
            graph: Connection graph
            errors: List to append errors to
            
        Returns:
            Dictionary with source info
        """
        source_info = {}
        
        # Find source database node
        source_db_nodes = [n for n in workflow.nodes if n.type == 'source_database']
        if source_db_nodes:
            source_info['server'] = source_db_nodes[0].config.get('server', '')
            source_info['database'] = source_db_nodes[0].config.get('database', '')
        
        # Find source table node
        source_table_nodes = [n for n in workflow.nodes if n.type == 'source_table']
        if source_table_nodes:
            source_info['schema'] = source_table_nodes[0].config.get('schema', 'dbo')
            source_info['table'] = source_table_nodes[0].config.get('table', '')
            source_info['columns'] = source_table_nodes[0].config.get('columns', [])
        else:
            errors.append("Workflow must have a Source Table node")
        
        return source_info
    
    def _extract_dest_info(self, workflow: VisualWorkflow, graph: Dict, errors: List[str]) -> Dict:
        """Extract destination database and table information.
        
        Args:
            workflow: Visual workflow
            graph: Connection graph
            errors: List to append errors to
            
        Returns:
            Dictionary with destination info
        """
        dest_info = {}
        
        # Find destination database node
        dest_db_nodes = [n for n in workflow.nodes if n.type == 'dest_database']
        if dest_db_nodes:
            dest_info['server'] = dest_db_nodes[0].config.get('server', '')
            dest_info['database'] = dest_db_nodes[0].config.get('database', '')
        
        # Find destination table node
        dest_table_nodes = [n for n in workflow.nodes if n.type == 'dest_table']
        if dest_table_nodes:
            dest_info['schema'] = dest_table_nodes[0].config.get('schema', 'dbo')
            dest_info['table'] = dest_table_nodes[0].config.get('table', '')
        else:
            errors.append("Workflow must have a Destination Table node")
        
        return dest_info
    
    def _extract_transformations(self, workflow: VisualWorkflow, graph: Dict) -> List[WorkflowNode]:
        """Extract transformation nodes from workflow.
        
        Args:
            workflow: Visual workflow
            graph: Connection graph
            
        Returns:
            List of transformation nodes
        """
        transform_types = [
            'transform_json', 'transform_concat', 'transform_sql',
            'transform_duckdb', 'transform_filter', 'transform_dedupe'
        ]
        
        return [n for n in workflow.nodes if n.type in transform_types]
    
    def _build_column_mappings(self, source_info: Dict, dest_info: Dict, 
                               transformations: List[WorkflowNode], errors: List[str]) -> List[ColumnMapping]:
        """Build column mappings from transformation nodes.
        
        Args:
            source_info: Source database/table info
            dest_info: Destination database/table info
            transformations: List of transformation nodes
            errors: List to append errors to
            
        Returns:
            List of column mappings
        """
        column_mappings = []
        
        for trans_node in transformations:
            try:
                mapping = self._node_to_column_mapping(trans_node)
                if mapping:
                    column_mappings.append(mapping)
            except Exception as e:
                errors.append(f"Error in node '{trans_node.label or trans_node.id}': {str(e)}")
        
        # If no explicit transformations, try to create simple mappings
        if not column_mappings:
            logger.warning("No transformation nodes found, creating empty mapping")
        
        return column_mappings
    
    def _node_to_column_mapping(self, node: WorkflowNode) -> Optional[ColumnMapping]:
        """Convert transformation node to ColumnMapping.
        
        Args:
            node: Transformation node
            
        Returns:
            ColumnMapping or None
        """
        config = node.config
        
        if node.type == 'transform_json':
            source_cols = config.get('source_columns', [])
            dest_col = config.get('destination_column', '')
            
            if not source_cols or not dest_col:
                return None
            
            return ColumnMapping(
                source_columns=source_cols if len(source_cols) > 1 else None,
                source_column=source_cols[0] if len(source_cols) == 1 else None,
                destination_column=dest_col,
                transformation_type='json'
            )
        
        elif node.type == 'transform_concat':
            source_cols = config.get('source_columns', [])
            dest_col = config.get('destination_column', '')
            separator = config.get('separator', ', ')
            
            if not source_cols or not dest_col:
                return None
            
            # Build CONCAT expression
            concat_expr = f"CONCAT({separator.join(['{}']*len(source_cols))})"
            
            return ColumnMapping(
                source_columns=source_cols if len(source_cols) > 1 else None,
                source_column=source_cols[0] if len(source_cols) == 1 else None,
                destination_column=dest_col,
                transformation_type='concat'
            )
        
        elif node.type == 'transform_sql':
            source_cols = config.get('source_columns', [])
            dest_col = config.get('destination_column', '')
            expression = config.get('expression', '')
            
            if not dest_col or not expression:
                return None
            
            return ColumnMapping(
                source_columns=source_cols if len(source_cols) > 1 else None,
                source_column=source_cols[0] if len(source_cols) == 1 else None,
                destination_column=dest_col,
                transformation=expression,
                transformation_type='custom'
            )
        
        # Other transformation types don't directly map to column mappings
        # They affect the overall mapping configuration
        return None


# Global instance
workflow_converter = WorkflowConverter()

