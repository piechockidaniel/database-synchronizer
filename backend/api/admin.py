"""Administration API endpoints."""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
import logging
from backend.models.schemas import (
    ConnectionConfig, ConnectionTestResponse, DatabaseInfo,
    TableInfo, ColumnInfo, CDCEnableRequest, CDCStatusResponse,
    TableMapping, WorkingSet, ConnectionType
)
from backend.db.mssql_manager import MSSQLConnection, connection_pool
from backend.db.cdc_operations import CDCOperations
from backend.core.config_manager import config_manager
from backend.core.mapping_manager import mapping_manager

logger = logging.getLogger(__name__)

router = APIRouter()


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






