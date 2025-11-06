# Quick Start: Column Reshaping Feature

Get started with advanced column mapping in 5 minutes!

## What Can You Do?

✅ Map multiple source columns → single destination column  
✅ Combine columns as JSON data  
✅ Concatenate text fields automatically  
✅ Create custom SQL transformations  

---

## Quick Example

### Scenario: Store User Data as JSON

**Source Table (Normalized):**
```sql
Users
├── UserID
├── FirstName
├── LastName
├── Email
└── Phone
```

**Destination Table (Denormalized):**
```sql
UserProfiles
├── UserID
└── UserData (JSON/NVARCHAR)
```

**Mapping:**
- UserID → UserID (direct)
- FirstName, LastName, Email, Phone → UserData (as JSON)

---

## Step-by-Step Guide

### Step 1: Open Admin Interface
```
http://localhost:8000/admin
```

### Step 2: Go to Mappings Tab
Click on "**Mappings**" in the navigation

### Step 3: Create New Mapping
1. Click "**Create New Mapping**" button
2. Select source database and table
3. Select destination database and table
4. Click "**Load Columns**" for both sides

### Step 4: Add Column Mappings

#### For Simple 1:1 Mapping:
1. Click "**Add Column Mapping**"
2. Check **one** source column (e.g., UserID)
3. Select destination column (e.g., UserID)
4. Leave transformation as "**Direct Mapping**"

#### For JSON Aggregation:
1. Click "**Add Column Mapping**"
2. Check **multiple** source columns (e.g., FirstName, LastName, Email)
3. Select destination column (e.g., UserData)
4. Set transformation to "**JSON Object**"
5. Preview shows: `JSON_OBJECT('FirstName', FirstName, ...)`

#### For Concatenation:
1. Click "**Add Column Mapping**"
2. Check columns to combine (e.g., Street, City, State)
3. Select destination column (e.g., FullAddress)
4. Set transformation to "**Concatenation**"
5. Preview shows: `CONCAT(Street, ', ', City, ', ', State)`

#### For Custom Transformation:
1. Click "**Add Column Mapping**"
2. Check source columns
3. Select destination column
4. Set transformation to "**Custom SQL Expression**"
5. Enter expression using placeholders: `{col1} * (1 + {col2})`

### Step 5: Save Mapping
1. Review all mappings in the preview
2. Set sync options (inserts, updates, deletes)
3. Click "**Save Mapping**"

---

## Common Use Cases

### 1. JSON Data Warehouse
**Problem:** Need to store normalized data as JSON  
**Solution:** Use JSON Object transformation

```
Source: FirstName, LastName, Email
  ↓ JSON Object
Destination: {"FirstName": "John", "LastName": "Doe", "Email": "john@example.com"}
```

### 2. Full Text Search
**Problem:** Need searchable full address field  
**Solution:** Use Concatenation transformation

```
Source: Street, City, State, Zip
  ↓ Concatenation
Destination: "123 Main St, New York, NY 10001"
```

### 3. Calculated Fields
**Problem:** Need to store computed values  
**Solution:** Use Custom SQL transformation

```
Source: Price, Tax, Discount
  ↓ Custom: {col1} * (1 + {col2}) * (1 - {col3}/100)
Destination: 107.91
```

---

## Tips & Tricks

### 💡 Tip 1: Auto-Map First
Click "**Auto-Map Matching Columns**" to create 1:1 mappings automatically, then add complex mappings manually.

### 💡 Tip 2: Use Preview
Always check the preview to verify the SQL that will be generated.

### 💡 Tip 3: Test Transformations
Test complex SQL expressions in SQL Server Management Studio before using them in mappings.

### 💡 Tip 4: Handle NULLs
For custom transformations, use `ISNULL()` or `COALESCE()` to handle NULL values:
```sql
CONCAT(ISNULL(Street, ''), ', ', ISNULL(City, ''))
```

### 💡 Tip 5: Check Data Types
Ensure destination column can hold the transformed data:
- JSON → Use NVARCHAR(MAX) or JSON type
- Concatenation → Use VARCHAR with sufficient length
- Calculations → Use appropriate numeric type

---

## Quick API Example

```python
import requests

# Create mapping with JSON transformation
mapping = {
    "id": "users_to_profiles",
    "source_schema": "dbo",
    "source_table": "Users",
    "destination_schema": "dbo",
    "destination_table": "UserProfiles",
    "column_mappings": [
        # Simple mapping
        {
            "source_column": "UserID",
            "destination_column": "UserID"
        },
        # JSON aggregation
        {
            "source_columns": ["FirstName", "LastName", "Email"],
            "destination_column": "UserData",
            "transformation_type": "json"
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
print(response.json())
```

---

## Troubleshooting

### Issue: "Mapping must have either source_column or source_columns"
**Fix:** Make sure you've checked at least one source column checkbox

### Issue: JSON transformation fails
**Fix:** 
- Check SQL Server version (2016+ required for JSON_OBJECT)
- Ensure destination column is NVARCHAR(MAX)

### Issue: Concatenation returns NULL
**Fix:** Add NULL handling:
```sql
CONCAT(ISNULL(Col1, ''), ', ', ISNULL(Col2, ''))
```

### Issue: Can't see preview
**Fix:** 
- Make sure both source and destination columns are selected
- Check browser console for JavaScript errors

---

## Next Steps

1. **Read Full Guide:** Check `COLUMN_MAPPING_GUIDE.md` for detailed documentation
2. **Try Examples:** Run `examples/advanced_mapping_example.py`
3. **View Mappings:** Use "View Details" to see transformation SQL
4. **Test Sync:** Start synchronization and monitor results

---

## Quick Reference

| Transformation | Use When | Example |
|---------------|----------|---------|
| **Direct** | 1:1 column mapping | ID → ID |
| **JSON Object** | Store multiple fields as JSON | Name, Email → UserData |
| **Concatenation** | Combine text fields | Street, City → Address |
| **Custom SQL** | Complex calculations | Price * (1 + Tax) → Total |

---

## Support

- **Documentation:** `COLUMN_MAPPING_GUIDE.md`
- **Examples:** `examples/advanced_mapping_example.py`
- **UI Reference:** `UI_PREVIEW.md`
- **Summary:** `COLUMN_RESHAPING_FEATURE_SUMMARY.md`

---

**Ready to reshape your data? Start creating mappings now! 🚀**

