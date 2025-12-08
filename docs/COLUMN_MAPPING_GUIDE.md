# Advanced Column Mapping Guide

This guide explains the enhanced column mapping feature that allows flexible reshaping of data between source and destination tables.

## Features

### 1. Multiple Source Columns to Single Destination
You can now map multiple source columns to a single destination column with automatic transformation.

**Use Cases:**
- Combine multiple columns into JSON format
- Concatenate text fields
- Apply custom SQL transformations

### 2. Transformation Types

#### Direct Mapping (No Transformation)
Simple 1:1 column mapping without any transformation.

```
source.FirstName → destination.FirstName
```

#### JSON Object
Combines multiple source columns into a JSON object stored in a single destination column.

**Example:**
```sql
-- Source columns: FirstName, LastName, Email
-- Destination column: UserData (JSON/VARCHAR)
-- Transformation: JSON_OBJECT('FirstName', FirstName, 'LastName', LastName, 'Email', Email)
```

**Result in destination:**
```json
{"FirstName": "John", "LastName": "Doe", "Email": "john@example.com"}
```

#### Concatenation
Combines multiple text columns with a separator.

**Example:**
```sql
-- Source columns: Street, City, State
-- Destination column: FullAddress
-- Transformation: CONCAT(Street, ', ', City, ', ', State)
```

**Result in destination:**
```
"123 Main St, New York, NY"
```

#### Custom SQL Expression
Define your own SQL transformation using placeholders.

**Example:**
```sql
-- Source columns: Price, TaxRate
-- Custom Expression: {col1} * (1 + {col2})
-- Resulting transformation: Price * (1 + TaxRate)
```

## How to Use

### Creating a Mapping in the Admin UI

1. **Navigate to Mappings Tab**
   - Open the admin interface
   - Click on the "Mappings" tab

2. **Create New Mapping**
   - Click "Create New Mapping" button
   - Select source and destination tables
   - Load columns for both tables

3. **Configure Column Mappings**
   - Click "Add Column Mapping"
   - Select one or more source columns using checkboxes
   - Select the destination column
   - Choose transformation type if needed:
     - **None** - Direct mapping (only for single source column)
     - **JSON Object** - Automatically creates JSON_OBJECT() expression
     - **Concatenation** - Automatically creates CONCAT() expression
     - **Custom** - Enter your own SQL expression

4. **Preview**
   - The mapping preview shows the transformation that will be applied
   - Verify the mapping before saving

5. **Save Mapping**
   - Complete all required mappings
   - Set synchronization options (inserts, updates, deletes)
   - Click "Save Mapping"

### Example Scenarios

#### Scenario 1: User Profile Normalization

**Source Table:**
```sql
CREATE TABLE Users (
    UserID INT,
    FirstName VARCHAR(50),
    LastName VARCHAR(50),
    Email VARCHAR(100),
    Phone VARCHAR(20)
)
```

**Destination Table:**
```sql
CREATE TABLE UserProfiles (
    UserID INT,
    PersonalInfo NVARCHAR(MAX),  -- JSON column
    ContactInfo NVARCHAR(MAX)    -- JSON column
)
```

**Mappings:**
1. UserID → UserID (Direct)
2. FirstName, LastName → PersonalInfo (JSON Object)
3. Email, Phone → ContactInfo (JSON Object)

#### Scenario 2: Address Aggregation

**Source Table:**
```sql
CREATE TABLE CustomerAddresses (
    CustomerID INT,
    Street VARCHAR(100),
    City VARCHAR(50),
    State VARCHAR(2),
    Zip VARCHAR(10)
)
```

**Destination Table:**
```sql
CREATE TABLE Customers (
    CustomerID INT,
    FullAddress VARCHAR(300)
)
```

**Mappings:**
1. CustomerID → CustomerID (Direct)
2. Street, City, State, Zip → FullAddress (Concatenation)

#### Scenario 3: Price Calculation

**Source Table:**
```sql
CREATE TABLE Products (
    ProductID INT,
    BasePrice DECIMAL(10,2),
    TaxRate DECIMAL(5,4),
    DiscountPercent DECIMAL(5,2)
)
```

**Destination Table:**
```sql
CREATE TABLE ProductPricing (
    ProductID INT,
    FinalPrice DECIMAL(10,2)
)
```

**Mappings:**
1. ProductID → ProductID (Direct)
2. BasePrice, TaxRate, DiscountPercent → FinalPrice (Custom: `{col1} * (1 + {col2}) * (1 - {col3}/100)`)

## API Usage

### Column Mapping Schema

```json
{
  "source_column": "string",           // For single column (backward compatible)
  "source_columns": ["string"],        // For multiple columns
  "destination_column": "string",
  "transformation": "string",          // SQL expression
  "transformation_type": "string"      // 'json', 'concat', 'custom', or null
}
```

### Creating a Mapping via API

```python
import requests

mapping = {
    "id": "map_users_to_profiles",
    "source_schema": "dbo",
    "source_table": "Users",
    "destination_schema": "dbo",
    "destination_table": "UserProfiles",
    "column_mappings": [
        {
            "source_column": "UserID",
            "destination_column": "UserID"
        },
        {
            "source_columns": ["FirstName", "LastName"],
            "destination_column": "PersonalInfo",
            "transformation": "JSON_OBJECT('FirstName', FirstName, 'LastName', LastName)",
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
```

## Technical Details

### Schema Changes

The `ColumnMapping` model now supports:
- `source_column` (Optional[str]) - Single source column
- `source_columns` (Optional[List[str]]) - Multiple source columns
- `transformation` (Optional[str]) - SQL transformation expression
- `transformation_type` (Optional[str]) - Helper field for UI

### Validation Rules

1. Must have either `source_column` OR `source_columns` (not both)
2. Must have `destination_column`
3. If multiple `source_columns` are used, a transformation is recommended
4. Destination columns can be duplicated (many-to-one mappings allowed)

### Backward Compatibility

The system is fully backward compatible with existing mappings:
- Old mappings using only `source_column` will continue to work
- Auto-mapping feature creates simple 1:1 mappings
- Existing validation rules are preserved

## Best Practices

1. **Use JSON for Complex Data**
   - Good for audit trails, versioning, or denormalization
   - Ensure destination column is NVARCHAR(MAX) or JSON type

2. **Use Concatenation for Display Fields**
   - Good for user-facing combined fields
   - Remember to include separators

3. **Test Custom Transformations**
   - Validate SQL syntax before deployment
   - Test with sample data
   - Consider NULL handling

4. **Performance Considerations**
   - Complex transformations may impact sync speed
   - Index destination columns appropriately
   - Monitor transformation execution time

5. **Documentation**
   - Document custom transformations
   - Explain business logic behind complex mappings
   - Keep mapping names descriptive

## Troubleshooting

### Common Issues

**Issue:** JSON transformation fails
- **Solution:** Ensure destination column is NVARCHAR(MAX) or supports JSON data
- Check SQL Server version (JSON_OBJECT requires SQL Server 2016+)

**Issue:** Concatenation produces unexpected results
- **Solution:** Check for NULL values in source columns
- Use ISNULL() or COALESCE() in custom transformations

**Issue:** Custom transformation syntax error
- **Solution:** Test the SQL expression in SQL Server Management Studio
- Ensure placeholders {col1}, {col2} are used correctly

### Viewing Mapping Details

To see the exact transformation being applied:
1. Go to Mappings tab
2. Click "View Details" on any mapping
3. Review the transformation column for each mapping

### Debugging

Enable debug logging to see transformation SQL:
```python
import logging
logging.getLogger('backend.core.mapping_manager').setLevel(logging.DEBUG)
```

## Future Enhancements

Potential future improvements:
- Transformation templates library
- Validation of transformation syntax before save
- Support for source-side aggregations (GROUP BY)
- Reverse transformations for bidirectional sync
- Transformation performance metrics

## Support

For issues or questions:
1. Check the logs in `logs/` directory
2. Review the mapping details in the admin UI
3. Verify the transformation SQL syntax
4. Check SQL Server compatibility


