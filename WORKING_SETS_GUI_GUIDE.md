# Working Sets GUI - User Guide

## Overview

Working Sets provide a way to group together source/destination connections and table mappings into a cohesive synchronization unit. The GUI now provides full CRUD (Create, Read, Update, Delete) capabilities for managing working sets.

---

## Features

### ✅ **Complete Working Set Management**

1. **Create Working Sets** - Full modal interface
2. **View Working Sets** - Enhanced display with details
3. **Activate/Deactivate** - Switch between working sets
4. **Delete Working Sets** - Remove unused configurations
5. **Connection Testing** - Test connections before saving
6. **Mapping Selection** - Choose which mappings to include

---

## How to Use

### Creating a Working Set

**Step 1: Open the Working Sets Tab**
- Navigate to Admin interface → Working Sets tab
- Click "**Create Working Set**" button

**Step 2: Basic Information**
- **Working Set ID**: Unique identifier (e.g., `workset_customers_prod`)
- **Name**: Friendly display name (e.g., "Customer Production Sync")
- **Description**: Optional description of the working set
- **Set as Active**: Check to activate immediately after creation

**Step 3: Source Connection**
Configure your source database connection:
- Connection Name (default: "Source Database")
- Server address (e.g., `localhost` or `server.domain.com`)
- Database name
- Port (default: 1433)
- Authentication: Windows Auth or SQL Auth
  - If SQL Auth: provide username/password
- Click "**Test Source Connection**" to verify

**Step 4: Destination Connection**
Configure your destination database connection:
- Connection Name (default: "Destination Database")
- Server address
- Database name
- Port (default: 1433)
- Authentication: Windows Auth or SQL Auth
  - If SQL Auth: provide username/password
- Click "**Test Destination Connection**" to verify

**Step 5: Select Table Mappings**
- Click "**Load Available Mappings**"
- Check the mappings you want to include
- Counter shows number of selected mappings

**Step 6: Save**
- Click "**Create Working Set**"
- If "Set as Active" was checked, it becomes the active working set
- Working set is saved and appears in the list

---

## Working Set Display

### List View

Each working set card shows:
- **Icon & Name** with Active/Inactive badge
- **Description** (if provided)
- **ID** in code format
- **Number of Mappings** included
- **Source Connection** (server/database)
- **Destination Connection** (server/database)
- **Action Buttons:**
  - **View Details** - See full configuration
  - **Activate** - Make this the active working set
  - **Delete** - Remove the working set

### Active Working Set

The active working set is highlighted with:
- Green border around the card
- Green "Active" badge
- Disabled "Activate" button

---

## Viewing Details

Click "**View Details**" on any working set to see:

### Connections Section
- **Source Connection:**
  - Server and port
  - Database name
  - Authentication type
  
- **Destination Connection:**
  - Server and port
  - Database name
  - Authentication type

### Table Mappings
- List of all mapping IDs included in the working set

### Metadata
- Status (Active/Inactive)
- Created timestamp
- Last updated timestamp

---

## Managing Working Sets

### Activating a Working Set

1. Click "**Activate**" on the desired working set
2. System sets it as the active working set
3. Previous active working set (if any) becomes inactive
4. Only one working set can be active at a time

**Note:** The active working set is used by the synchronization service.

### Deleting a Working Set

1. Click "**Delete**" on the working set
2. Confirm deletion in the dialog
3. Working set is removed from the system

**Warning:** Deleting a working set does NOT delete the mappings it references.

---

## UI Features

### Connection Testing

Before saving, you can test connections:
- Click "Test Source Connection" or "Test Destination Connection"
- System attempts to connect to the database
- Shows success (green) or error (red) message
- Helps catch configuration errors early

### Mapping Selection

The mapping selector shows:
- Mapping ID
- Source → Destination tables
- Number of columns mapped
- Checkbox to include/exclude from working set
- Live count of selected mappings

### Form Validation

The system validates:
- ✅ Working Set ID and Name are required
- ✅ Connection details are required
- ✅ At least one mapping must be selected
- ✅ Ports must be valid numbers

---

## Example Workflow

### Scenario: Production Customer Sync

**Goal:** Create a working set for syncing customer data in production

**Step 1: Create Working Set**
```
ID: workset_customer_prod
Name: Customer Production Sync
Description: Synchronizes customer data from OLTP to Data Warehouse
```

**Step 2: Source Connection**
```
Server: prod-sql01.company.com
Database: OLTP_Customers
Port: 1433
Auth: Windows Authentication
```
✅ Test Connection → Success

**Step 3: Destination Connection**
```
Server: dw-sql01.company.com
Database: DataWarehouse
Port: 1433
Auth: Windows Authentication
```
✅ Test Connection → Success

**Step 4: Select Mappings**
```
☑ map_customers_to_dim_customers
☑ map_addresses_to_dim_addresses
☑ map_contacts_to_dim_contacts
```
Selected: 3 mapping(s)

**Step 5: Save & Activate**
- ☑ Set as active working set immediately
- Click "Create Working Set"
- ✅ Success!

**Result:**
- Working set created and activated
- Ready for synchronization
- Appears in list with green "Active" badge

---

## API Equivalent

The GUI actions correspond to these API calls:

### Create Working Set
```python
POST /api/admin/workset/create
{
    "id": "workset_customer_prod",
    "name": "Customer Production Sync",
    "description": "...",
    "source_connection": { ... },
    "destination_connection": { ... },
    "table_mappings": ["map1", "map2"],
    "is_active": false
}
```

### List Working Sets
```python
GET /api/admin/workset/list
```

### Get Working Set Details
```python
GET /api/admin/workset/{workset_id}
```

### Activate Working Set
```python
PUT /api/admin/workset/activate/{workset_id}
```

### Delete Working Set
```python
DELETE /api/admin/workset/{workset_id}
```

---

## Best Practices

### 1. **Use Descriptive Names**
✅ Good: "Customer Production Sync"  
❌ Bad: "ws1"

### 2. **Test Connections Before Saving**
Always click "Test Connection" to catch configuration errors early.

### 3. **Group Related Mappings**
Put related table mappings in the same working set for logical organization.

### 4. **Use Descriptions**
Add descriptions to explain the purpose and scope of each working set.

### 5. **One Active at a Time**
Remember that only one working set can be active. Activate the one you want to sync.

### 6. **Environment Naming**
Include environment in the ID or name:
- `workset_customers_prod`
- `workset_customers_staging`
- `workset_customers_dev`

---

## Troubleshooting

### Issue: "Connection test failed"
**Solutions:**
- Verify server address and port
- Check database name spelling
- Ensure SQL Server is running
- Verify authentication credentials
- Check firewall rules

### Issue: "No mappings available"
**Solution:** Create table mappings first before creating working sets.

### Issue: "Working set ID already exists"
**Solution:** Choose a different, unique ID.

### Issue: "Cannot activate working set"
**Solution:** Check the API logs for specific error details.

### Issue: "Deleted working set still showing"
**Solution:** Click the "Refresh" button to reload the list.

---

## Keyboard Shortcuts

- **Tab** - Navigate between form fields
- **Enter** - Submit form (when in text fields)
- **Esc** - Close modal
- **Ctrl+Click** - Select multiple mappings (checkbox behavior)

---

## UI Components

### Modal Size
- Extra large (XL) modal for comfortable viewing
- Scrollable sections for long lists
- Responsive design for different screen sizes

### Visual Indicators
- 🟢 Green border = Active working set
- ✅ Green badge = Active status
- 🔵 Blue badge = Inactive status
- ✅ Green alert = Success message
- 🔴 Red alert = Error message

### Button Groups
- **View Details** (Info - blue)
- **Activate** (Primary - blue)
- **Delete** (Danger - red)

---

## Security Notes

### Passwords
- Passwords entered in the GUI are stored in the working set configuration
- Use Windows Authentication when possible for better security
- Consider encrypting sensitive configuration files

### Permissions
- Ensure database users have appropriate permissions
- Source: Requires CDC read permissions
- Destination: Requires INSERT, UPDATE, DELETE permissions

---

## Summary

The Working Sets GUI provides:

✅ Complete visual interface for working set management  
✅ Connection testing before saving  
✅ Easy mapping selection with checkboxes  
✅ Detailed view of configuration  
✅ One-click activation  
✅ Clear visual indicators of active status  

No more manual JSON editing - everything is now available through the web interface!

---

**For more information:**
- **API Documentation:** `/docs` endpoint
- **Mapping GUI Guide:** `COLUMN_MAPPING_GUIDE.md`
- **Quick Reference:** `QUICK_REFERENCE.md`

