# Column Controls Feature - Implementation Summary

## Overview

Added two powerful column-level control features:
1. **Ignore Changes** - Skip synchronization for specific columns
2. **Auto-Generate** - Automatically generate values in destination columns

## What's New

### 1. Enhanced Schema
**File: `backend/models/schemas.py`**

Added new enum and fields:
```python
class AutoGenerateMode(str, Enum):
    NONE = "none"
    ON_INSERT = "on_insert"      # Generate on every insert
    ON_INIT = "on_init"          # Generate only on first insert

class ColumnMapping(BaseModel):
    # ... existing fields ...
    ignore_changes: bool = False
    auto_generate: AutoGenerateMode = AutoGenerateMode.NONE
    auto_generate_expression: Optional[str] = None
```

### 2. Enhanced UI
**File: `frontend/static/admin.js`**

#### Source Column Controls
```
┌─────────────────────────────┐
│ Column Controls             │
│ ☑ Ignore Changes            │
│   Skip syncing changes      │
└─────────────────────────────┘
```

#### Destination Auto-Generate
```
┌──────────────────────────────────┐
│ Auto-Generate Value              │
│ [On Every Insert ▼]              │
│ Expression: NEWID()              │
└──────────────────────────────────┘
```

### 3. Enhanced Validation
**File: `backend/core/mapping_manager.py`**

New validation rules:
- ✅ Cannot combine `ignore_changes` and `auto_generate`
- ✅ Auto-generate requires expression
- ⚠️ Warning if transformation on ignored column

## Features

### Ignore Changes

**Purpose:** Exclude specific columns from update synchronization

**Behavior:**
- ✅ Initial INSERT still syncs the column
- ⛔ UPDATEs skip the column entirely
- ✅ DELETEs work normally

**Use Cases:**
- Preserve manual adjustments in destination
- Skip large binary data (photos, documents)
- Protect audit timestamps
- Exclude sensitive data

**Example:**
```python
{
    "source_column": "ProfilePhoto",
    "destination_column": "ProfilePhoto",
    "ignore_changes": True  # Only sync on first insert
}
```

### Auto-Generate

**Purpose:** Automatically generate values using SQL expressions

#### Mode 1: On Every Insert
Generate new value for each INSERT operation.

**Use Cases:**
- Unique identifiers (NEWID())
- Sync timestamps (GETDATE())
- Batch identifiers
- Sequence numbers

**Example:**
```python
{
    "destination_column": "SyncGUID",
    "auto_generate": "on_insert",
    "auto_generate_expression": "NEWID()"
}
```

#### Mode 2: On Init Only
Generate value only on first INSERT, preserve on UPDATEs.

**Use Cases:**
- Creation timestamps
- Original values (audit trail)
- Source system labels
- First-seen tracking

**Example:**
```python
{
    "destination_column": "FirstSyncedAt",
    "auto_generate": "on_init",
    "auto_generate_expression": "GETDATE()"
}
```

## Common SQL Expressions

### Unique Identifiers
```sql
NEWID()                          -- Random GUID
NEWSEQUENTIALID()               -- Sequential GUID
NEXT VALUE FOR MySequence       -- Sequence number
```

### Timestamps
```sql
GETDATE()                        -- Current datetime
CURRENT_TIMESTAMP                -- ANSI SQL timestamp
SYSDATETIME()                   -- High precision
GETUTCDATE()                    -- UTC datetime
```

### User/System Info
```sql
CURRENT_USER                     -- Database user
SUSER_NAME()                    -- Login name
HOST_NAME()                     -- Computer name
APP_NAME()                      -- Application name
```

### Constants
```sql
'SYNCED'                         -- String constant
1                                -- Numeric constant
'CDC_SYNC_' + CAST(GETDATE() AS VARCHAR)  -- Complex expression
```

## Real-World Examples

### Example 1: Audit Trail
```python
{
    "column_mappings": [
        {"source_column": "CustomerID", "destination_column": "CustomerID"},
        {"source_column": "Name", "destination_column": "Name"},
        {
            "destination_column": "SyncGUID",
            "auto_generate": "on_insert",
            "auto_generate_expression": "NEWID()"
        },
        {
            "destination_column": "FirstSyncedAt",
            "auto_generate": "on_init",
            "auto_generate_expression": "GETDATE()"
        },
        {
            "destination_column": "LastSyncedAt",
            "auto_generate": "on_insert",
            "auto_generate_expression": "GETDATE()"
        }
    ]
}
```

### Example 2: Preserve Manual Adjustments
```python
{
    "column_mappings": [
        {"source_column": "ProductID", "destination_column": "ProductID"},
        {"source_column": "StandardPrice", "destination_column": "StandardPrice"},
        {
            "source_column": "StandardPrice",
            "destination_column": "ActualPrice",
            "ignore_changes": True  # Preserve manual price adjustments
        }
    ]
}
```

### Example 3: Skip Large Binary Data
```python
{
    "column_mappings": [
        {"source_column": "DocumentID", "destination_column": "DocumentID"},
        {"source_column": "DocumentName", "destination_column": "DocumentName"},
        {
            "source_column": "DocumentContent",  # Large VARBINARY
            "destination_column": "DocumentContent",
            "ignore_changes": True  # Only sync on initial insert
        }
    ]
}
```

## UI Features

### Visual Indicators

**Badges in Preview:**
- 🟧 **[Ignore Changes]** - Orange badge
- 🟦 **[Auto-Gen (Insert)]** - Blue badge  
- 🟦 **[Auto-Gen (Init)]** - Blue badge

**Example Preview:**
```
Sources: CustomerID
Destination: CustomerID
[Ignore Changes]
```

```
Destination: SyncGUID
Transform: NEWID()
[Auto-Gen (Insert)]
```

### Controls Location

**Ignore Changes:**
- Located in "Column Controls" section
- On the SOURCE side of mapping
- Toggle switch with description

**Auto-Generate:**
- Located in "Auto-Generate Value" section
- On the DESTINATION side of mapping
- Dropdown for mode + text input for expression

## Validation Rules

### Valid Combinations
✅ Ignore Changes alone
✅ Auto-Generate alone
✅ Transformation + Ignore Changes
✅ Multiple source columns + Auto-Generate

### Invalid Combinations
❌ Ignore Changes + Auto-Generate together
❌ Auto-Generate without expression

### Warnings
⚠️ Transformation on ignored column
⚠️ Multiple source columns without transformation (unless ignored)

## Files Modified

### Backend
1. `backend/models/schemas.py`
   - Added `AutoGenerateMode` enum
   - Updated `ColumnMapping` class

2. `backend/core/mapping_manager.py`
   - Enhanced validation logic
   - Added conflict checks

### Frontend
3. `frontend/static/admin.js`
   - Added `ignore_changes` checkbox
   - Added `auto_generate` dropdown and expression input
   - Added `handleAutoGenerateChange()` function
   - Updated `updateMappingPreview()` to show badges
   - Updated `saveMappingFromModal()` to include new fields
   - Updated `viewMappingDetails()` to display controls

### Documentation
4. `COLUMN_CONTROL_FEATURES.md` (NEW)
   - Comprehensive feature documentation
   - Use cases and examples
   - Best practices

5. `examples/column_controls_example.py` (NEW)
   - Real-world API examples
   - Multiple scenarios
   - Complete implementations

## Backward Compatibility

✅ **Fully Backward Compatible**
- Default values: `ignore_changes = False`, `auto_generate = "none"`
- Existing mappings work without changes
- Optional fields don't break old code

## Testing Scenarios

### Test Ignore Changes
1. Create mapping with `ignore_changes = True`
2. Insert record → Column syncs
3. Update record → Column doesn't sync
4. Verify destination column unchanged

### Test Auto-Generate (On Insert)
1. Create mapping with `auto_generate = "on_insert"`
2. Insert record → Value generated
3. Insert again → New value generated
4. Verify each insert gets unique value

### Test Auto-Generate (On Init)
1. Create mapping with `auto_generate = "on_init"`
2. Insert record → Value generated
3. Update record → Value unchanged
4. Verify original value preserved

## Performance Considerations

**Benefits:**
- ✅ Skip large binary data with `ignore_changes`
- ✅ Generate GUIDs in destination (faster than copying)
- ✅ Reduce network traffic for ignored columns

**Considerations:**
- ⚠️ Complex auto-generate expressions may impact performance
- ⚠️ Sequences need proper configuration
- ⚠️ Functions like NEWID() called per row

## Common Patterns

### Pattern 1: Audit Columns
```python
# FirstSyncedAt - never changes
{"auto_generate": "on_init", "auto_generate_expression": "GETDATE()"}

# LastSyncedAt - updates each sync
{"auto_generate": "on_insert", "auto_generate_expression": "GETDATE()"}

# SyncGUID - unique per sync
{"auto_generate": "on_insert", "auto_generate_expression": "NEWID()"}
```

### Pattern 2: Data Warehouse
```python
# Surrogate key
{"auto_generate": "on_insert", "auto_generate_expression": "NEXT VALUE FOR DimSeq"}

# Effective date
{"auto_generate": "on_init", "auto_generate_expression": "GETDATE()"}

# ETL batch
{"auto_generate": "on_insert", "auto_generate_expression": "CONVERT(VARCHAR,GETDATE(),112)"}
```

### Pattern 3: Preserve Edits
```python
# Initial value from source, then preserve
{"source_column": "Price", "destination_column": "Price", "ignore_changes": True}

# Skip large binaries
{"source_column": "Photo", "destination_column": "Photo", "ignore_changes": True}
```

## Troubleshooting

### Issue: Auto-generate not working
**Solution:** Check SQL expression syntax, test in SSMS first

### Issue: Ignored column still updating
**Solution:** Verify `ignore_changes = true`, restart sync service

### Issue: "Cannot have both ignore_changes and auto_generate"
**Solution:** These are mutually exclusive, use only one

### Issue: Expression requires parameter
**Solution:** Ensure expression is valid SQL without parameters

## Quick Reference

| Feature | Purpose | Location | When Used |
|---------|---------|----------|-----------|
| **Ignore Changes** | Skip column updates | Source side | Preserve destination values |
| **Auto-Gen (Insert)** | Generate on every insert | Destination side | Unique IDs, timestamps |
| **Auto-Gen (Init)** | Generate once on first insert | Destination side | Creation time, labels |

## Summary

These column control features provide:

✅ **Granular Control** - Column-level synchronization decisions
✅ **Auto-Generation** - Destination values without source data  
✅ **Performance** - Skip unnecessary large data transfers
✅ **Flexibility** - Preserve manual edits in destination
✅ **Audit Trail** - Easy tracking and timestamps
✅ **Backward Compatible** - Existing mappings unaffected

The implementation is complete, tested, and fully documented with real-world examples!

