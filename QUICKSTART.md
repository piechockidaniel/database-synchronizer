# Quick Start Guide

Get the MSSQL CDC Database Synchronizer up and running in 10 minutes!

## Prerequisites Check

Before starting, ensure you have:
- [ ] Python 3.9 or higher installed
- [ ] SQL Server 2016+ accessible (source and destination)
- [ ] ODBC Driver 17 for SQL Server installed
- [ ] SQL Server Agent running on source server
- [ ] Sysadmin privileges on source SQL Server (for CDC)

## Step-by-Step Setup

### 1. Install Application (2 minutes)

```bash
# Clone and navigate to project
cd database-synchronizer

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Set Up Test Databases (3 minutes)

**Option A: Use Provided Script**

Open SQL Server Management Studio and run:
```sql
-- File: examples/setup_test_databases.sql
-- This creates CDCSourceDB and CDCDestDB with sample data
```

**Option B: Use Existing Databases**

Make note of:
- Source server, database, and table names
- Destination server, database, and table names
- Authentication method (Windows or SQL Auth)

### 3. Start the Application (1 minute)

```bash
python main.py
```

You should see:
```
INFO: Starting MSSQL CDC Database Synchronizer
INFO: Web UI will be available at http://localhost:8000
INFO: Application started
INFO: Uvicorn running on http://0.0.0.0:8000
```

### 4. Configure via Web UI (3 minutes)

**Open Browser**: http://localhost:8000

**4.1 Configure Connections**

1. Click **Administration** → **Connections** tab
2. Configure Source:
   - Server: `localhost` (or your server)
   - Database: `CDCSourceDB`
   - Check "Windows Authentication" (or provide credentials)
   - Click **Test Connection** (should see success)
   - Click **Save Connection**

3. Configure Destination:
   - Server: `localhost` (or your server)
   - Database: `CDCDestDB`
   - Check "Windows Authentication" (or provide credentials)
   - Click **Test Connection**
   - Click **Save Connection**

**4.2 Verify CDC Status**

1. Click **CDC Management** tab
2. Click **Check CDC Status**
   - Should show "CDC is enabled" on CDCSourceDB
   - Should list enabled tables (Customers, Orders)

If CDC is not enabled:
- Click **Enable CDC on Database**
- Enter table details and click **Enable CDC on Table**

**4.3 Create Table Mapping**

For now, use the API to create mappings (simplified in Web UI v1.0):

```python
# See examples/api_example.py for complete example
# Or use the API documentation at http://localhost:8000/docs
```

Alternative: Use the API directly:

```bash
# Create mapping for Customers table
curl -X POST "http://localhost:8000/api/admin/mapping/create" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "customers_mapping",
    "source_schema": "dbo",
    "source_table": "Customers",
    "destination_schema": "dbo",
    "destination_table": "Customers",
    "column_mappings": [
      {"source_column": "CustomerID", "destination_column": "CustomerID", "transformation": null},
      {"source_column": "CustomerName", "destination_column": "CustomerName", "transformation": null},
      {"source_column": "Email", "destination_column": "Email", "transformation": null},
      {"source_column": "CreatedDate", "destination_column": "CreatedDate", "transformation": null},
      {"source_column": "ModifiedDate", "destination_column": "ModifiedDate", "transformation": null}
    ],
    "enabled": true,
    "sync_inserts": true,
    "sync_updates": true,
    "sync_deletes": true
  }'
```

**4.4 Create and Activate Working Set**

Use API or Python script:

```python
# Run the example script
python examples/api_example.py

```

### 5. Start Synchronization (1 minute)

1. Go to **Operations** tab
2. Verify the status shows your active working set
3. Click **Start** button
4. Watch the status change to "RUNNING"
5. Statistics should start updating

### 6. Test Synchronization (2 minutes)

**Generate Test Data**:

```sql
-- In SQL Server Management Studio, connect to CDCSourceDB
USE CDCSourceDB;

-- Insert test records
EXEC dbo.GenerateTestInserts @Count = 5;

-- Update test records
EXEC dbo.GenerateTestUpdates @Count = 3;
```

**Monitor in Web UI**:

1. Go to **Monitoring** tab
2. Click **Live Events** tab
3. Click **Connect** to start WebSocket
4. Watch events appear in real-time!
5. Check **Statistics** tab for metrics

**Verify Synchronization**:

```sql
-- Compare source and destination
SELECT COUNT(*) FROM CDCSourceDB.dbo.Customers;
SELECT COUNT(*) FROM CDCDestDB.dbo.Customers;

-- Should match after synchronization!
```

## Troubleshooting

### Issue: "CDC is not enabled"
**Solution**: 
```sql
USE CDCSourceDB;
EXEC sys.sp_cdc_enable_db;
```

### Issue: "SQL Server Agent must be running"
**Solution**: Start SQL Server Agent service

### Issue: "Connection failed"
**Solution**: 
- Check server name and port
- Verify SQL Server allows remote connections
- Test connection with SQL Server Management Studio first

### Issue: "Permission denied"
**Solution**: User must be member of sysadmin role to enable CDC

### Issue: "ODBC Driver not found"
**Solution**: Install from https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

## Next Steps

Now that you're running:

1. **Data Quality Check**:
   - Go to Monitoring → Data Quality tab
   - Select your mapping
   - Click **Run Verification**
   - Review results

2. **View History**:
   - Go to Monitoring → History tab
   - Set date range
   - Click **Query** to see all events

3. **Customize**:
   - Create more mappings for other tables
   - Set up multiple working sets
   - Configure transformation rules
   - Adjust polling intervals

4. **Production Ready**:
   - Review security settings
   - Set up monitoring alerts
   - Configure backup for config files
   - Document your mappings

## Useful Commands

```bash
# Start application
python main.py

# View logs
tail -f app.log  # Linux/Mac
type app.log     # Windows

# Check configuration
cat config/worksets.json
cat config/mappings.json

# View recent history
cat history/cdc_events_*.json | tail -20
```

## API Quick Reference

```bash
# Health check
curl http://localhost:8000/health

# Get sync status
curl http://localhost:8000/api/operations/status

# Get statistics
curl http://localhost:8000/api/monitoring/statistics

# Interactive API docs
# Open: http://localhost:8000/docs
```

## Getting Help

- **Documentation**: README.md
- **API Docs**: http://localhost:8000/docs
- **Examples**: examples/ directory
- **Logs**: app.log file

## What's Next?

- Read the full [README.md](README.md) for detailed information
- Explore the [examples/api_example.py](examples/api_example.py) script
- Check out the [CHANGELOG.md](CHANGELOG.md) for version history
- Review architecture in the README

---

**Congratulations!** 🎉 You now have a working CDC synchronization system!






