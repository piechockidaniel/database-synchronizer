# Database Synchronizer - Quick Reference Card

## 🚀 **Core Features At A Glance**

### Column Mapping Options

| Feature | Purpose | Example |
|---------|---------|---------|
| **Direct 1:1** | Simple column copy | `ColA → ColA` |
| **Many:1 JSON** | Combine as JSON | `[Col1, Col2, Col3] → JSON` |
| **Concatenation** | Join text | `[First, Last] → FullName` |
| **Custom SQL** | User expression | `Price * (1 + Tax) → Total` |
| **DuckDB** | In-memory transform | Complex SQL processing |

### Column Controls

| Control | Purpose | When Active |
|---------|---------|-------------|
| **Ignore Changes** | Skip updates | After first insert |
| **Auto-Gen (Insert)** | Generate each time | Every INSERT |
| **Auto-Gen (Init)** | Generate once | First INSERT only |
| **Default Value** | NULL fallback | When source is NULL |

---

## 📋 **Quick Setup**

### 1. Create Mapping (UI)
```
Admin → Mappings → Create New Mapping
1. Load source/destination tables
2. Load columns
3. Add column mappings
4. Configure controls
5. (Optional) Enable DuckDB
6. Save
```

### 2. Create Mapping (API)
```python
mapping = {
    "id": "map_name",
    "source_schema": "dbo",
    "source_table": "Source",
    "destination_schema": "dbo",
    "destination_table": "Dest",
    "column_mappings": [
        {
            "source_column": "ID",
            "destination_column": "ID"
        }
    ],
    "enabled": True,
    "sync_inserts": True,
    "sync_updates": True,
    "sync_deletes": True
}

requests.post("http://localhost:8000/api/admin/mapping/create", json=mapping)
```

---

## 🎯 **Common Patterns**

### Pattern 1: JSON Aggregation
```python
{
    "source_columns": ["Name", "Email", "Phone"],
    "destination_column": "ContactData",
    "transformation_type": "json"
}
```

### Pattern 2: Audit Trail
```python
{
    "destination_column": "CreatedAt",
    "auto_generate": "on_init",
    "auto_generate_expression": "GETDATE()"
},
{
    "destination_column": "ModifiedAt",
    "auto_generate": "on_insert",
    "auto_generate_expression": "GETDATE()"
}
```

### Pattern 3: Skip Large Data
```python
{
    "source_column": "LargeFile",
    "destination_column": "LargeFile",
    "ignore_changes": True
}
```

### Pattern 4: NULL Handling
```python
{
    "source_column": "OptionalField",
    "destination_column": "OptionalField",
    "default_value": "'N/A'"
}
```

### Pattern 5: DuckDB Filter
```python
{
    "use_duckdb_transformation": True,
    "duckdb_script_content": """
        SELECT * FROM {source_table}
        WHERE status = 'ACTIVE'
        AND date >= CURRENT_DATE - INTERVAL '30' DAY
    """
}
```

---

## 🔧 **DuckDB Scripts**

### Location
- **Templates:** `duckdb_scripts/templates/`
- **Custom:** `duckdb_scripts/custom/`

### Available Templates
1. `basic_filter.sql` - Filter rows
2. `aggregation.sql` - Group/summarize
3. `deduplication.sql` - Remove duplicates
4. `data_enrichment.sql` - Add columns
5. `pivot_unpivot.sql` - Reshape data
6. `join_enrich.sql` - Join lookups

### Script Format
```sql
-- Description
CREATE OR REPLACE TEMP TABLE result AS
SELECT * FROM {source_table}
WHERE condition;

SELECT * FROM result;  -- MUST end with SELECT
```

---

## 📡 **API Endpoints**

### Mappings
- `GET /api/admin/mapping/list` - List all
- `GET /api/admin/mapping/{id}` - Get one
- `POST /api/admin/mapping/create` - Create
- `PUT /api/admin/mapping/update` - Update
- `DELETE /api/admin/mapping/{id}` - Delete

### DuckDB Scripts
- `GET /api/admin/duckdb/scripts/list` - List scripts
- `GET /api/admin/duckdb/scripts/{name}` - Get script
- `POST /api/admin/duckdb/scripts/validate` - Validate
- `POST /api/admin/duckdb/scripts/save` - Save script
- `DELETE /api/admin/duckdb/scripts/{name}` - Delete

### Connections
- `POST /api/admin/connect/test` - Test connection
- `POST /api/admin/connect/set` - Set connection

### CDC
- `GET /api/admin/cdc/status` - Check CDC status
- `POST /api/admin/cdc/enable-db` - Enable on DB
- `POST /api/admin/cdc/enable-table` - Enable on table

---

## ⚡ **SQL Expressions**

### Auto-Generate Common
```sql
NEWID()                  -- Random GUID
NEWSEQUENTIALID()       -- Sequential GUID
GETDATE()               -- Current datetime
CURRENT_TIMESTAMP       -- Current timestamp
CURRENT_USER            -- Database user
'CONSTANT'              -- Literal value
```

### Default Values Common
```sql
'UNKNOWN'               -- String literal
0                       -- Numeric
GETDATE()               -- Function
''                      -- Empty string
NULL                    -- Explicit NULL
```

### DuckDB Functions
```sql
-- Date/Time
DATE_TRUNC('month', col)
EXTRACT(YEAR FROM col)
CURRENT_DATE

-- Aggregation
COUNT(*), SUM(col), AVG(col)
STRING_AGG(col, ',')

-- String
UPPER(col), LOWER(col)
CONCAT(col1, col2)
LENGTH(col)

-- Window
ROW_NUMBER() OVER (PARTITION BY col ORDER BY date)
RANK() OVER (ORDER BY col)
```

---

## 🎨 **UI Quick Tips**

### Column Mapping
- ✅ Check multiple source columns for many:1
- ✅ Preview shows transformation SQL
- ✅ Badges indicate active controls

### Transformation Types
- **Direct** - No transformation
- **JSON Object** - Auto `JSON_OBJECT()`
- **Concatenation** - Auto `CONCAT()`
- **Custom** - Your SQL with `{col1}` placeholders
- **DuckDB** - Script-based transformation

### DuckDB Options
- **Select Script** - Choose template or custom
- **Inline** - Enter SQL directly
- **Upload** - Upload `.sql` file
- **Validate** - Check syntax before saving

---

## 🔍 **Troubleshooting**

### Issue: Mapping not syncing
- ✅ Check `enabled` = true
- ✅ Verify CDC enabled on source
- ✅ Check sync service running
- ✅ Review logs

### Issue: Transformation fails
- ✅ Test SQL in SSMS first
- ✅ Check column names (case-sensitive)
- ✅ Verify NULL handling
- ✅ Check destination column type

### Issue: DuckDB script error
- ✅ Validate script syntax
- ✅ Ensure ends with SELECT
- ✅ Check {source_table} placeholder
- ✅ Test with sample data

### Issue: Default value not working
- ✅ Check if source is actually NULL
- ✅ Verify SQL expression syntax
- ✅ Check destination column type compatibility

---

## 📊 **Performance Tips**

1. ✅ Use `ignore_changes` for large binaries
2. ✅ Filter early in DuckDB scripts
3. ✅ Index destination columns
4. ✅ Monitor DuckDB memory usage
5. ✅ Use direct SQL for simple transformations
6. ✅ Batch process large datasets

---

## 📚 **Documentation**

- **COLUMN_MAPPING_GUIDE.md** - Complete reshaping guide
- **COLUMN_CONTROL_FEATURES.md** - Controls guide
- **duckdb_scripts/README.md** - DuckDB scripts
- **FINAL_FEATURES_SUMMARY.md** - All features
- **QUICK_START_*.md** - Quick starts

---

## 🎓 **Examples**

- **examples/advanced_mapping_example.py**
- **examples/column_controls_example.py**
- **duckdb_scripts/templates/*.sql**

---

## 🔗 **Quick Links**

- Admin UI: `http://localhost:8000/admin`
- API Docs: `http://localhost:8000/docs`
- Status: `http://localhost:8000/api/status`

---

**Last Updated:** Final Implementation  
**Version:** Complete Feature Set  
**Status:** ✅ Production Ready

