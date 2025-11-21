"""Pydantic models for API requests and responses."""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class ConnectionType(str, Enum):
    """Connection type enum."""
    SOURCE = "source"
    DESTINATION = "destination"


class ConnectionConfig(BaseModel):
    """Database connection configuration."""
    name: str = Field(..., description="Connection name")
    server: str = Field(..., description="Server address")
    database: str = Field(..., description="Database name")
    username: Optional[str] = Field(None, description="Username for authentication")
    password: Optional[str] = Field(None, description="Password for authentication")
    use_windows_auth: bool = Field(default=True, description="Use Windows authentication")
    port: int = Field(default=1433, description="Server port")
    driver: str = Field(default="ODBC Driver 18 for SQL Server", description="ODBC driver name")


class ConnectionTestResponse(BaseModel):
    """Response for connection test."""
    success: bool
    message: str
    server_version: Optional[str] = None


class DatabaseInfo(BaseModel):
    """Database information."""
    name: str
    cdc_enabled: bool = False


class TableInfo(BaseModel):
    """Table information."""
    schema_name: str
    table_name: str
    full_name: str
    cdc_enabled: bool = False
    row_count: Optional[int] = None


class ColumnInfo(BaseModel):
    """Column information."""
    column_name: str
    data_type: str
    is_nullable: bool
    max_length: Optional[int] = None
    is_primary_key: bool = False


class AutoGenerateMode(str, Enum):
    """Auto-generate mode for columns."""
    NONE = "none"  # No auto-generation
    ON_INSERT = "on_insert"  # Generate on every insert
    ON_INIT = "on_init"  # Generate only on initial insert (once)


class TransformationEngine(str, Enum):
    """Transformation engine type."""
    NONE = "none"  # No transformation
    SQL = "sql"  # SQL Server native transformation
    DUCKDB = "duckdb"  # DuckDB in-memory transformation


class ColumnMapping(BaseModel):
    """Column-to-column mapping.
    
    Supports:
    - Simple 1:1 mapping (source_column -> destination_column)
    - Many-to-one mapping (source_columns list -> destination_column with transformation)
    - Column-level controls (ignore, auto-generate, default values)
    - DuckDB in-memory transformations
    """
    source_column: Optional[str] = None  # For single column mapping (backward compatible)
    source_columns: Optional[List[str]] = None  # For multiple columns (e.g., JSON aggregation)
    destination_column: str
    transformation: Optional[str] = None  # SQL expression for transformation (e.g., 'JSON_OBJECT', 'CONCAT')
    transformation_type: Optional[str] = None  # Helper: 'json', 'concat', 'custom', 'duckdb', None for direct mapping
    transformation_engine: TransformationEngine = TransformationEngine.SQL  # Engine to use for transformation
    
    # Column control options
    ignore_changes: bool = False  # If True, column changes are not synced (skipped)
    auto_generate: AutoGenerateMode = AutoGenerateMode.NONE  # Auto-generate value for destination column
    auto_generate_expression: Optional[str] = None  # SQL expression for auto-generation (e.g., 'NEWID()', 'GETDATE()')
    default_value: Optional[str] = None  # Default value if source is NULL or missing (can be SQL expression)


class TableMapping(BaseModel):
    """Table mapping configuration."""
    id: str = Field(..., description="Unique mapping ID")
    source_schema: str
    source_table: str
    destination_schema: str
    destination_table: str
    column_mappings: List[ColumnMapping]
    enabled: bool = True
    sync_deletes: bool = True
    sync_updates: bool = True
    sync_inserts: bool = True
    
    # DuckDB transformation options
    use_duckdb_transformation: bool = False  # Enable DuckDB in-memory staging/transformation
    duckdb_script_name: Optional[str] = None  # Name of DuckDB script file to use
    duckdb_script_content: Optional[str] = None  # Inline DuckDB SQL script (alternative to file)
    
    # Initial snapshot options
    perform_initial_snapshot: bool = False  # If True, perform initial snapshot before CDC monitoring
    snapshot_completed_at: Optional[datetime] = None  # Timestamp when snapshot was completed (prevents re-running)


class SQLMapping(BaseModel):
    """SQL-based mapping configuration.
    
    Allows synchronization based on custom SQL queries instead of table-to-table mappings.
    Useful for complex transformations, aggregations, or multi-table joins.
    """
    id: str = Field(..., description="Unique mapping ID")
    name: str = Field(..., description="Mapping name/description")
    source_query: str = Field(..., description="SQL query to extract data from source database")
    destination_schema: str = Field(..., description="Destination schema name")
    destination_table: str = Field(..., description="Destination table name")
    insert_query: Optional[str] = Field(None, description="Custom INSERT query template (optional, auto-generated if not provided)")
    update_query: Optional[str] = Field(None, description="Custom UPDATE query template (optional)")
    delete_query: Optional[str] = Field(None, description="Custom DELETE query template (optional)")
    
    # Sync options
    enabled: bool = True
    sync_mode: str = Field(default="full", description="Sync mode: 'full' (replace all), 'incremental' (append only), 'upsert' (merge)")
    sync_schedule: Optional[str] = Field(None, description="Cron expression for scheduled sync (optional)")
    
    # Key columns for upsert/update/delete operations
    key_columns: Optional[List[str]] = Field(None, description="Column names that uniquely identify a row (for upsert/update/delete)")
    
    # Execution options
    batch_size: int = Field(default=1000, description="Batch size for processing records")
    timeout_seconds: int = Field(default=300, description="Query timeout in seconds")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    last_run_at: Optional[datetime] = None
    last_run_status: Optional[str] = None  # success, failed, running
    last_run_error: Optional[str] = None


class WorkingSet(BaseModel):
    """Working set configuration."""
    id: str = Field(..., description="Unique working set ID")
    name: str = Field(..., description="Working set name")
    description: Optional[str] = None
    source_connection: ConnectionConfig
    destination_connection: ConnectionConfig
    table_mappings: List[str] = Field(default_factory=list, description="List of mapping IDs")
    is_active: bool = False
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class CDCEnableRequest(BaseModel):
    """Request to enable CDC."""
    connection_type: ConnectionType
    database: Optional[str] = None
    schema_name: Optional[str] = None
    table_name: Optional[str] = None
    capture_instance: Optional[str] = None


class CDCStatusResponse(BaseModel):
    """CDC status response."""
    database: str
    cdc_enabled: bool
    tables: List[Dict[str, Any]] = Field(default_factory=list)


class OperationStatus(str, Enum):
    """Operation status enum."""
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPING = "stopping"
    ERROR = "error"


class SyncStatus(BaseModel):
    """Synchronization status."""
    status: OperationStatus
    working_set_id: Optional[str] = None
    working_set_name: Optional[str] = None
    start_time: Optional[datetime] = None
    events_processed: int = 0
    errors_count: int = 0
    current_lsn: Optional[str] = None
    last_event_time: Optional[datetime] = None


class CDCOperation(str, Enum):
    """CDC operation types."""
    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


class CDCEvent(BaseModel):
    """CDC event."""
    id: str
    timestamp: datetime
    source_table: str
    operation: CDCOperation
    lsn: str
    seqval: str
    data: Dict[str, Any]
    status: str = "pending"  # pending, processed, failed
    error: Optional[str] = None
    source_change_time: Optional[datetime] = None  # Original timestamp from source table (for latency tracking)


class SyncStatistics(BaseModel):
    """Synchronization statistics."""
    total_events: int = 0
    successful_events: int = 0
    failed_events: int = 0
    events_per_second: float = 0.0
    average_latency_ms: float = 0.0
    uptime_seconds: float = 0.0


class VerificationRequest(BaseModel):
    """Data quality verification request."""
    mapping_id: str
    sample_size: int = Field(default=100, description="Number of random records to verify")
    check_row_counts: bool = True
    check_reverse_mapping: bool = True


class VerificationResult(BaseModel):
    """Data quality verification result."""
    mapping_id: str
    timestamp: datetime
    source_row_count: int
    destination_row_count: int
    row_count_match: bool
    samples_checked: int
    samples_matched: int
    reverse_mapping_success_rate: float
    mismatches: List[Dict[str, Any]] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)





