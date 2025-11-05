"""Operations API endpoints for CDC monitoring control."""
from fastapi import APIRouter, HTTPException
import logging
from typing import Dict, Any
from backend.models.schemas import SyncStatus, OperationStatus
from backend.core.cdc_monitor import cdc_monitor
from backend.core.sync_engine import sync_engine
from backend.core.history_manager import history_manager
from backend.core.config_manager import config_manager
from backend.db.mssql_manager import connection_pool
from backend.core.duckdb_processor import duckdb_processor
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start")
async def start_synchronization():
    """Start CDC monitoring and synchronization.
    
    Returns:
        Success response
    """
    try:
        # Get active working set
        active_workset = config_manager.get_active_workset()
        if not active_workset:
            raise HTTPException(status_code=400, detail="No active working set configured")
        
        # Set up connections
        source_conn = connection_pool.set_source(active_workset.source_connection)
        dest_conn = connection_pool.set_destination(active_workset.destination_connection)
        
        # Get mappings for working set
        mappings = config_manager.get_mappings_for_workset(active_workset.id)
        if not mappings:
            raise HTTPException(status_code=400, detail="No table mappings configured in working set")
        
        # Configure CDC monitor
        cdc_monitor.set_connection(source_conn)
        cdc_monitor.set_mappings(mappings)
        
        # Configure sync engine
        sync_engine.set_destination_connection(dest_conn)
        sync_engine.set_duckdb_processor(duckdb_processor)
        
        # Add history logging listener
        def log_to_history(event, status, error):
            history_manager.log_event(event, status, error)
        
        sync_engine.add_event_listener(log_to_history)
        
        # Start CDC monitor
        await cdc_monitor.start()
        
        # Start sync engine
        await sync_engine.start()
        
        logger.info(f"Started synchronization for working set: {active_workset.name}")
        
        return {
            "success": True,
            "message": f"Synchronization started for working set: {active_workset.name}",
            "workset_id": active_workset.id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting synchronization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stop")
async def stop_synchronization():
    """Stop CDC monitoring and synchronization.
    
    Returns:
        Success response
    """
    try:
        # Stop sync engine
        await sync_engine.stop()
        
        # Stop CDC monitor
        await cdc_monitor.stop()
        
        # Flush any pending history events
        history_manager.flush_buffer()
        
        logger.info("Stopped synchronization")
        
        return {
            "success": True,
            "message": "Synchronization stopped"
        }
        
    except Exception as e:
        logger.error(f"Error stopping synchronization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pause")
async def pause_synchronization():
    """Pause CDC monitoring.
    
    Returns:
        Success response
    """
    try:
        cdc_monitor.pause()
        
        logger.info("Paused synchronization")
        
        return {
            "success": True,
            "message": "Synchronization paused"
        }
        
    except Exception as e:
        logger.error(f"Error pausing synchronization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resume")
async def resume_synchronization():
    """Resume CDC monitoring.
    
    Returns:
        Success response
    """
    try:
        cdc_monitor.resume()
        
        logger.info("Resumed synchronization")
        
        return {
            "success": True,
            "message": "Synchronization resumed"
        }
        
    except Exception as e:
        logger.error(f"Error resuming synchronization: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_status() -> SyncStatus:
    """Get current synchronization status.
    
    Returns:
        Synchronization status
    """
    try:
        monitor_status = cdc_monitor.get_status()
        stats = sync_engine.get_statistics()
        active_workset = config_manager.get_active_workset()
        
        # Determine overall status
        if monitor_status['is_running']:
            if monitor_status['is_paused']:
                status = OperationStatus.PAUSED
            else:
                status = OperationStatus.RUNNING
        else:
            status = OperationStatus.STOPPED
        
        # Get current LSN (simplified - would need to be more sophisticated)
        current_lsn = None
        
        return SyncStatus(
            status=status,
            working_set_id=active_workset.id if active_workset else None,
            working_set_name=active_workset.name if active_workset else None,
            start_time=datetime.fromisoformat(stats['start_time']) if stats['start_time'] else None,
            events_processed=stats['successful_events'],
            errors_count=stats['failed_events'],
            current_lsn=current_lsn,
            last_event_time=datetime.fromisoformat(stats['last_event_time']) if stats['last_event_time'] else None
        )
        
    except Exception as e:
        logger.error(f"Error getting status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics")
async def get_statistics() -> Dict[str, Any]:
    """Get detailed synchronization statistics.
    
    Returns:
        Statistics dictionary
    """
    try:
        sync_stats = sync_engine.get_statistics()
        monitor_status = cdc_monitor.get_status()
        
        return {
            **sync_stats,
            'monitor_status': monitor_status
        }
        
    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))





