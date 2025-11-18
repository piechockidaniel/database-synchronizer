"""Administration API endpoints."""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
import logging
from pydantic import BaseModel
from backend.models.schemas import (
    ConnectionConfig, ConnectionTestResponse, DatabaseInfo,
    TableInfo, ColumnInfo, CDCEnableRequest, CDCStatusResponse,
    TableMapping, WorkingSet, ConnectionType
)
from backend.db.mssql_manager import MSSQLConnection, connection_pool
from backend.db.cdc_operations import CDCOperations
from backend.core.config_manager import config_manager
from backend.core.mapping_manager import mapping_manager
from backend.core.duckdb_script_manager import duckdb_script_manager
from backend.core.workflow_manager import workflow_manager
from backend.core.workflow_converter import workflow_converter
from backend.models.workflow_schemas import (
    VisualWorkflow, WorkflowListItem, WorkflowValidationResult,
    WorkflowCompileResult
)

logger = logging.getLogger(__name__)

router = APIRouter()


# Request/Response models for DuckDB scripts
class ScriptValidationRequest(BaseModel):
    content: str


class ScriptValidationResponse(BaseModel):
    valid: bool
    message: str


# Connection Management

@router.post("/connect/test")
async def test_connection(config: ConnectionConfig) -> ConnectionTestResponse:
    """Test a database connection.
    
    Args:
        config: Connection configuration
        
    Returns:
        Connection test response
    """
    try:
        conn = MSSQLConnection(config)
        success, message = conn.test_connection()
        
        return ConnectionTestResponse(
            success=success,
            message=message,
            server_version=conn.get_server_version() if success else None
        )
    except Exception as e:
        logger.error(f"Error testing connection: {e}")
        return ConnectionTestResponse(
            success=False,
            message=str(e)
        )


@router.post("/connect/set")
async def set_connection(connection_type: ConnectionType, config: ConnectionConfig):
    """Set source or destination connection.
    
    Args:
        connection_type: Type of connection (source/destination)
        config: Connection configuration
        
    Returns:
        Success message
    """
    try:
        if connection_type == ConnectionType.SOURCE:
            connection_pool.set_source(config)
            logger.info(f"Set source connection: {config.name}")
        else:
            connection_pool.set_destination(config)
            logger.info(f"Set destination connection: {config.name}")
        
        return {"success": True, "message": f"{connection_type.value} connection set successfully"}
    except Exception as e:
        logger.error(f"Error setting connection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Database Scanning

@router.get("/scan/databases")
async def get_databases(connection_type: ConnectionType) -> List[DatabaseInfo]:
    """Get list of databases.
    
    Args:
        connection_type: Type of connection to scan
        
    Returns:
        List of databases
    """
    try:
        conn = connection_pool.source if connection_type == ConnectionType.SOURCE else connection_pool.destination
        if not conn:
            raise HTTPException(status_code=400, detail=f"{connection_type.value} connection not set")
        
        if not conn.is_connected():
            conn.connect()
        
        return conn.get_databases()
    except Exception as e:
        logger.error(f"Error getting databases: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scan/tables")
async def get_tables(connection_type: ConnectionType, database: Optional[str] = None) -> List[TableInfo]:
    """Get list of tables in database.
    
    Args:
        connection_type: Type of connection to scan
        database: Database name (optional)
        
    Returns:
        List of tables
    """
    try:
        conn = connection_pool.source if connection_type == ConnectionType.SOURCE else connection_pool.destination
        if not conn:
            raise HTTPException(status_code=400, detail=f"{connection_type.value} connection not set")
        
        if not conn.is_connected():
            conn.connect()
        
        return conn.get_tables(database)
    except Exception as e:
        logger.error(f"Error getting tables: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scan/columns")
async def get_columns(
    connection_type: ConnectionType,
    schema_name: str,
    table_name: str
) -> List[ColumnInfo]:
    """Get list of columns in table.
    
    Args:
        connection_type: Type of connection to scan
        schema_name: Schema name
        table_name: Table name
        
    Returns:
        List of columns
    """
    try:
        conn = connection_pool.source if connection_type == ConnectionType.SOURCE else connection_pool.destination
        if not conn:
            raise HTTPException(status_code=400, detail=f"{connection_type.value} connection not set")
        
        if not conn.is_connected():
            conn.connect()
        
        return conn.get_columns(schema_name, table_name)
    except Exception as e:
        logger.error(f"Error getting columns: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# CDC Management

@router.post("/cdc/enable-db")
async def enable_cdc_database(request: CDCEnableRequest):
    """Enable CDC on database.
    
    Args:
        request: CDC enable request
        
    Returns:
        Success response
    """
    try:
        conn = connection_pool.source if request.connection_type == ConnectionType.SOURCE else connection_pool.destination
        if not conn:
            raise HTTPException(status_code=400, detail=f"{request.connection_type.value} connection not set")
        
        if not conn.is_connected():
            conn.connect()
        
        cdc_ops = CDCOperations(conn)
        success, message = cdc_ops.enable_cdc_on_database()
        
        if not success:
            raise HTTPException(status_code=500, detail=message)
        
        return {"success": True, "message": message}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error enabling CDC on database: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cdc/enable-table")
async def enable_cdc_table(request: CDCEnableRequest):
    """Enable CDC on table.
    
    Args:
        request: CDC enable request
        
    Returns:
        Success response
    """
    try:
        if not request.schema_name or not request.table_name:
            raise HTTPException(status_code=400, detail="schema_name and table_name are required")
        
        conn = connection_pool.source if request.connection_type == ConnectionType.SOURCE else connection_pool.destination
        if not conn:
            raise HTTPException(status_code=400, detail=f"{request.connection_type.value} connection not set")
        
        if not conn.is_connected():
            conn.connect()
        
        cdc_ops = CDCOperations(conn)
        success, message = cdc_ops.enable_cdc_on_table(
            request.schema_name,
            request.table_name,
            request.capture_instance
        )
        
        if not success:
            raise HTTPException(status_code=500, detail=message)
        
        return {"success": True, "message": message}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error enabling CDC on table: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cdc/status")
async def get_cdc_status(connection_type: ConnectionType) -> CDCStatusResponse:
    """Get CDC status for database.
    
    Args:
        connection_type: Type of connection
        
    Returns:
        CDC status response
    """
    try:
        conn = connection_pool.source if connection_type == ConnectionType.SOURCE else connection_pool.destination
        if not conn:
            raise HTTPException(status_code=400, detail=f"{connection_type.value} connection not set")
        
        if not conn.is_connected():
            conn.connect()
        
        cdc_ops = CDCOperations(conn)
        cdc_enabled = cdc_ops.is_cdc_enabled_on_database()
        tables = cdc_ops.get_cdc_enabled_tables() if cdc_enabled else []
        
        return CDCStatusResponse(
            database=conn.config.database,
            cdc_enabled=cdc_enabled,
            tables=tables
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting CDC status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Mapping Management

@router.post("/mapping/create")
async def create_mapping(mapping: TableMapping):
    """Create a new table mapping.
    
    Args:
        mapping: Table mapping configuration
        
    Returns:
        Success response
    """
    try:
        success, message = mapping_manager.create_mapping(mapping)
        if not success:
            raise HTTPException(status_code=400, detail=message)
        
        return {"success": True, "message": message, "mapping_id": mapping.id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating mapping: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mapping/list")
async def list_mappings() -> List[TableMapping]:
    """Get all table mappings.
    
    Returns:
        List of table mappings
    """
    try:
        return mapping_manager.list_mappings()
    except Exception as e:
        logger.error(f"Error listing mappings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mapping/{mapping_id}")
async def get_mapping(mapping_id: str) -> TableMapping:
    """Get a table mapping by ID.
    
    Args:
        mapping_id: Mapping ID
        
    Returns:
        Table mapping
    """
    try:
        mapping = mapping_manager.get_mapping(mapping_id)
        if not mapping:
            raise HTTPException(status_code=404, detail="Mapping not found")
        return mapping
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting mapping: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/mapping/update")
async def update_mapping(mapping: TableMapping):
    """Update a table mapping.
    
    Args:
        mapping: Updated table mapping
        
    Returns:
        Success response
    """
    try:
        success, message = mapping_manager.update_mapping(mapping)
        if not success:
            raise HTTPException(status_code=400, detail=message)
        
        return {"success": True, "message": message}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating mapping: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/mapping/{mapping_id}")
async def delete_mapping(mapping_id: str):
    """Delete a table mapping.
    
    Args:
        mapping_id: Mapping ID to delete
        
    Returns:
        Success response
    """
    try:
        success, message = mapping_manager.delete_mapping(mapping_id)
        if not success:
            raise HTTPException(status_code=404, detail=message)
        
        return {"success": True, "message": message}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting mapping: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Working Set Management

@router.post("/workset/create")
async def create_workset(workset: WorkingSet):
    """Create a new working set.
    
    Args:
        workset: Working set configuration
        
    Returns:
        Success response
    """
    try:
        if config_manager.create_workset(workset):
            return {"success": True, "message": "Working set created", "workset_id": workset.id}
        else:
            raise HTTPException(status_code=400, detail="Working set ID already exists")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating working set: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workset/list")
async def list_worksets() -> List[WorkingSet]:
    """Get all working sets.
    
    Returns:
        List of working sets
    """
    try:
        return config_manager.get_all_worksets()
    except Exception as e:
        logger.error(f"Error listing working sets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workset/{workset_id}")
async def get_workset(workset_id: str) -> WorkingSet:
    """Get a working set by ID.
    
    Args:
        workset_id: Working set ID
        
    Returns:
        Working set
    """
    try:
        workset = config_manager.get_workset(workset_id)
        if not workset:
            raise HTTPException(status_code=404, detail="Working set not found")
        return workset
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting working set: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/workset/activate/{workset_id}")
async def activate_workset(workset_id: str):
    """Activate a working set.
    
    Args:
        workset_id: Working set ID to activate
        
    Returns:
        Success response
    """
    try:
        if config_manager.set_active_workset(workset_id):
            return {"success": True, "message": "Working set activated"}
        else:
            raise HTTPException(status_code=404, detail="Working set not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating working set: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workset/active")
async def get_active_workset():
    """Get active working set configuration.
    
    Returns:
        Active working set or None
    """
    try:
        active_workset = config_manager.get_active_workset()
        if not active_workset:
            return None
        
        return {
            "id": active_workset.id,
            "name": active_workset.name,
            "source_connection": active_workset.source_connection.dict(),
            "destination_connection": active_workset.destination_connection.dict()
        }
    except Exception as e:
        logger.error(f"Error getting active workset: {e}")
        return None


@router.delete("/workset/{workset_id}")
async def delete_workset(workset_id: str):
    """Delete a working set.
    
    Args:
        workset_id: Working set ID to delete
        
    Returns:
        Success response
    """
    try:
        if config_manager.delete_workset(workset_id):
            return {"success": True, "message": "Working set deleted"}
        else:
            raise HTTPException(status_code=404, detail="Working set not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting working set: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# DuckDB Script Management

@router.get("/duckdb/scripts/list")
async def list_duckdb_scripts(category: Optional[str] = None):
    """List available DuckDB transformation scripts.
    
    Args:
        category: Filter by category ('template' or 'custom')
        
    Returns:
        List of available scripts
    """
    try:
        scripts = duckdb_script_manager.list_scripts(category)
        return scripts
    except Exception as e:
        logger.error(f"Error listing DuckDB scripts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/duckdb/scripts/{script_name}")
async def get_duckdb_script(script_name: str):
    """Get DuckDB script content by name.
    
    Args:
        script_name: Name of the script
        
    Returns:
        Script content
    """
    try:
        content = duckdb_script_manager.get_script(script_name)
        if content:
            return {"success": True, "name": script_name, "content": content}
        else:
            raise HTTPException(status_code=404, detail=f"Script '{script_name}' not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting DuckDB script: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/duckdb/scripts/validate")
async def validate_duckdb_script(request: ScriptValidationRequest) -> ScriptValidationResponse:
    """Validate DuckDB script syntax.
    
    Args:
        request: Script validation request with content
        
    Returns:
        Validation result
    """
    try:
        is_valid, message = duckdb_script_manager.validate_script_syntax(request.content)
        return ScriptValidationResponse(valid=is_valid, message=message)
    except Exception as e:
        logger.error(f"Error validating DuckDB script: {e}")
        return ScriptValidationResponse(valid=False, message=str(e))


@router.post("/duckdb/scripts/save")
async def save_duckdb_script(
    script_name: str,
    content: str,
    category: str = 'custom',
    description: Optional[str] = None,
    overwrite: bool = False
):
    """Save a DuckDB transformation script.
    
    Args:
        script_name: Name for the script
        content: Script content
        category: 'template' or 'custom'
        description: Script description
        overwrite: Allow overwriting existing script
        
    Returns:
        Success response
    """
    try:
        success, message = duckdb_script_manager.save_script(
            script_name, content, category, description, overwrite
        )
        if success:
            return {"success": True, "message": message}
        else:
            raise HTTPException(status_code=400, detail=message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving DuckDB script: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/duckdb/scripts/{script_name}")
async def delete_duckdb_script(script_name: str, category: str = 'custom'):
    """Delete a DuckDB script.
    
    Args:
        script_name: Name of the script to delete
        category: 'custom' only (templates cannot be deleted)
        
    Returns:
        Success response
    """
    try:
        success, message = duckdb_script_manager.delete_script(script_name, category)
        if success:
            return {"success": True, "message": message}
        else:
            raise HTTPException(status_code=400, detail=message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting DuckDB script: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Visual Workflow Management

@router.get("/workflow/visual/list")
async def list_visual_workflows() -> List[WorkflowListItem]:
    """List all visual workflows.
    
    Returns:
        List of workflow summaries
    """
    try:
        return workflow_manager.list_workflows()
    except Exception as e:
        logger.error(f"Error listing workflows: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workflow/visual/{workflow_id}")
async def get_visual_workflow(workflow_id: str) -> VisualWorkflow:
    """Get a visual workflow by ID.
    
    Args:
        workflow_id: Workflow ID
        
    Returns:
        Visual workflow
    """
    try:
        workflow = workflow_manager.get_workflow(workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        return workflow
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workflow/visual/create")
async def create_visual_workflow(workflow: VisualWorkflow):
    """Create a new visual workflow.
    
    Args:
        workflow: Visual workflow to create
        
    Returns:
        Success response
    """
    try:
        success, message = workflow_manager.create_workflow(workflow)
        if success:
            return {"success": True, "message": message, "workflow_id": workflow.id}
        else:
            raise HTTPException(status_code=400, detail=message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/workflow/visual/update")
async def update_visual_workflow(workflow: VisualWorkflow):
    """Update an existing visual workflow.
    
    Args:
        workflow: Updated visual workflow
        
    Returns:
        Success response
    """
    try:
        success, message = workflow_manager.update_workflow(workflow)
        if success:
            return {"success": True, "message": message}
        else:
            raise HTTPException(status_code=400, detail=message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/workflow/visual/{workflow_id}")
async def delete_visual_workflow(workflow_id: str):
    """Delete a visual workflow.
    
    Args:
        workflow_id: Workflow ID to delete
        
    Returns:
        Success response
    """
    try:
        success, message = workflow_manager.delete_workflow(workflow_id)
        if success:
            return {"success": True, "message": message}
        else:
            raise HTTPException(status_code=404, detail=message)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workflow/validate/{workflow_id}")
async def validate_workflow(workflow_id: str) -> WorkflowValidationResult:
    """Validate a visual workflow.
    
    Args:
        workflow_id: Workflow ID to validate
        
    Returns:
        Validation result
    """
    try:
        workflow = workflow_manager.get_workflow(workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        return workflow_manager.validate_workflow(workflow)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/workflow/compile/{workflow_id}")
async def compile_workflow_to_mapping(workflow_id: str) -> WorkflowCompileResult:
    """Compile visual workflow into TableMapping.
    
    Args:
        workflow_id: Workflow ID to compile
        
    Returns:
        Compilation result with mapping ID
    """
    try:
        workflow = workflow_manager.get_workflow(workflow_id)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Compile workflow
        success, table_mapping, errors = workflow_converter.compile_workflow(workflow)
        
        if not success:
            return WorkflowCompileResult(
                success=False,
                message="Compilation failed",
                errors=errors
            )
        
        # Save the compiled mapping
        mapping_success, mapping_message = mapping_manager.create_mapping(table_mapping)
        
        if mapping_success:
            # Associate compiled mapping with workflow
            workflow_manager.set_compiled_mapping(workflow_id, table_mapping.id)
            
            return WorkflowCompileResult(
                success=True,
                mapping_id=table_mapping.id,
                message=f"Workflow compiled successfully to mapping '{table_mapping.id}'"
            )
        else:
            return WorkflowCompileResult(
                success=False,
                message=f"Workflow compiled but mapping creation failed: {mapping_message}",
                errors=[mapping_message]
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error compiling workflow: {e}")
        raise HTTPException(status_code=500, detail=str(e))






