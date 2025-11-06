# Mapping Creation GUI Guide

## Overview

The mapping creation GUI provides a user-friendly interface for creating table-to-table mappings without needing to use API calls directly. This guide explains how to use the new modal-based mapping creation feature.

## Features

### 1. **Interactive Modal Interface**
- Large, easy-to-use modal dialog
- Three-step process clearly organized
- Visual feedback at each step

### 2. **Table Selection**
- Load tables from source and destination databases
- Schema and table dropdowns with automatic population
- One-click table loading

### 3. **Column Mapping**
- Manual column-by-column mapping
- **Auto-map feature** - Automatically maps columns with matching names
- Add/remove individual mappings
- Shows data types for each column
- Visual arrow indicators showing mapping direction

### 4. **Synchronization Options**
- Enable/disable the mapping
- Control which operations to sync:
  - Insert operations
  - Update operations
  - Delete operations
- Auto-generated mapping ID

## How to Use

### Step 1: Open the Modal

1. Navigate to **Administration** → **Mappings** tab
2. Click the **"Create New Mapping"** button
3. The mapping creation modal will open

### Step 2: Configure Source and Destination Tables

#### Source Side:
1. Click **"Load Tables"** to fetch all tables from source database
2. Select a **Schema** from the dropdown (e.g., `dbo`)
3. Select a **Table** from the filtered list
4. Click **"Load Columns"** to fetch column information

#### Destination Side:
1. Click **"Load Tables"** to fetch all tables from destination database
2. Select a **Schema** from the dropdown (e.g., `dbo`)
3. Select a **Table** from the filtered list
4. Click **"Load Columns"** to fetch column information

### Step 3: Map Columns

You have three options for mapping columns:

#### Option A: Auto-Map (Recommended for identical schemas)
1. Click **"Auto-Map Matching Columns"**
2. The system will automatically create mappings for columns with matching names
3. Review the auto-generated mappings
4. Add any additional mappings manually if needed

#### Option B: Manual Mapping
1. Click **"Add Column Mapping"**
2. Select source column from left dropdown
3. Select destination column from right dropdown
4. Repeat for each column you want to map

#### Option C: Combination
1. Use Auto-Map for most columns
2. Add additional manual mappings for renamed columns
3. Remove unwanted mappings using the trash icon

### Step 4: Configure Options

1. **Mapping ID**: Auto-generated, read-only
2. **Enable Mapping**: Check to activate immediately
3. **Sync Operations**: Choose which operations to synchronize:
   - ✅ **Sync Inserts** - New records
   - ✅ **Sync Updates** - Modified records
   - ✅ **Sync Deletes** - Deleted records

### Step 5: Save

1. Review all settings
2. Click **"Create Mapping"** button
3. Success message will appear
4. Modal will close automatically
5. Mappings list will refresh to show your new mapping

## Example Workflow

### Scenario: Map a Customers table from SourceDB to DestDB

```
1. Click "Create New Mapping"
2. Source Side:
   - Click "Load Tables"
   - Select Schema: "dbo"
   - Select Table: "Customers"
   - Click "Load Columns"

3. Destination Side:
   - Click "Load Tables"
   - Select Schema: "dbo"
   - Select Table: "Customers"
   - Click "Load Columns"

4. Click "Auto-Map Matching Columns"
   → System finds: CustomerID, CustomerName, Email, CreatedDate, ModifiedDate
   → All 5 columns auto-mapped!

5. Review options:
   ✅ Enable Mapping
   ✅ Sync Inserts
   ✅ Sync Updates
   ✅ Sync Deletes

6. Click "Create Mapping"
   → Success! Mapping created.
```

## Tips & Best Practices

### 🎯 Best Practices

1. **Use Auto-Map First**: If your source and destination tables have similar structures, use Auto-Map to save time
2. **Load Columns Before Mapping**: Always load columns from both sides before attempting to create mappings
3. **Review Data Types**: Pay attention to data types shown in parentheses to ensure compatible mappings
4. **Test with One Table**: Create and test one mapping before creating many
5. **Enable Gradually**: You can disable sync operations initially and enable them after testing

### ⚠️ Common Issues

**Problem**: "Please load source and destination columns first"
- **Solution**: Click "Load Columns" on both source and destination sides

**Problem**: "Failed to load tables"
- **Solution**: Ensure connections are configured and tested in the Connections tab

**Problem**: Auto-map finds no matches
- **Solution**: Column names differ between source and destination - use manual mapping

**Problem**: Cannot select columns in dropdowns
- **Solution**: Make sure you loaded columns after selecting the table

## Advanced Features

### Manual Column Selection
- Each mapping row shows column name and data type
- Example: `CustomerID (int)` or `CustomerName (varchar)`
- This helps ensure you're mapping compatible columns

### Removing Individual Mappings
- Each mapping row has a trash icon on the right
- Click to remove that specific mapping
- Useful for correcting auto-map mistakes

### Clear All Mappings
- Use "Clear All" to start over
- Faster than removing mappings one by one

## API Endpoints Used

The GUI internally calls these API endpoints:

- `GET /api/admin/scan/tables?connection_type=source` - Load source tables
- `GET /api/admin/scan/tables?connection_type=destination` - Load destination tables
- `GET /api/admin/scan/columns?connection_type=source&schema=X&table=Y` - Load source columns
- `GET /api/admin/scan/columns?connection_type=destination&schema=X&table=Y` - Load destination columns
- `POST /api/admin/mapping/create` - Create the mapping

## Validation

The system validates:

✅ Source schema and table are selected  
✅ Destination schema and table are selected  
✅ At least one column mapping exists  
✅ All column mappings have both source and destination selected  
✅ Mapping ID is generated

## What Happens After Creation?

1. Mapping is saved to `config/mappings.json`
2. Mapping appears in the Mappings list
3. Mapping can be added to a Working Set
4. Once in an active Working Set, it will be used for synchronization

## Next Steps

After creating mappings:

1. **Create a Working Set** - Group mappings with connections
2. **Activate Working Set** - Make it the active configuration
3. **Go to Operations** - Start synchronization
4. **Monitor in Real-time** - Watch changes sync live

## Troubleshooting

### Modal doesn't open
- Check browser console for errors
- Ensure admin.js is loaded properly

### Tables not loading
- Verify connections are configured in Connections tab
- Test connections before loading tables

### Columns not showing in dropdowns
- Ensure you selected a table before loading columns
- Check that table exists and has columns

### Mapping creation fails
- Review the error message
- Ensure all required fields are filled
- Check that column mappings are complete

## Visual Guide

### Modal Structure

```
┌─────────────────────────────────────────────────┐
│  Create Table Mapping                      [X]  │
├─────────────────────────────────────────────────┤
│  ① Table Selection                              │
│     Source              →    Destination        │
│     Schema: [dbo  ▼]         Schema: [dbo  ▼]  │
│     Table:  [Cust.▼]         Table:  [Cust.▼]  │
│     [Load Tables] [Load Columns]                │
├─────────────────────────────────────────────────┤
│  ② Column Mapping                               │
│     [Auto-Map] [Add Mapping] [Clear All]        │
│     CustomerID (int)  →  CustomerID (int)  [🗑]│
│     Name (varchar)    →  Name (varchar)    [🗑]│
│     Email (varchar)   →  Email (varchar)   [🗑]│
├─────────────────────────────────────────────────┤
│  ③ Synchronization Options                      │
│     ☑ Enable Mapping                            │
│     ☑ Sync Inserts  ☑ Sync Updates  ☑ Deletes  │
├─────────────────────────────────────────────────┤
│                        [Cancel] [Create Mapping]│
└─────────────────────────────────────────────────┘
```

## Summary

The GUI-based mapping creation eliminates the need to:
- Write JSON manually
- Use curl commands
- Write Python scripts
- Call API endpoints directly

Everything is done through an intuitive, visual interface with helpful feedback at each step.

**Enjoy the simplified mapping creation process!** 🎉

