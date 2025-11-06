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


class ColumnMapping(BaseModel):
    """Column-to-column mapping."""
    source_column: str
    destination_column: str
    transformation: Optional[str] = None  # SQL expression for transformation


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





