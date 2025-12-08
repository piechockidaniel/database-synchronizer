# Column Control Features

This document describes the advanced column control features that give you fine-grained control over how individual columns are synchronized.

## Overview

Two powerful control mechanisms are available for each column mapping:

1. **Ignore Changes** - Skip synchronization for specific columns
2. **Auto-Generate** - Automatically generate values in destination columns

These controls work at the column-mapping level, giving you maximum flexibility in how data flows between source and destination.

---

## Feature 1: Ignore Changes

### What It Does

The **Ignore Changes** flag allows you to exclude specific columns from synchronization. Even if the source column changes, those changes will not be propagated to the destination.

### Use Cases

#### 1. **Preserve Destination-Only Data**
Keep destination columns that should never be overwritten from the source.

**Example:** Audit timestamps
```
Source: LastModifiedDate (changes frequently)
Destination: FirstSyncedDate (should never change after initial sync)
→ Set Ignore Changes = TRUE on FirstSyncedDate mapping
```

#### 2. **Skip Sensitive Columns**
Exclude sensitive data from synchronization.

**Example:** Personal identifiers
```
Source: SSN, CreditCardNumber
Destination: (skip these columns entirely)
→ Don't create mappings, or set Ignore Changes = TRUE
```

#### 3. **Manage Large Binary Data**
Skip synchronization of large files/images that rarely change.

**Example:** Profile photos
```
Source: ProfilePhoto (VARBINARY)
Destination: ProfilePhoto
→ Set Ignore Changes = TRUE to skip heavy data transfer
```

#### 4. **Preserve Manual Overrides**
Allow manual edits in destination to not be overwritten.

**Example:** Price overrides
```
Source: StandardPrice
Destination: ActualPrice (may be manually adjusted)
→ Set Ignore Changes = TRUE to preserve manual adjustments
```

### How to Use

#### In Admin UI:
1. Create or edit a column mapping
2. In the **Column Controls** section on the source side
3. Toggle **"Ignore Changes"** switch
4. Preview will show an "Ignore Changes" badge
5. Save mapping

#### Via API:
```python
{
    "source_column": "ProfilePhoto",
    "destination_column": "ProfilePhoto",
    "ignore_changes": True  # Skip this column in sync
}
```

### Behavior

- **On INSERT**: Column will still be synced on initial insert (unless auto-generate is used)
- **On UPDATE**: Column changes are skipped entirely
- **On DELETE**: Delete still processes normally (based on sync_deletes setting)

---

## Feature 2: Auto-Generate Values

### What It Does

The **Auto-Generate** feature automatically generates values for destination columns using SQL expressions, rather than copying from source.

### Auto-Generate Modes

#### Mode 1: **On Every Insert** (`on_insert`)
Generate a new value every time a record is inserted.

**Use Cases:**
- Unique identifiers (GUIDs)
- Timestamps (creation time)
- Sequence numbers
- Random values

**Example:**
```python
{
    "destination_column": "DestinationID",
    "auto_generate": "on_insert",
    "auto_generate_expression": "NEWID()"  # New GUID each time
}
```

#### Mode 2: **On Init Only** (`on_init`)
Generate value only on the first insert, preserve it on updates.

**Use Cases:**
- Creation timestamps (never change)
- Original values (audit trail)
- First-seen data
- Initial state tracking

**Example:**
```python
{
    "destination_column": "FirstSeenDate",
    "auto_generate": "on_init",
    "auto_generate_expression": "GETDATE()"  # Only on first insert
}
```

### Common Auto-Generate Expressions

#### Unique Identifiers
```sql
NEWID()                    -- New GUID
NEWSEQUENTIALID()          -- Sequential GUID
NEXT VALUE FOR MySequence  -- Sequence number
```

#### Timestamps
```sql
GETDATE()                  -- Current datetime
CURRENT_TIMESTAMP          -- Current timestamp (ANSI SQL)
SYSDATETIME()             -- Current datetime with more precision
GETUTCDATE()              -- Current UTC datetime
```

#### User/System Info
```sql
CURRENT_USER               -- Current database user
SUSER_NAME()              -- Current login name
HOST_NAME()               -- Computer name
APP_NAME()                -- Application name
```

#### Custom Values
```sql
'SYNCED'                   -- Constant string
1                          -- Constant number
CONCAT('SYNC_', CAST(NEWID() AS VARCHAR(36)))  -- Complex expression
```

### How to Use

#### In Admin UI:
1. Create or edit a column mapping
2. In the **Auto-Generate Value** section on the destination side
3. Select mode: "On Every Insert" or "On Init Only"
4. Enter SQL expression (e.g., `NEWID()`, `GETDATE()`)
5. Preview will show an "Auto-Gen" badge
6. Save mapping

#### Via API:
```python
{
    "destination_column": "SyncID",
    "auto_generate": "on_insert",
    "auto_generate_expression": "NEWID()"
}
```

### Behavior

**On Every Insert Mode:**
- New value generated for each INSERT
- Original source value is ignored
- Updates don't trigger re-generation

**On Init Only Mode:**
- Value generated only on first INSERT
- Subsequent UPDATEs preserve the original value
- Value is "locked in" after initialization

---

## Combining Features

### Valid Combinations

#### ✅ Ignore Changes + Direct Mapping
```python
{
    "source_column": "ProfilePhoto",
    "destination_column": "ProfilePhoto",
    "ignore_changes": True
}
```
**Result:** Initial value synced, updates ignored

#### ✅ Auto-Generate Only (no source columns)
```python
{
    "destination_column": "SyncGUID",
    "auto_generate": "on_insert",
    "auto_generate_expression": "NEWID()"
}
```
**Result:** Destination column populated automatically

#### ✅ Transformation + Ignore Changes
```python
{
    "source_columns": ["FirstName", "LastName"],
    "destination_column": "FullName",
    "transformation_type": "concat",
    "ignore_changes": True
}
```
**Result:** Concatenation done on first sync, ignored after

### Invalid Combinations

#### ❌ Ignore Changes + Auto-Generate
```python
{
    "destination_column": "SomeColumn",
    "ignore_changes": True,
    "auto_generate": "on_insert"  # ERROR: Cannot have both
}
```
**Reason:** Conflicting instructions - can't both ignore and auto-generate

---

## Real-World Examples

### Example 1: Audit Trail with Auto-Generated Fields

```python
mapping = {
    "column_mappings": [
        # Regular sync
        {
            "source_column": "CustomerID",
            "destination_column": "CustomerID"
        },
        {
            "source_column": "CustomerName",
            "destination_column": "CustomerName"
        },
        # Auto-generated audit fields
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
        },
        {
            "destination_column": "SyncSource",
            "auto_generate": "on_init",
            "auto_generate_expression": "'CDC_SYNC'"
        }
    ]
}
```

**Result:**
- `SyncGUID`: New GUID on every insert
- `FirstSyncedAt`: Timestamp of first sync (never changes)
- `LastSyncedAt`: Timestamp of latest sync
- `SyncSource`: Constant label 'CDC_SYNC'

### Example 2: Preserve Manual Adjustments

```python
mapping = {
    "column_mappings": [
        # Normal sync
        {
            "source_column": "ProductID",
            "destination_column": "ProductID"
        },
        {
            "source_column": "ProductName",
            "destination_column": "ProductName"
        },
        {
            "source_column": "StandardPrice",
            "destination_column": "StandardPrice"
        },
        # Ignored column (preserve manual edits)
        {
            "source_column": "StandardPrice",
            "destination_column": "ActualPrice",
            "ignore_changes": True  # Don't overwrite manual price adjustments
        },
        {
            "source_column": "Notes",
            "destination_column": "Notes",
            "ignore_changes": True  # Preserve destination notes
        }
    ]
}
```

**Result:**
- Standard fields sync normally
- `ActualPrice` gets initial value but won't be updated
- `Notes` gets initial value but won't be updated

### Example 3: Data Warehouse with Tracking

```python
mapping = {
    "column_mappings": [
        # Dimension key
        {
            "destination_column": "DimCustomerKey",
            "auto_generate": "on_insert",
            "auto_generate_expression": "NEXT VALUE FOR DimCustomerSeq"
        },
        # Business key
        {
            "source_column": "CustomerID",
            "destination_column": "CustomerBusinessKey"
        },
        # Data fields
        {
            "source_columns": ["FirstName", "LastName", "Email"],
            "destination_column": "CustomerData",
            "transformation_type": "json"
        },
        # Slowly changing dimension tracking
        {
            "destination_column": "EffectiveDate",
            "auto_generate": "on_init",
            "auto_generate_expression": "GETDATE()"
        },
        {
            "destination_column": "IsCurrent",
            "auto_generate": "on_init",
            "auto_generate_expression": "1"
        },
        # Audit fields
        {
            "destination_column": "LoadDate",
            "auto_generate": "on_insert",
            "auto_generate_expression": "GETDATE()"
        },
        {
            "destination_column": "SourceSystem",
            "auto_generate": "on_init",
            "auto_generate_expression": "'OLTP_CDC'"
        }
    ]
}
```

### Example 4: Skip Large Binary Data

```python
mapping = {
    "column_mappings": [
        {
            "source_column": "DocumentID",
            "destination_column": "DocumentID"
        },
        {
            "source_column": "DocumentName",
            "destination_column": "DocumentName"
        },
        # Skip large binary content
        {
            "source_column": "DocumentContent",
            "destination_column": "DocumentContent",
            "ignore_changes": True  # Only sync on initial insert
        },
        # Track content hash instead
        {
            "source_column": "ContentHash",
            "destination_column": "ContentHash"
        }
    ]
}
```

---

## UI Features

### Visual Indicators

In the mapping interface, you'll see:

- **[Ignore Changes]** badge (orange/warning color)
- **[Auto-Gen (Insert)]** badge (blue/info color)
- **[Auto-Gen (Init)]** badge (blue/info color)

### Column Controls Section

Located on the **source** side of the mapping:
```
┌─────────────────────────────┐
│ Column Controls             │
│ ☑ Ignore Changes            │
│   Skip syncing changes      │
└─────────────────────────────┘
```

### Auto-Generate Section

Located on the **destination** side of the mapping:
```
┌──────────────────────────────────┐
│ Auto-Generate Value              │
│ [On Every Insert ▼]              │
│ Expression: NEWID()              │
└──────────────────────────────────┘
```

---

## Validation Rules

The system enforces these validation rules:

1. ✅ **Cannot combine ignore_changes and auto_generate**
   - These are mutually exclusive

2. ✅ **Auto-generate requires expression**
   - Must provide SQL expression when mode is not 'none'

3. ⚠️ **Warning: Transformation on ignored column**
   - System warns if transformation is specified but column is ignored

4. ✅ **Source columns optional for auto-generate**
   - Can create destination-only mappings with auto-generate

---

## Best Practices

### 1. Use Ignore Changes For:
- ✅ Audit timestamps that shouldn't change
- ✅ Manual adjustments in destination
- ✅ Large binary data (photos, documents)
- ✅ Sensitive data exclusion
- ✅ Destination-calculated fields

### 2. Use Auto-Generate (On Insert) For:
- ✅ Unique identifiers (GUIDs)
- ✅ Sync timestamps
- ✅ Batch identifiers
- ✅ Processing flags
- ✅ Random values

### 3. Use Auto-Generate (On Init) For:
- ✅ Creation timestamps
- ✅ Original values (audit)
- ✅ Initial state markers
- ✅ First-seen tracking
- ✅ Source system labels

### 4. Performance Considerations:
- 💡 Ignore large binary columns to improve sync speed
- 💡 Use auto-generate for GUIDs instead of copying
- 💡 Skip columns that change frequently but aren't needed
- 💡 Consider database load for complex auto-generate expressions

### 5. Testing:
- 🧪 Test auto-generate expressions in SQL first
- 🧪 Verify "on_init" behavior with multiple updates
- 🧪 Check that ignored columns truly don't update
- 🧪 Validate auto-generated values meet requirements

---

## Troubleshooting

### Issue: Auto-generate not working

**Symptoms:** Destination column stays NULL

**Solutions:**
1. Check SQL expression syntax
2. Verify destination column allows the data type
3. Check for SQL permissions issues
4. Review sync logs for errors

### Issue: Ignored column still updating

**Symptoms:** Changes still propagate despite ignore flag

**Solutions:**
1. Verify `ignore_changes` is set to `true`
2. Check mapping was saved correctly
3. Restart sync process to reload config
4. Review logs to see if mapping is active

### Issue: "On Init" generating on every update

**Symptoms:** Value changes on updates

**Solutions:**
1. Verify mode is `on_init` not `on_insert`
2. Check destination column isn't being updated elsewhere
3. Review transformation logic

### Issue: Expression syntax error

**Symptoms:** Sync fails with SQL error

**Solutions:**
1. Test expression in SQL Server Management Studio
2. Check for typos (e.g., `GETDATE()` not `GETDATE`)
3. Verify functions are available in SQL Server version
4. Use proper quoting for string constants

---

## API Reference

### ColumnMapping Schema

```python
class ColumnMapping(BaseModel):
    source_column: Optional[str] = None
    source_columns: Optional[List[str]] = None
    destination_column: str
    transformation: Optional[str] = None
    transformation_type: Optional[str] = None
    
    # Column control options
    ignore_changes: bool = False
    auto_generate: AutoGenerateMode = AutoGenerateMode.NONE
    auto_generate_expression: Optional[str] = None


class AutoGenerateMode(str, Enum):
    NONE = "none"
    ON_INSERT = "on_insert"
    ON_INIT = "on_init"
```

### Example API Call

```python
import requests

mapping = {
    "id": "customer_sync_with_controls",
    "source_schema": "dbo",
    "source_table": "Customers",
    "destination_schema": "dbo",
    "destination_table": "CustomerWarehouse",
    "column_mappings": [
        {
            "source_column": "CustomerID",
            "destination_column": "CustomerID"
        },
        {
            "source_column": "CustomerName",
            "destination_column": "CustomerName"
        },
        {
            "source_column": "ProfilePhoto",
            "destination_column": "ProfilePhoto",
            "ignore_changes": True
        },
        {
            "destination_column": "SyncID",
            "auto_generate": "on_insert",
            "auto_generate_expression": "NEWID()"
        },
        {
            "destination_column": "FirstSyncDate",
            "auto_generate": "on_init",
            "auto_generate_expression": "GETDATE()"
        }
    ],
    "enabled": True,
    "sync_inserts": True,
    "sync_updates": True,
    "sync_deletes": True
}

response = requests.post(
    "http://localhost:8000/api/admin/mapping/create",
    json=mapping
)
```

---

## Summary

The Column Control Features provide powerful, granular control over data synchronization:

✅ **Ignore Changes** - Exclude specific columns from update synchronization
✅ **Auto-Generate** - Automatically generate destination values
✅ **Flexible Modes** - Choose "on_insert" or "on_init" behavior
✅ **SQL Expressions** - Use any valid SQL for value generation
✅ **Visual UI** - Easy-to-use interface with preview
✅ **Validation** - Built-in checks prevent configuration errors

These features enable sophisticated data flow patterns while maintaining simplicity for common use cases.

