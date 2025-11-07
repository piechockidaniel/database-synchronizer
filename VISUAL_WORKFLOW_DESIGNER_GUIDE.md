# Visual Workflow Designer - User Guide

## Overview

The Visual Workflow Designer provides a low-code/no-code interface for building data synchronization pipelines using a node-based graph editor. Instead of manually configuring mappings, you can visually design workflows by dragging and connecting components.

---

## Getting Started

### Accessing the Designer

1. Open the admin interface: `http://localhost:8000/admin`
2. Click the **"Visual Designer"** tab
3. You'll see three panels:
   - **Left:** Toolbox with available nodes
   - **Center:** Workflow canvas
   - **Right:** Properties panel

### Creating Your First Workflow

**Step 1: Start with a Start Node**
- Drag the "Start" node from the **Control Flow** category to the canvas
- This marks the beginning of your workflow

**Step 2: Add a Source**
- Drag "Database" from **Sources** category
- Connect Start → Database
- Click the Database node to configure (server, database name)
- Drag "Table" node and connect Database → Table
- Configure schema and table name

**Step 3: Add Transformations (Optional)**
- Drag transformation nodes (JSON, Concat, Filter, etc.)
- Connect Table → Transformation
- Configure transformation properties

**Step 4: Add Destination**
- Drag "Database" from **Destinations** category
- Drag "Table" node
- Drag "Column Mapper" node
- Connect: Last Transform → Dest Database → Dest Table → Column Mapper

**Step 5: Save and Compile**
- Click "Save" button
- Enter a workflow name
- Click "Compile to Mapping" to generate TableMapping
- Your workflow is now ready to use!

---

## Node Categories

### 1. Control Flow

#### Start Node
- **Purpose:** Entry point of the workflow
- **Inputs:** 0
- **Outputs:** 1
- **Config:** None needed
- **Icon:** ▶ (Play circle)
- **Required:** Yes (must have exactly one)

#### Stop Node
- **Purpose:** Exit point of the workflow
- **Inputs:** 1
- **Outputs:** 0
- **Config:** None needed
- **Icon:** ⏹ (Stop circle)
- **Required:** Optional (can end with destination instead)

---

### 2. Sources

#### Database Source
- **Purpose:** Connect to source database
- **Inputs:** 0 (or from Start)
- **Outputs:** 1
- **Configuration:**
  - Server address
  - Database name
  - Port (default: 1433)
  - Authentication (Windows/SQL)
- **Icon:** 🗄️ (Server)

#### Table Source
- **Purpose:** Select source table
- **Inputs:** 1 (from Database)
- **Outputs:** 1
- **Configuration:**
  - Schema name
  - Table name
  - Columns (all or selected)
- **Icon:** 📋 (Table)

#### Column Selector
- **Purpose:** Filter which columns pass through
- **Inputs:** 1
- **Outputs:** 1
- **Configuration:**
  - Selected columns (include)
  - Excluded columns (exclude)
- **Icon:** ☰ (List columns)

---

### 3. Transformations

#### JSON Aggregation
- **Purpose:** Combine multiple columns into JSON
- **Inputs:** 1
- **Outputs:** 1
- **Configuration:**
  - Source columns (comma-separated)
  - Destination column name
  - JSON structure (object/array)
- **Icon:** {} (Braces)
- **Example:** `FirstName, LastName, Email → UserData`

#### Concatenation
- **Purpose:** Join text columns with separator
- **Inputs:** 1
- **Outputs:** 1
- **Configuration:**
  - Source columns
  - Separator (default: ", ")
  - Destination column
- **Icon:** 🔗 (Link)
- **Example:** `Street, City, State → FullAddress`

#### Custom SQL
- **Purpose:** Apply custom SQL expression
- **Inputs:** 1
- **Outputs:** 1
- **Configuration:**
  - SQL expression
  - Source columns
  - Destination column
- **Icon:** <> (Code square)
- **Example:** `Price * (1 + Tax) → TotalPrice`

#### DuckDB Transform
- **Purpose:** Apply DuckDB transformation script
- **Inputs:** 1
- **Outputs:** 1
- **Configuration:**
  - Script name (from templates/custom)
  - Or inline script content
- **Icon:** ⚙️ (Database gear)
- **Use Cases:** Complex transformations, aggregations, filtering

#### Filter
- **Purpose:** Filter rows based on conditions
- **Inputs:** 1
- **Outputs:** 1
- **Configuration:**
  - Filter condition (WHERE clause)
- **Icon:** ▼ (Funnel)
- **Example:** `status = 'ACTIVE' AND date >= '2024-01-01'`

#### Deduplicate
- **Purpose:** Remove duplicate records
- **Inputs:** 1
- **Outputs:** 1
- **Configuration:**
  - Unique columns (for grouping)
  - Keep strategy (first/last)
- **Icon:** ≡ (Card list)
- **Example:** Keep most recent record per customer_id

---

### 4. Destinations

#### Database Destination
- **Purpose:** Connect to destination database
- **Inputs:** 1
- **Outputs:** 1
- **Configuration:**
  - Server address
  - Database name
  - Port
  - Authentication
- **Icon:** 🗄️ (Server)

#### Table Destination
- **Purpose:** Select destination table
- **Inputs:** 1
- **Outputs:** 1
- **Configuration:**
  - Schema name
  - Table name
- **Icon:** 📋 (Table)

#### Column Mapper
- **Purpose:** Map source columns to destination columns
- **Inputs:** 1
- **Outputs:** 0
- **Configuration:**
  - Column mappings (source → destination)
- **Icon:** ↔ (Arrow left-right)
- **Note:** This is typically the final node

---

### 5. Operators

#### Logger
- **Purpose:** Log data at any point in the workflow
- **Inputs:** 1
- **Outputs:** 1 (pass-through)
- **Configuration:**
  - Log level (debug, info, warning, error)
  - Message template
  - Log data (yes/no)
- **Icon:** 📝 (Journal text)
- **Use Case:** Debug workflows, audit trails

#### Notifier
- **Purpose:** Send notifications on events
- **Inputs:** 1
- **Outputs:** 1 (pass-through)
- **Configuration:**
  - Notification type (email, webhook, Slack)
  - Recipients
  - Message template
- **Icon:** 🔔 (Bell)
- **Use Case:** Alert on sync completion, errors

#### Condition
- **Purpose:** Branch workflow based on condition
- **Inputs:** 1
- **Outputs:** 2 (true path, false path)
- **Configuration:**
  - Condition expression
- **Icon:** ❓ (Question circle)
- **Use Case:** Route data based on business rules

#### Fork
- **Purpose:** Duplicate data flow to multiple paths
- **Inputs:** 1
- **Outputs:** 3
- **Configuration:**
  - Fork type (duplicate, split)
- **Icon:** ⋈ (Diagram 3)
- **Use Case:** Send same data to multiple destinations

#### Join
- **Purpose:** Merge multiple data flows
- **Inputs:** 2
- **Outputs:** 1
- **Configuration:**
  - Join type (merge, union)
  - Join key (if applicable)
- **Icon:** ⊕ (Diagram 2)
- **Use Case:** Combine data from multiple sources

---

### 6. Events

#### On Error Handler
- **Purpose:** Handle errors in the workflow
- **Inputs:** 1
- **Outputs:** 1
- **Configuration:**
  - Action (log, retry, skip)
  - Retry count
- **Icon:** ⚠ (Exclamation triangle)

#### On Success Handler
- **Purpose:** Execute actions on successful sync
- **Inputs:** 1
- **Outputs:** 1
- **Configuration:**
  - Action (continue, notify)
  - Notification enabled
- **Icon:** ✓ (Check circle)

#### On Change Detector
- **Purpose:** Detect when specific fields change
- **Inputs:** 1
- **Outputs:** 1
- **Configuration:**
  - Fields to monitor
  - Action on change
- **Icon:** ↻ (Arrow repeat)

---

## Workflow Operations

### Toolbar Buttons

**File Operations:**
- **New Workflow** - Clear canvas and start fresh
- **Save** - Save current workflow to disk
- **Load** - Load an existing workflow

**Workflow Actions:**
- **Validate** - Check workflow for errors
- **Compile to Mapping** - Generate TableMapping configuration

**View Controls:**
- **Zoom In** - Increase canvas zoom
- **Zoom Out** - Decrease canvas zoom
- **Fit** - Fit workflow to screen

**Edit:**
- **Clear** - Remove all nodes and connections

---

## Building Workflows

### Connecting Nodes

1. **Click and drag** from an output port (right side of node)
2. **Drop on** an input port (left side of target node)
3. Connection appears as an arrow

**Connection Rules:**
- Can only connect output → input
- Cannot create cycles
- Some nodes have multiple outputs (e.g., Condition)

### Configuring Nodes

1. **Click on a node** to select it
2. **Properties panel** appears on the right
3. **Edit configuration** fields
4. **Changes are saved** automatically

### Deleting Elements

**Delete a Node:**
- Hover over the node
- Click the **X** button that appears
- Or select and press **Delete** key

**Delete a Connection:**
- Click on the connection line
- Confirm deletion in dialog

---

## Example Workflows

### Example 1: Simple Customer Sync with JSON

**Flow:**
```
Start → Source DB → Source Table → JSON Transform → Dest DB → Dest Table → Column Mapper
```

**Nodes:**
1. **Start**
2. **Source Database:** `localhost/OLTP_DB`
3. **Source Table:** `dbo.Customers`
4. **JSON Transform:** 
   - Columns: `FirstName, LastName, Email`
   - Dest: `CustomerData`
5. **Dest Database:** `localhost/DW_DB`
6. **Dest Table:** `dbo.DimCustomers`
7. **Column Mapper:** Map columns

**Result:** Creates mapping that syncs customers with JSON aggregation

### Example 2: Filtered Data with Logging

**Flow:**
```
Start → Source DB → Source Table → Filter → Logger → Dest DB → Dest Table → Column Mapper
```

**Nodes:**
1. **Start**
2. **Source Database**
3. **Source Table:** `dbo.Orders`
4. **Filter:** `order_date >= '2024-01-01' AND status = 'COMPLETED'`
5. **Logger:** Log level INFO, message "Processing order"
6. **Dest Database**
7. **Dest Table:** `dbo.CompletedOrders`
8. **Column Mapper**

**Result:** Syncs only completed orders from 2024, with logging

### Example 3: Conditional Routing

**Flow:**
```
Start → Source DB → Source Table → Condition
                                       ├→ [True] → Dest Table A
                                       └→ [False] → Dest Table B
```

**Nodes:**
1. **Start**
2. **Source Database**
3. **Source Table:** `dbo.Transactions`
4. **Condition:** `amount > 10000`
5. **Dest Table A:** High-value transactions
6. **Dest Table B:** Regular transactions

**Result:** Routes data to different tables based on amount

---

## Compiling Workflows

### What Happens When You Compile?

1. **Validation:** System checks workflow structure
2. **Traversal:** Follows connections from Start to End
3. **Extraction:** Gathers source, destination, transformations
4. **Conversion:** Builds TableMapping object
5. **Saving:** Creates mapping in the system

### Compiled Mapping

The visual workflow generates a standard `TableMapping`:
- Source schema/table from Source nodes
- Destination schema/table from Destination nodes
- Column mappings from Transformation nodes
- DuckDB scripts from DuckDB Transform nodes

### Using Compiled Mappings

Once compiled, the mapping can be used:
- In Working Sets
- For synchronization
- Via API
- Just like manually created mappings

---

## Best Practices

### 1. Start Simple
- Begin with basic flows (Source → Transform → Destination)
- Add complexity gradually
- Test each component

### 2. Use Descriptive Labels
- Double-click node to rename
- Use meaningful names (e.g., "Customer Source DB" instead of "Database")

### 3. Organize Visually
- Arrange nodes left-to-right (source to destination)
- Keep related nodes close together
- Use consistent spacing

### 4. Validate Frequently
- Click "Validate" button often
- Fix errors as they appear
- Don't wait until workflow is complete

### 5. Save Incrementally
- Save after major changes
- Use descriptive workflow names
- Keep versions for rollback

### 6. Document with Operators
- Use Logger nodes to document data flow
- Add Notifier nodes for important milestones
- Use comments in custom SQL nodes

---

## Keyboard Shortcuts

- **Delete** - Delete selected node
- **Ctrl+S** - Save workflow
- **Ctrl+Z** - Undo (if implemented)
- **Esc** - Deselect nodes
- **Mouse Wheel** - Zoom in/out
- **Space+Drag** - Pan canvas

---

## Troubleshooting

### Issue: Cannot connect nodes

**Solutions:**
- Check output port exists on source node
- Check input port exists on target node
- Verify connection direction (output → input)
- Some nodes may have max connection limits

### Issue: Validation fails

**Common Errors:**
- Missing Start node
- Missing end node (Stop or Destination)
- Disconnected nodes
- Unconfigured nodes (missing required fields)
- Circular dependencies

**Solutions:**
- Add required nodes
- Connect all nodes
- Configure all required properties
- Remove circular connections

### Issue: Compilation fails

**Solutions:**
- Validate workflow first
- Ensure source and destination tables specified
- Check transformation nodes are properly configured
- Review error messages for specifics

### Issue: Node properties not showing

**Solutions:**
- Click on the node to select it
- Check if properties panel is visible (right sidebar)
- Refresh page if panel is stuck

---

## Advanced Features

### Branching Workflows

Use **Condition** or **Fork** nodes to create multiple paths:

```
Source → Condition → [High Value] → Premium Destination
                  → [Low Value] → Standard Destination
```

### Multiple Transformations

Chain transformation nodes:

```
Source → Filter → Deduplicate → JSON Transform → Destination
```

### Error Handling

Add **On Error** nodes to handle failures:

```
Source → Transform → On Error → Logger → Alternative Destination
```

### Parallel Processing

Use **Fork** to send data to multiple destinations:

```
Source → Fork → Destination A
             → Destination B
             → Destination C
```

---

## API Integration

### Save Workflow via API

```python
import requests

workflow = {
    "id": "workflow_customer_sync",
    "name": "Customer Sync Workflow",
    "description": "Visual workflow for customer data synchronization",
    "nodes": [
        {
            "id": "node_1",
            "type": "start",
            "position": {"x": 100, "y": 200},
            "config": {},
            "label": "Start"
        },
        # ... more nodes
    ],
    "edges": [
        {
            "id": "edge_1",
            "source": "node_1",
            "target": "node_2"
        },
        # ... more edges
    ]
}

response = requests.post(
    "http://localhost:8000/api/admin/workflow/visual/create",
    json=workflow
)
```

### Compile Workflow via API

```python
response = requests.post(
    "http://localhost:8000/api/admin/workflow/compile/workflow_customer_sync"
)

if response.json()['success']:
    mapping_id = response.json()['mapping_id']
    print(f"Compiled to mapping: {mapping_id}")
```

---

## Tips & Tricks

### 1. Use Templates
- Save common workflows as templates
- Load and modify for new use cases
- Share workflows with team members

### 2. Color Coding
Nodes are color-coded by category:
- 🟢 Green: Control flow (Start)
- 🔴 Red: Control flow (Stop), Errors
- 🔵 Blue: Sources
- 🟡 Yellow: Transformations
- 🔷 Cyan: Destinations
- ⚫ Gray: Operators

### 3. Test Components
- Test each node configuration before connecting
- Use Logger nodes to verify data at checkpoints
- Start simple, add complexity incrementally

### 4. Export/Import
- Export workflows as JSON for backup
- Import workflows to share with others
- Version control workflow JSON files

### 5. Naming Conventions
- Use prefixes: `src_`, `dest_`, `transform_`
- Include data type: `customers_table`, `orders_db`
- Be descriptive: `filter_active_customers`

---

## Comparison: Form UI vs Visual Designer

| Aspect | Form UI | Visual Designer |
|--------|---------|----------------|
| **Learning Curve** | Medium | Low |
| **Flexibility** | High | Very High |
| **Visual Feedback** | Limited | Excellent |
| **Complex Flows** | Difficult | Easy |
| **Documentation** | Manual | Self-documenting |
| **Collaboration** | Text-based | Visual |
| **Best For** | Simple 1:1 mappings | Complex workflows |

---

## Limitations

### Current Limitations

1. **Single Table Mappings** - One source table, one destination table per workflow
2. **No Undo/Redo** - Changes are immediate (save frequently)
3. **Limited Validation** - Some validations happen at compile time
4. **No Real-time Preview** - Cannot preview data in designer

### Planned Enhancements

- Undo/Redo functionality
- Data preview at each node
- Workflow templates library
- Copy/paste nodes
- Workflow versioning
- Collaborative editing
- Performance profiling

---

## Performance Considerations

### Canvas Performance

- **Small workflows** (<50 nodes): Excellent performance
- **Medium workflows** (50-100 nodes): Good performance
- **Large workflows** (>100 nodes): May experience lag

**Tips:**
- Break large workflows into smaller ones
- Use zoom to focus on areas
- Close properties panel when not needed

### Compiled Mapping Performance

Visual workflows compile to the same TableMapping format as form-based UI:
- Same performance characteristics
- No overhead from visual metadata
- Optimized for CDC synchronization

---

## FAQs

**Q: Can I edit a compiled mapping in the visual designer?**
A: Not directly. You need to recreate the workflow. Visual metadata and mappings are separate.

**Q: Can I convert an existing mapping to visual workflow?**
A: Not automatically (yet). You can manually recreate the flow in the designer.

**Q: What happens if I delete a visual workflow?**
A: The visual workflow file is deleted, but compiled mappings remain.

**Q: Can I have multiple Start nodes?**
A: System allows it but only one will be used. Best practice: Use one Start node.

**Q: How do I handle errors in workflows?**
A: Add "On Error" event nodes to catch and handle errors.

**Q: Can workflows span multiple databases?**
A: Yes! Use multiple Database Source/Destination nodes.

---

## Summary

The Visual Workflow Designer provides:

✅ **Intuitive Interface** - Drag-and-drop node-based design
✅ **All Features** - Complete access to all transformation capabilities  
✅ **Visual Documentation** - Self-documenting workflows  
✅ **No Code Required** - Build complex pipelines without writing SQL  
✅ **Standard Output** - Compiles to TableMapping format  
✅ **Validation** - Built-in checks prevent errors  
✅ **Operators** - Logger, Notifier, Conditions for advanced logic  
✅ **Events** - Error handling and success hooks  

Perfect for:
- Non-technical users
- Complex multi-step transformations
- Visual documentation
- Rapid prototyping
- Team collaboration

---

**Next Steps:**
1. Open Visual Designer tab
2. Drag your first node
3. Build a simple workflow
4. Save and compile
5. Start syncing data!

For more information, see:
- **COLUMN_MAPPING_GUIDE.md** - Transformation details
- **QUICK_REFERENCE.md** - Quick reference
- **examples/workflow_examples.py** - Code examples

