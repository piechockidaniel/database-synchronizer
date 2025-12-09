# Multi-Source Architecture Design Document

**Status:** Foundation Implemented, Advanced Features Designed
**Created:** 2025-12-09
**Purpose:** Complete architectural blueprint for multi-source data synchronization with visual merge builder

---

## ✅ PHASE 1: CONNECTION LIBRARY (IMPLEMENTED)

### What's Working Now

**Backend (`backend/core/config_manager.py`):**
- `load_connections()` - Loads saved connections from `config/connections.json`
- `save_connections()` - Persists connections to disk
- `get_all_connections()` - Retrieve all saved connections
- `get_connection(id)` - Get specific connection by ID
- `save_connection(id, data)` - Save/create new connection
- `update_connection(id, data)` - Update existing connection
- `delete_connection(id)` - Remove connection from library

**API Endpoints (`backend/api/admin.py`):**
- `GET /api/admin/connection/list` - List all connections
- `GET /api/admin/connection/{id}` - Get connection details
- `POST /api/admin/connection/save` - Save new connection
- `PUT /api/admin/connection/update` - Update connection
- `DELETE /api/admin/connection/{id}` - Delete connection

**Data Structure (`config/connections.json`):**
```json
{
  "conn_crm_prod": {
    "id": "conn_crm_prod",
    "name": "CRM Production",
    "server": "crm-server.company.com",
    "database": "CRM_DB",
    "username": "sync_user",
    "password": "encrypted_password",
    "use_windows_auth": false,
    "port": 1433,
    "driver": "ODBC Driver 18 for SQL Server"
  },
  "conn_erp_prod": {
    "id": "conn_erp_prod",
    "name": "ERP Production",
    ...
  }
}
```

### Next Steps for Phase 1
1. Create "Connections" tab in admin UI
2. Build connection management interface (CRUD operations)
3. Add "Quick Save" button in WorkingSet editor
4. Enable connection selection by ID/name in wizard

---

## 📐 PHASE 2: MULTI-SOURCE MAPPING MODEL (DESIGN)

### Extended Mapping Schema

**New `Mapping` fields:**
```python
class Mapping(BaseModel):
    # ... existing fields ...

    # Multi-source support
    is_multi_source: bool = False
    sources: List[SourceConfig] = Field(default_factory=list)
    merge_pattern: Optional[MergePattern] = None

    # Legacy single source (for backward compatibility)
    source_schema: Optional[str] = None  # Deprecated when is_multi_source=True
    source_table: Optional[str] = None   # Deprecated when is_multi_source=True
```

**New Model: `SourceConfig`**
```python
class SourceConfig(BaseModel):
    """Configuration for a single source in multi-source mapping."""
    id: str = Field(..., description="Unique source identifier within mapping")
    connection_id: str = Field(..., description="Reference to saved connection")
    alias: str = Field(..., description="Alias used in merge operations (e.g., 'crm', 'erp')")
    schema: str = Field(..., description="Schema name")
    table: str = Field(..., description="Table name")

    # CDC tracking (per source)
    enable_cdc: bool = True
    cdc_capture_instance: Optional[str] = None

    # Filtering
    where_clause: Optional[str] = Field(None, description="Optional WHERE condition for this source")
```

**New Model: `MergePattern`**
```python
class MergeOperationType(str, Enum):
    """Types of merge operations."""
    JOIN = "join"           # SQL JOIN (INNER, LEFT, RIGHT, FULL)
    UNION = "union"         # Vertical stacking (UNION or UNION ALL)
    INTERSECT = "intersect" # Common rows only
    EXCEPT = "except"       # Rows in first but not second
    CUSTOM = "custom"       # Custom SQL expression

class MergeOperation(BaseModel):
    """Single merge operation in a pipeline."""
    type: MergeOperationType
    left_source: str = Field(..., description="Left source alias or 'previous_result'")
    right_source: str = Field(..., description="Right source alias")

    # For JOIN operations
    join_type: Optional[str] = Field(None, description="INNER, LEFT, RIGHT, FULL")
    on_condition: Optional[str] = Field(None, description="JOIN condition (e.g., 'left.id = right.customer_id')")

    # For UNION operations
    union_all: bool = True  # True = UNION ALL, False = UNION (distinct)

    # Custom SQL
    custom_expression: Optional[str] = None

class MergePattern(BaseModel):
    """Defines how multiple sources are merged."""
    operations: List[MergeOperation] = Field(..., description="Ordered list of merge operations")
    output_columns: List[OutputColumnMapping] = Field(..., description="Final column selection and mapping")

class OutputColumnMapping(BaseModel):
    """Maps source columns to destination columns in merge result."""
    source_alias: str = Field(..., description="Source alias (e.g., 'crm', 'erp')")
    source_column: str
    destination_column: str
    transformation: Optional[str] = None
```

### Example Multi-Source Mapping

**Customer 360 View (CRM + ERP + Support):**
```json
{
  "id": "mapping_customer_360",
  "name": "Customer 360 View",
  "mapping_type": "table",
  "is_multi_source": true,
  "sources": [
    {
      "id": "src_crm",
      "connection_id": "conn_crm_prod",
      "alias": "crm",
      "schema": "dbo",
      "table": "Customers",
      "enable_cdc": true
    },
    {
      "id": "src_erp",
      "connection_id": "conn_erp_prod",
      "alias": "erp",
      "schema": "dbo",
      "table": "CustomerOrders",
      "enable_cdc": true
    },
    {
      "id": "src_support",
      "connection_id": "conn_support_prod",
      "alias": "support",
      "schema": "dbo",
      "table": "Tickets",
      "enable_cdc": false,
      "where_clause": "status = 'open'"
    }
  ],
  "merge_pattern": {
    "operations": [
      {
        "type": "join",
        "left_source": "crm",
        "right_source": "erp",
        "join_type": "LEFT",
        "on_condition": "crm.customer_id = erp.customer_id"
      },
      {
        "type": "join",
        "left_source": "previous_result",
        "right_source": "support",
        "join_type": "LEFT",
        "on_condition": "customer_id = support.customer_id"
      }
    ],
    "output_columns": [
      {"source_alias": "crm", "source_column": "customer_id", "destination_column": "customer_id"},
      {"source_alias": "crm", "source_column": "name", "destination_column": "customer_name"},
      {"source_alias": "erp", "source_column": "total_amount", "destination_column": "lifetime_value"},
      {"source_alias": "support", "source_column": "open_count", "destination_column": "active_tickets"}
    ]
  },
  "destination_schema": "dbo",
  "destination_table": "Customer360"
}
```

---

## 🎨 PHASE 3: VISUAL MERGE BUILDER (DESIGN)

### UI Component Architecture

**Location:** `/admin` → "Mappings" tab → "Create Multi-Source Mapping" button

**Canvas Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Multi-Source Merge Builder                         [Save]   │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐  Toolbox                                    │
│ │ Sources     │  ┌──────────────────────────────────────┐  │
│ │ ───────     │  │  [+] Add Source                       │  │
│ │ • Database  │  │  [⚡] Join                            │  │
│ │ • Table     │  │  [⬍] Union                           │  │
│ │ • Query     │  │  [∩] Intersect                       │  │
│ │             │  │  [−] Except                          │  │
│ │ Operations  │  └──────────────────────────────────────┘  │
│ │ ───────     │                                             │
│ │ • JOIN      │  Design Canvas                              │
│ │ • UNION     │  ┌──────────────────────────────────────┐  │
│ │ • Filter    │  │  ┌──────┐                            │  │
│ │ • Transform │  │  │ CRM  │──┐                         │  │
│ │             │  │  │ Cust │  │  ┌──────────┐           │  │
│ │ Output      │  │  └──────┘  └→ │  JOIN    │──┐        │  │
│ │ ───────     │  │               │ LEFT ON  │  │        │  │
│ │ • Map Cols  │  │  ┌──────┐  ┌→ │ id=cust  │  │        │  │
│ │ • Preview   │  │  │ ERP  │──┘  └──────────┘  │        │  │
│ └─────────────┘  │  │Orders│                   │        │  │
│                  │  └──────┘       ┌──────────┐│        │  │
│                  │                  │  JOIN    ├┘        │  │
│                  │  ┌──────┐     ┌→│ LEFT ON  │         │  │
│                  │  │Supprt│─────┘ │ id=cust  │→[Dest] │  │
│                  │  │Tickt │       └──────────┘         │  │
│                  │  └──────┘                            │  │
│                  └──────────────────────────────────────┘  │
│                                                             │
│ Preview Results (First 10 rows)                            │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ customer_id │ name      │ lifetime_value │ tickets │    ││
│ │ ─────────── │ ────────  │ ──────────────  │ ─────── │   ││
│ │ 1001        │ Acme Corp │ $125,000       │ 3       │    ││
│ │ 1002        │ Tech Inc  │ $89,500        │ 0       │    ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Drag-and-Drop Behavior

**Adding Sources:**
1. User clicks "[+] Add Source"
2. Modal appears with connection selector
3. Select connection → schema → table
4. Enter alias (auto-suggested: "src1", "src2", etc.)
5. Source node appears on canvas

**Creating Joins:**
1. Drag "JOIN" operation from toolbox onto canvas
2. Connect output from Source A to JOIN input
3. Connect output from Source B to JOIN input
4. Click JOIN node to configure:
   - Join type (INNER, LEFT, RIGHT, FULL)
   - ON condition (with autocomplete for columns)

**Creating Unions:**
1. Drag "UNION" from toolbox
2. Connect multiple sources to UNION node
3. Configure: UNION vs UNION ALL

### JavaScript Implementation Outline

```javascript
// frontend/static/multi-source-builder.js

class MultiSourceBuilder {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.nodes = [];  // Source and operation nodes
        this.connections = [];  // Lines between nodes
        this.jsPlumbInstance = jsPlumb.getInstance();
        this.initCanvas();
    }

    addSourceNode(connectionId, schema, table, alias) {
        const node = {
            id: `node_${Date.now()}`,
            type: 'source',
            connectionId,
            schema,
            table,
            alias,
            x: 100,
            y: 100
        };
        this.nodes.push(node);
        this.renderNode(node);
    }

    addJoinNode(leftNodeId, rightNodeId, joinType, onCondition) {
        const node = {
            id: `node_${Date.now()}`,
            type: 'join',
            joinType,
            onCondition,
            inputs: [leftNodeId, rightNodeId]
        };
        this.nodes.push(node);
        this.renderNode(node);
    }

    compile() {
        // Convert visual design to MergePattern JSON
        const sources = this.nodes.filter(n => n.type === 'source');
        const operations = this.buildOperationPipeline();

        return {
            is_multi_source: true,
            sources: sources.map(s => ({
                id: s.id,
                connection_id: s.connectionId,
                alias: s.alias,
                schema: s.schema,
                table: s.table
            })),
            merge_pattern: {
                operations: operations,
                output_columns: this.getOutputColumnMappings()
            }
        };
    }

    buildOperationPipeline() {
        // Topological sort of nodes to build execution order
        // Convert node graph to linear operation list
    }

    preview() {
        // Call API to execute merge pattern and return sample data
        const pattern = this.compile();
        fetch('/api/admin/mapping/preview-merge', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(pattern)
        })
        .then(r => r.json())
        .then(data => this.renderPreview(data.rows));
    }
}
```

---

## 🔄 PHASE 4: MULTI-SOURCE CDC (DESIGN)

### Challenge

Traditional CDC monitors ONE source database. Multi-source CDC must:
1. Monitor CDC events from MULTIPLE sources simultaneously
2. Coordinate timing (Source A changed at T1, Source B changed at T2)
3. Handle merge conflicts (same customer updated in CRM and ERP)
4. Maintain transactional consistency across sources

### Architecture

**Parallel CDC Monitoring:**
```python
# backend/core/multi_source_cdc_monitor.py

class MultiSourceCDCMonitor:
    """Monitor CDC events from multiple sources simultaneously."""

    def __init__(self, mapping: Mapping):
        self.mapping = mapping
        self.source_monitors = {}  # {source_id: CDCMonitor}
        self.event_queue = asyncio.Queue()
        self.is_running = False

    async def start(self):
        """Start monitoring all sources."""
        for source in self.mapping.sources:
            if source.enable_cdc:
                monitor = CDCMonitor(
                    connection=get_connection(source.connection_id),
                    schema=source.schema,
                    table=source.table
                )
                self.source_monitors[source.id] = monitor
                asyncio.create_task(self._monitor_source(source.id, monitor))

        # Start coordinator
        asyncio.create_task(self._coordinate_events())
        self.is_running = True

    async def _monitor_source(self, source_id: str, monitor: CDCMonitor):
        """Monitor a single source and queue events."""
        while self.is_running:
            events = await monitor.get_changes()
            for event in events:
                event.source_id = source_id  # Tag with source
                await self.event_queue.put(event)
            await asyncio.sleep(5)

    async def _coordinate_events(self):
        """Coordinate events from multiple sources."""
        while self.is_running:
            event = await self.event_queue.get()

            # Apply merge pattern to event
            if await self._should_process_event(event):
                merged_event = await self._apply_merge_pattern(event)
                await self._sync_to_destination(merged_event)
```

**Event Coordination Strategies:**

1. **Immediate Processing (Simple)**
   - Process each CDC event as it arrives
   - Re-execute merge pattern for affected rows
   - Example: CRM customer updated → re-run join with ERP/Support → update destination

2. **Batch Processing (Efficient)**
   - Collect events for N seconds
   - Group by affected keys (customer_id)
   - Execute merge pattern once per key
   - Reduces redundant joins

3. **Transaction Coordination (Complex)**
   - Track logical transaction boundaries across sources
   - Wait for related changes across sources before merging
   - Example: CRM customer + ERP order updated in same logical transaction

**Merge Conflict Resolution:**

```python
class ConflictResolutionStrategy(str, Enum):
    LATEST_WINS = "latest_wins"           # Most recent update wins
    SOURCE_PRIORITY = "source_priority"   # Prioritize specific source
    CUSTOM_RULE = "custom_rule"           # User-defined resolution

class MultiSourceMapping(Mapping):
    conflict_resolution: ConflictResolutionStrategy = ConflictResolutionStrategy.LATEST_WINS
    source_priority: List[str] = []  # Ordered list of source IDs (highest priority first)
```

---

## 📊 IMPLEMENTATION ROADMAP

### Immediate (This Week)
- [ ] Create "Connections" tab UI in admin.html
- [ ] Add connection library management interface
- [ ] Test connection save/load/update/delete via UI
- [ ] Add "Quick Save Connection" button to WorkingSet editor

### Short-term (2-4 weeks)
- [ ] Extend `Mapping` schema with multi-source fields
- [ ] Create `MergePattern` data models
- [ ] Build basic multi-source mapping wizard (no visual builder yet)
- [ ] Implement backend merge pattern executor
- [ ] Create preview endpoint for merge results

### Medium-term (1-2 months)
- [ ] Build visual merge builder UI (drag-and-drop)
- [ ] Implement jsPlumb-based node graph
- [ ] Add merge operation configuration modals
- [ ] Create interactive preview pane
- [ ] Add output column mapping interface

### Long-term (2-3 months)
- [ ] Extend CDC monitor for multi-source
- [ ] Implement parallel CDC tracking
- [ ] Build event coordination system
- [ ] Add conflict resolution strategies
- [ ] Create multi-source sync engine
- [ ] Add monitoring/observability for multi-source sync

---

## 🔧 TECHNICAL NOTES

### Performance Considerations

**Merge Pattern Execution:**
- Use WITH (Common Table Expressions) for complex merges
- Cache connection pools per source
- Implement connection pooling limits
- Consider denormalized staging tables for complex joins

**CDC Event Volume:**
- Multi-source = N× CDC events
- Implement event batching (100-1000 events per batch)
- Add back-pressure mechanisms
- Monitor memory usage carefully

**Join Performance:**
- Index key columns on all sources
- Consider materialized views for expensive joins
- Implement incremental refresh strategies
- Add query timeout protections

### Security Considerations

- Connections store passwords - consider encryption at rest
- Multi-source increases attack surface
- Implement connection permission validation
- Add audit logging for cross-source data access
- Consider row-level security in source databases

### Monitoring & Observability

**New Metrics to Track:**
- Events per source (separate counters)
- Merge operation execution time
- Conflict resolution frequency
- Cross-source join latency
- Memory usage per source monitor

**New Dashboards:**
- Multi-source topology view
- Per-source event rates
- Merge pattern execution times
- Conflict resolution stats

---

## 📝 SUMMARY

**Implemented:**
✅ Connection library persistence
✅ Connection CRUD API endpoints
✅ Foundation for multi-source architecture

**Designed:**
📐 Multi-source mapping data model
📐 Merge pattern specification
📐 Visual merge builder UI/UX
📐 Multi-source CDC coordination
📐 Conflict resolution strategies

**Next Actions:**
1. Build Connections tab UI (1-2 days)
2. Test connection library end-to-end
3. Extend Mapping schema for multi-source (1 day)
4. Implement basic merge pattern executor (2-3 days)
5. Build simplified wizard for multi-source mappings (2-3 days)

This provides a complete blueprint for implementing the full multi-source synchronization system!
