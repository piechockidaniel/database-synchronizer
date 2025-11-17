"""Operations API endpoints for CDC monitoring control."""
from fastapi import APIRouter, HTTPException
import logging
from typing import Dict, Any, Optional
from backend.models.schemas import SyncStatus, OperationStatus
from backend.core.cdc_monitor import cdc_monitor
from backend.core.sync_engine import sync_engine
from backend.core.history_manager import history_manager
from backend.core.config_manager import config_manager
from backend.db.mssql_manager import connection_pool
from backend.core.duckdb_processor import duckdb_processor
from backend.core.snapshot_service import snapshot_service
from backend.core.latency_monitor import latency_monitor
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
        
        # Perform initial snapshots for mappings that require it
        snapshot_results = []
        for mapping in mappings:
            if mapping.perform_initial_snapshot and not mapping.snapshot_completed_at:
                logger.info(f"Performing initial snapshot for mapping: {mapping.id}")
                success, message, rows_processed = snapshot_service.perform_snapshot(
                    mapping,
                    source_conn,
                    dest_conn,
                    duckdb_processor
                )
                
                if success:
                    # Update mapping to mark snapshot as completed
                    mapping.snapshot_completed_at = datetime.now()
                    config_manager.update_mapping(mapping)
                    snapshot_results.append({
                        "mapping_id": mapping.id,
                        "success": True,
                        "rows_processed": rows_processed,
                        "message": message
                    })
                else:
                    snapshot_results.append({
                        "mapping_id": mapping.id,
                        "success": False,
                        "rows_processed": 0,
                        "message": message
                    })
                    logger.warning(f"Snapshot failed for mapping {mapping.id}: {message}")
        
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
        
        response = {
            "success": True,
            "message": f"Synchronization started for working set: {active_workset.name}",
            "workset_id": active_workset.id
        }
        
        if snapshot_results:
            response["snapshot_results"] = snapshot_results
        
        return response
        
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
        
        # Get latency statistics if destination connection is available
        latency_stats = {}
        dest_conn = connection_pool.get_destination()
        if dest_conn:
            try:
                latency_stats = latency_monitor.get_latency_statistics(dest_conn)
            except Exception as e:
                logger.warning(f"Could not get latency statistics: {e}")
        
        return {
            **sync_stats,
            'monitor_status': monitor_status,
            'latency_stats': latency_stats
        }
        
    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latency/stats")
async def get_latency_statistics(mapping_id: Optional[str] = None, hours: int = 24) -> Dict[str, Any]:
    """Get latency statistics.
    
    Args:
        mapping_id: Optional mapping ID to filter by
        hours: Number of hours to look back (default: 24)
    
    Returns:
        Latency statistics dictionary
    """
    try:
        dest_conn = connection_pool.get_destination()
        if not dest_conn:
            raise HTTPException(status_code=400, detail="No destination connection available")
        
        stats = latency_monitor.get_latency_statistics(dest_conn, mapping_id=mapping_id, hours=hours)
        return stats
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting latency statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latency/records")
async def get_latency_records(mapping_id: Optional[str] = None, limit: int = 100) -> Dict[str, Any]:
    """Get recent latency records.
    
    Args:
        mapping_id: Optional mapping ID to filter by
        limit: Maximum number of records to return (default: 100)
    
    Returns:
        Dictionary with latency records
    """
    try:
        dest_conn = connection_pool.get_destination()
        if not dest_conn:
            raise HTTPException(status_code=400, detail="No destination connection available")
        
        records = latency_monitor.get_recent_latency_records(dest_conn, mapping_id=mapping_id, limit=limit)
        return {
            "records": records,
            "count": len(records)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting latency records: {e}")
        raise HTTPException(status_code=500, detail=str(e))





