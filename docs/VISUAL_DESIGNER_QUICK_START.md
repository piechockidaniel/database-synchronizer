# Visual Workflow Designer - Quick Start

Get started building visual data pipelines in 5 minutes!

---

## What Is It?

A **node-based visual workflow designer** for creating data synchronization pipelines without writing code. Drag, drop, connect, and configure!

---

## Quick Tutorial

### Step 1: Open the Designer
```
http://localhost:8000/admin → Visual Designer tab
```

### Step 2: Build Your First Workflow

**Drag These Nodes (in order):**

1. **Start** (from Control Flow)
   - Drop near the left side
   
2. **Database** (from Sources)
   - Drop to the right of Start
   - Click to configure: `localhost/MyDatabase`
   
3. **Table** (from Sources)  
   - Drop to the right of Database
   - Click to configure: `dbo.Customers`
   
4. **JSON** (from Transformations)
   - Drop to the right of Table
   - Click to configure:
     - Columns: `FirstName, LastName, Email`
     - Dest Column: `CustomerData`
   
5. **Database** (from Destinations)
   - Drop to the right of JSON
   - Click to configure: `localhost/WarehouseDB`
   
6. **Table** (from Destinations)
   - Drop to the right
   - Click to configure: `dbo.DimCustomers`

### Step 3: Connect the Nodes

**Click and drag** from each node's right side (output port) to the next node's left side (input port):

```
Start → Source DB → Source Table → JSON → Dest DB → Dest Table
```

### Step 4: Save and Compile

1. Click **"Save"** button
2. Enter name: `My First Workflow`
3. Click **"Validate"** - Should show ✅
4. Click **"Compile to Mapping"** - Generates TableMapping
5. Done! Workflow is ready to use

---

## Node Cheat Sheet

| Node | Purpose | Example Config |
|------|---------|----------------|
| **Start** | Begin workflow | (no config) |
| **Source Database** | Connect to source | `server/database` |
| **Source Table** | Pick table | `dbo.Customers` |
| **JSON** | Combine as JSON | `Col1,Col2 → JSON` |
| **Concat** | Join text | `First,Last → FullName` |
| **Filter** | Remove rows | `status = 'ACTIVE'` |
| **Dest Database** | Connect to dest | `server/database` |
| **Dest Table** | Pick table | `dbo.Target` |
| **Logger** | Log data | Level: info |

---

## Common Workflows

### Pattern 1: Simple 1:1 Sync
```
Start → Source DB → Source Table → Dest DB → Dest Table
```

### Pattern 2: With JSON Aggregation
```
Start → Source DB → Source Table → JSON → Dest DB → Dest Table
```

### Pattern 3: Filtered Data
```
Start → Source DB → Source Table → Filter → Dest DB → Dest Table
```

### Pattern 4: Multiple Transformations
```
Start → Source → Filter → Dedupe → JSON → Destination
```

### Pattern 5: Conditional Routing
```
Start → Source → Condition → [High] → Dest A
                           → [Low] → Dest B
```

---

## Toolbar Quick Reference

| Button | Action | Shortcut |
|--------|--------|----------|
| **New Workflow** | Clear canvas | - |
| **Save** | Save to disk | Ctrl+S |
| **Load** | Load workflow | - |
| **Validate** | Check errors | - |
| **Compile** | Create mapping | - |
| **Zoom In/Out** | Zoom canvas | Mouse wheel |
| **Fit** | Fit to screen | - |
| **Clear** | Remove all | - |

---

## Tips

### ✅ DO:
- Start with Start node
- Configure nodes as you add them
- Validate before compiling
- Save frequently
- Use descriptive names

### ❌ DON'T:
- Create circular connections
- Leave nodes disconnected
- Skip required configurations
- Forget to save
- Create overly complex flows

---

## Validation Checklist

Before compiling, ensure:

- ✅ Has one Start node
- ✅ Has at least one end node (Stop/Destination)
- ✅ All nodes are connected
- ✅ No circular dependencies
- ✅ All nodes are configured
- ✅ Source and destination tables specified

---

## Example: Customer Sync with JSON

**Goal:** Sync customers, combining name/email as JSON

**Steps:**

1. **Add Nodes:**
   - Start
   - Source DB (`localhost/OLTP`)
   - Source Table (`dbo.Customers`)
   - JSON Transform
   - Dest DB (`localhost/DW`)
   - Dest Table (`dbo.DimCustomers`)

2. **Connect:**
   ```
   Start → Src DB → Src Table → JSON → Dest DB → Dest Table
   ```

3. **Configure JSON Node:**
   - Columns: `FirstName, LastName, Email, Phone`
   - Destination: `CustomerData`

4. **Save:** "Customer JSON Sync"

5. **Compile:** Creates `mapping_workflow_customer_sync`

6. **Use:** Add to working set and sync!

---

## Troubleshooting

### "Cannot connect nodes"
- Check port types (output → input)
- Verify node has available ports

### "Validation failed: No Start node"
- Add a Start node from Control Flow category

### "Compilation failed"
- Run Validate first
- Check error messages
- Ensure source/dest tables configured

### "Properties panel empty"
- Click on a node to select it
- Check if node is properly added to canvas

---

## Next Steps

1. **Explore Templates** - Try different node types
2. **Build Complex Flows** - Chain multiple transformations
3. **Use Operators** - Add logging and notifications
4. **Export Workflows** - Share with team
5. **Compile** - Generate production mappings

---

## More Information

- **Full Guide:** `VISUAL_WORKFLOW_DESIGNER_GUIDE.md`
- **API Examples:** `examples/visual_workflow_example.py`
- **Mapping Guide:** `COLUMN_MAPPING_GUIDE.md`

---

**Ready to build? Open the Visual Designer and start dragging! 🚀**

