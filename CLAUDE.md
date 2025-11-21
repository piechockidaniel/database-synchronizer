# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Python-based MSSQL CDC (Change Data Capture) Database Synchronizer that enables real-time data synchronization between Microsoft SQL Server databases. The application features a FastAPI backend with a Bootstrap-based web UI, supporting complex table mappings, transformations, working sets, and a visual workflow designer.

## Essential Commands

### Running the Application
```bash
# Start the application (creates required directories automatically)
python main.py

# Application runs on http://localhost:8000
# API docs available at http://localhost:8000/docs
```

### Development Setup
```bash
# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Testing Database Connections
```bash
# Use the verify_setup.py script if available
python verify_setup.py

# Or test via API at http://localhost:8000/docs
# POST /api/admin/connect/test
```

## Architecture Overview

### Request Flow
```
Browser → FastAPI (Uvicorn) → API Router → Business Logic → Database Layer
   ↑                                                              ↓
   └──────────────── WebSocket (real-time events) ────────────────┘
```

### Core Components

**Backend Structure:**
- `backend/api/` - FastAPI routers (admin.py, operations.py, monitoring.py, web_routes.py)
- `backend/core/` - Business logic services
- `backend/db/` - Database managers (mssql_manager.py, cdc_operations.py)
- `backend/models/` - Pydantic schemas
- `backend/utils/` - Utility functions

**Frontend Structure:**
- `frontend/templates/` - Jinja2 HTML templates
- `frontend/static/` - JavaScript and CSS files
- WebSocket connections for real-time event streaming

### Critical Services

**CDCMonitor (`backend/core/cdc_monitor.py`):**
- Continuously polls CDC tables using asyncio
- Maintains LSN (Log Sequence Number) state for transaction tracking
- Queues CDC events for processing
- Key methods: `start()`, `stop()`, `_poll_changes()`

**SyncEngine (`backend/core/sync_engine.py`):**
- Consumes CDC events from the monitor queue
- Applies INSERT/UPDATE/DELETE operations to destination
- Records latency metrics automatically
- Handles transaction consistency

**SnapshotService (`backend/core/snapshot_service.py`):**
- Performs initial bulk data synchronization before CDC starts
- Batch processing (10,000 rows per batch) using `fast_executemany`
- One-time execution tracked by `snapshot_completed_at` timestamp

**LatencyMonitor (`backend/core/latency_monitor.py`):**
- Tracks synchronization delays (source change time → destination insert time)
- Stores metrics in `dbo.sync_latency_metrics` table
- Calculates percentiles (p95, p99) and statistics

**DuckDBProcessor (`backend/core/duckdb_processor.py`):**
- In-memory data transformation using DuckDB
- Supports complex SQL transformations
- Alternative to SQL Server transformations for performance

**ConfigManager (`backend/core/config_manager.py`):**
- Manages JSON-based configuration in `config/` directory
- Stores connections, mappings, working sets, and LSN state
- Files: `worksets.json`, `mappings.json`, `lsn_state.json`

**WorkflowManager (`backend/core/workflow_manager.py`):**
- Powers the visual workflow designer
- Converts node-based workflows to TableMapping configurations
- Validates workflow structure and dependencies

### Data Models (schemas.py)

**Key Enums:**
- `ConnectionType`: SOURCE, DESTINATION
- `CDCOperation`: INSERT, UPDATE, DELETE
- `TransformationEngine`: NONE, SQL, DUCKDB
- `AutoGenerateMode`: NONE, ON_INSERT, ON_INIT

**Core Models:**
- `ConnectionConfig`: Database connection details
- `ColumnMapping`: Column-to-column mapping with transformations
- `TableMapping`: Complete table synchronization configuration
- `WorkingSet`: Groups connections and mappings into deployable units
- `CDCEvent`: Represents a change event from CDC tables

### Column Mapping Features

**Transformation Types:**
- Direct mapping: `source_column → destination_column`
- Many-to-one with JSON: `source_columns → JSON_OBJECT(...) → destination_column`
- SQL expressions: Custom transformations
- DuckDB transformations: Complex in-memory processing

**Column Controls:**
- `ignore_changes`: Skip syncing this column
- `auto_generate`: Generate values (NEWID(), GETDATE(), etc.)
- `default_value`: Fallback if source is NULL
- `transformation_engine`: Choose SQL or DuckDB

### Working Sets

Working sets are the deployment unit for synchronization:
- Contain source/destination connections
- Reference one or more table mappings by ID
- Only one can be active at a time
- Managed via GUI or API

**Active Working Set Flow:**
1. Create working set with connections and mappings
2. Activate it (sets `is_active: true`, deactivates others)
3. Start synchronization in Operations tab
4. CDC Monitor uses active working set's configuration

## Important Implementation Details

### LSN State Management
- LSN (Log Sequence Number) tracks CDC position
- Stored as hex strings in `lsn_state.json`
- Converted to/from bytes for CDC queries
- Prevents reprocessing changes after restart

### Snapshot Execution
- Triggered automatically on sync start if `perform_initial_snapshot: true`
- Only runs once (checked via `snapshot_completed_at`)
- Truncates destination table before bulk insert
- Uses `pyodbc` with `fast_executemany=True` for performance

### Latency Tracking
- Automatic for INSERT and UPDATE operations
- Detects source timestamp columns (CreatedDate, ModifiedDate, etc.)
- Falls back to CDC event timestamp if no source timestamp found
- Metrics queryable via `/api/operations/latency/stats`

### Real-time Events
- WebSocket endpoint: `/api/monitoring/events`
- Broadcasts CDC events to connected clients
- Used by Monitoring tab for live event streaming

### Configuration Persistence
- All configurations stored in JSON files under `config/`
- History logs stored in `history/` with daily rotation
- No database required for application configuration

## Common Development Patterns

### Adding a New API Endpoint
1. Add route function in appropriate router (`backend/api/admin.py`, etc.)
2. Use Pydantic models for request/response validation
3. Call business logic from `backend/core/` services
4. Return JSON responses with proper error handling

### Adding a New Transformation Type
1. Update `ColumnMapping` in `schemas.py` if needed
2. Implement transformation logic in `sync_engine.py` or `duckdb_processor.py`
3. Update frontend UI in `admin.js` for configuration
4. Test with various data types

### Adding a New Feature to Working Sets
1. Update `WorkingSet` model in `schemas.py`
2. Modify `config_manager.py` save/load methods
3. Update API endpoints in `admin.py`
4. Update frontend in `admin.js` and `admin.html`

## Visual Workflow Designer

The visual designer is a low-code/no-code interface:
- Node-based workflow builder (drag and drop)
- Compiles to `TableMapping` configurations
- Located at `/admin` → Visual Designer tab
- JavaScript: `frontend/static/workflow-designer.js`
- CSS: `frontend/static/workflow-designer.css`

**Node Categories:**
- Sources: Database, Table, CDC
- Transformations: JSON, Concat, Filter, Dedupe
- Destinations: Database, Table
- Control Flow: Start, Stop, Condition
- Operators: Logger, Notification

**Workflow → Mapping Conversion:**
- `WorkflowManager.compile_workflow()` validates and converts
- Generates unique mapping ID with `mapping_workflow_` prefix
- Saved to `mappings.json` like any other mapping

## Database Requirements

### Source Database (MSSQL)
- SQL Server 2016+ required
- CDC must be enabled at database level: `EXEC sys.sp_cdc_enable_db`
- CDC must be enabled per table: `EXEC sys.sp_cdc_enable_table`
- SQL Server Agent must be running
- Requires sysadmin privileges to enable CDC

### Destination Database (MSSQL)
- SQL Server 2016+ required
- Tables must exist before synchronization
- Requires INSERT, UPDATE, DELETE permissions
- Optional: `dbo.sync_latency_metrics` table for latency tracking

### Connection Details
- Uses pyodbc with ODBC Driver 17 or 18 for SQL Server
- Supports Windows Authentication and SQL Authentication
- Connection pooling implemented in `mssql_manager.py`
- Default port: 1433

## Configuration Files

### config/worksets.json
```json
[
  {
    "id": "workset_001",
    "name": "Production Sync",
    "source_connection": {...},
    "destination_connection": {...},
    "table_mappings": ["mapping_001"],
    "is_active": true
  }
]
```

### config/mappings.json
```json
[
  {
    "id": "mapping_001",
    "source_schema": "dbo",
    "source_table": "Customers",
    "destination_schema": "dbo",
    "destination_table": "Customers_Copy",
    "column_mappings": [...],
    "perform_initial_snapshot": false,
    "use_duckdb_transformation": false
  }
]
```

### config/lsn_state.json
```json
{
  "dbo.Customers": "0000001234567890abcd",
  "dbo.Orders": "0000001234567890beef"
}
```

## Error Handling Patterns

### Connection Errors
- Always test connections before saving (`/api/admin/connect/test`)
- Provide detailed error messages including server name and database
- Use try/except with specific error types (pyodbc.Error)

### CDC Errors
- Check CDC enabled status before operations
- Validate table names exist in database
- Handle LSN parsing errors gracefully

### Synchronization Errors
- Log errors to `history/cdc_events_*.json`
- Continue processing after single record failures
- Track error counts in statistics

## Performance Considerations

### Snapshot Performance
- Batch size: 10,000 rows (configurable in `SnapshotService`)
- Use `fast_executemany` for bulk inserts
- Process large tables without loading entire dataset

### CDC Polling
- Default poll interval: 5 seconds
- Configurable in `CDCMonitor.poll_interval`
- Adjust based on change volume

### Transformation Performance
- DuckDB transformations are in-memory (faster for complex operations)
- SQL transformations run on destination server
- Choose based on data volume and transformation complexity

## Testing Strategy

### Manual Testing via UI
1. Configure connections in Administration tab
2. Create mappings with various transformation types
3. Create and activate working set
4. Start synchronization in Operations tab
5. Monitor live events and statistics

### API Testing
- Use Swagger UI at http://localhost:8000/docs
- Test all CRUD operations for mappings and working sets
- Verify CDC operations (enable/disable)
- Check latency statistics endpoints

### Database Testing
```sql
-- Insert test data in source
INSERT INTO CDCSourceDB.dbo.Customers VALUES (...)

-- Wait for sync (5-10 seconds)

-- Verify in destination
SELECT * FROM CDCDestDB.dbo.Customers WHERE ...
```

## Troubleshooting Guide

### "Application won't start"
- Check Python version (3.9+)
- Verify all dependencies installed (`pip install -r requirements.txt`)
- Check port 8000 is available
- Review `app.log` for errors

### "Connection test failed"
- Verify server name and port (default 1433)
- Check SQL Server allows remote connections
- Test with SQL Server Management Studio first
- Verify credentials if using SQL auth
- Ensure ODBC driver installed

### "CDC not capturing changes"
- Verify SQL Server Agent is running
- Check CDC enabled on database and tables
- Verify LSN state is advancing (`lsn_state.json`)
- Check CDC cleanup job hasn't removed changes

### "Synchronization is slow"
- Check network latency between servers
- Review transformation complexity
- Monitor `sync_latency_metrics` table
- Consider increasing batch sizes
- Check destination table indexes

### "Latency metrics not recording"
- Verify `sync_latency_metrics` table exists in destination
- Check permissions for INSERT on metrics table
- Review source table for timestamp columns
- SQL Server 2012+ required for PERCENTILE_CONT

## Key Files to Understand

1. `main.py` - Application entry point
2. `backend/api/app.py` - FastAPI setup and router registration
3. `backend/core/cdc_monitor.py` - CDC polling logic
4. `backend/core/sync_engine.py` - Synchronization execution
5. `backend/models/schemas.py` - All data models
6. `backend/core/config_manager.py` - Configuration persistence
7. `frontend/static/admin.js` - Admin UI logic (largest JS file)

## Dependencies

Key dependencies and their purposes:
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `pyodbc` - SQL Server connectivity
- `duckdb` - In-memory data processing
- `pydantic` - Data validation
- `websockets` - Real-time event streaming
- `jinja2` - HTML templating

## Security Considerations

- Passwords stored in plain text in JSON config files (consider encryption)
- No authentication on web UI (add auth for production)
- Use Windows Authentication when possible
- Restrict network access to application port
- Use least-privilege database accounts
- Regularly rotate credentials

## Recent Features

### Snapshot Functionality
- Perform initial bulk sync before CDC starts
- Configurable per mapping with `perform_initial_snapshot`
- One-time execution with completion tracking

### Latency Monitoring
- Track sync delays from source to destination
- Store metrics with percentile calculations
- API endpoints for stats and recent records

### Visual Workflow Designer
- Node-based low-code workflow builder
- Compiles to standard TableMapping configurations
- Supports complex transformation pipelines

### Working Sets GUI
- Full CRUD operations via web UI
- Connection testing before save
- Visual mapping selection
- One-click activation/deactivation
