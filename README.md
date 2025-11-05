# MSSQL CDC Database Synchronizer

A comprehensive Python-based application for real-time database synchronization between Microsoft SQL Server databases using Change Data Capture (CDC). Features a modern web-based UI, flexible mapping configuration, and robust monitoring capabilities.

![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

## Features

### Core Capabilities
- **Real-time CDC Monitoring**: Continuously monitors source database for INSERT, UPDATE, and DELETE operations
- **Flexible Table Mapping**: Column-to-column mapping with optional transformation support
- **Working Sets**: Manage multiple synchronization workflows with different configurations
- **Dual Connection Support**: Separate connections for source and destination databases
- **In-Memory Processing**: Uses DuckDB for efficient data transformation and staging

### Administration
- Database connection management with Windows or SQL authentication
- CDC enable/disable at database and table levels
- Visual table and column scanning
- Mapping configuration with validation
- Working set creation and activation

### Operations
- Start/Stop/Pause/Resume synchronization controls
- Real-time status monitoring
- Live statistics dashboard
- Automatic LSN (Log Sequence Number) tracking
- Transaction consistency management

### Monitoring & Quality
- WebSocket-based live event streaming
- Historical event logs with JSON persistence
- Comprehensive statistics and performance metrics
- Data quality verification tool
  - Row count comparison
  - Random sampling verification
  - Reverse mapping validation
- Error tracking and reporting

## Prerequisites

### Software Requirements
- **Python**: 3.9 or higher
- **SQL Server**: 2016 or higher (both source and destination)
- **ODBC Driver**: Microsoft ODBC Driver 17 for SQL Server (or later)

### SQL Server Requirements
- **CDC Prerequisites**:
  - SQL Server Agent must be running
  - Sysadmin privileges required to enable CDC
  - Source database must have CDC enabled
  - Tables to monitor must have CDC enabled

### Network Requirements
- Network connectivity between application server and both SQL Server instances
- Appropriate firewall rules for SQL Server ports (default: 1433)

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd database-synchronizer
```

### 2. Create Virtual Environment
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Verify ODBC Driver Installation

**Windows**: Check "ODBC Data Sources" in Control Panel

**Linux**:
```bash
odbcinst -q -d
```

If ODBC Driver 17 is not installed, download from:
https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

### 5. Configure Directories
The application will automatically create required directories on first run:
- `config/` - Configuration files
- `history/` - Event history logs

## Quick Start

### 1. Enable CDC on Source Database

Connect to your source SQL Server and run:

```sql
-- Enable CDC on database
USE YourSourceDatabase;
GO
EXEC sys.sp_cdc_enable_db;
GO

-- Enable CDC on a table
EXEC sys.sp_cdc_enable_table
    @source_schema = N'dbo',
    @source_name = N'YourTableName',
    @role_name = NULL;
GO
```

### 2. Start the Application

```bash
python main.py
```

The application will start on http://localhost:8000

### 3. Configure Through Web UI

1. **Open browser**: Navigate to http://localhost:8000
2. **Administration** → **Connections**:
   - Configure source database connection
   - Configure destination database connection
   - Test both connections
3. **Administration** → **CDC Management**:
   - Verify CDC status
   - Enable CDC on additional tables if needed
4. **Administration** → **Mappings**:
   - Create table mappings between source and destination
   - Configure column mappings
5. **Administration** → **Working Sets**:
   - Create a working set with connections and mappings
   - Activate the working set
6. **Operations**:
   - Click "Start" to begin synchronization
   - Monitor real-time status
7. **Monitoring**:
   - View live events
   - Check statistics
   - Run data quality verification

## Configuration

### Connection Configuration

Connections can be configured through the web UI or programmatically via API:

```json
{
  "name": "Source Connection",
  "server": "localhost",
  "port": 1433,
  "database": "SourceDB",
  "use_windows_auth": true,
  "username": null,
  "password": null,
  "driver": "ODBC Driver 17 for SQL Server"
}
```

### Table Mapping Configuration

```json
{
  "id": "mapping_001",
  "source_schema": "dbo",
  "source_table": "Customers",
  "destination_schema": "dbo",
  "destination_table": "Customers_Copy",
  "column_mappings": [
    {
      "source_column": "CustomerID",
      "destination_column": "ID",
      "transformation": null
    },
    {
      "source_column": "CustomerName",
      "destination_column": "Name",
      "transformation": null
    }
  ],
  "enabled": true,
  "sync_inserts": true,
  "sync_updates": true,
  "sync_deletes": true
}
```

### Working Set Configuration

```json
{
  "id": "workset_001",
  "name": "Production Sync",
  "description": "Synchronize production data",
  "source_connection": { ... },
  "destination_connection": { ... },
  "table_mappings": ["mapping_001", "mapping_002"],
  "is_active": true
}
```

## API Documentation

Once the application is running, access interactive API documentation at:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key API Endpoints

#### Administration
- `POST /api/admin/connect/test` - Test database connection
- `POST /api/admin/connect/set` - Set source/destination connection
- `GET /api/admin/scan/tables` - Scan database tables
- `POST /api/admin/cdc/enable-db` - Enable CDC on database
- `POST /api/admin/cdc/enable-table` - Enable CDC on table
- `POST /api/admin/mapping/create` - Create table mapping
- `POST /api/admin/workset/create` - Create working set

#### Operations
- `POST /api/operations/start` - Start synchronization
- `POST /api/operations/stop` - Stop synchronization
- `POST /api/operations/pause` - Pause synchronization
- `POST /api/operations/resume` - Resume synchronization
- `GET /api/operations/status` - Get current status

#### Monitoring
- `WS /api/monitoring/events` - WebSocket for live events
- `GET /api/monitoring/statistics` - Get sync statistics
- `GET /api/monitoring/history` - Query historical events
- `POST /api/monitoring/verify` - Run data quality verification

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                          Web UI (Browser)                        │
│                     HTML/CSS/JavaScript/Bootstrap                │
└─────────────────────────────────────────────────────────────────┘
                                ▲
                                │ HTTP/WebSocket
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Application                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Admin API  │  │ Operations   │  │  Monitoring  │         │
│  │              │  │     API      │  │     API      │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                                ▲
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Core Business Logic                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ CDC Monitor  │→ │ Sync Engine  │→ │   History    │         │
│  │              │  │              │  │   Logger     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                          ▲                                       │
│                          │                                       │
│                   ┌──────────────┐                              │
│                   │   DuckDB     │                              │
│                   │  Processor   │                              │
│                   └──────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
              ▲                              ▲
              │                              │
    ┌─────────┴────────┐         ┌──────────┴──────────┐
    │  Source MSSQL    │         │ Destination MSSQL   │
    │  (CDC Enabled)   │         │                     │
    └──────────────────┘         └─────────────────────┘
```

### Key Components

1. **CDC Monitor**: Continuously polls CDC tables for changes using asyncio
2. **Sync Engine**: Applies changes to destination database in real-time
3. **DuckDB Processor**: In-memory staging and transformation of data
4. **History Manager**: JSON-based event logging with daily rotation
5. **Config Manager**: Persistent configuration storage in JSON format

## Troubleshooting

### Common Issues

#### CDC Not Enabled
**Error**: "CDC is not enabled on source database"

**Solution**:
```sql
-- Check if CDC is enabled
SELECT name, is_cdc_enabled
FROM sys.databases
WHERE name = 'YourDatabase';

-- Enable if needed
USE YourDatabase;
EXEC sys.sp_cdc_enable_db;
```

#### SQL Server Agent Not Running
**Error**: "SQL Server Agent must be running for CDC"

**Solution**: Start SQL Server Agent service in SQL Server Configuration Manager

#### Connection Failed
**Error**: "Failed to establish database connection"

**Solutions**:
- Verify server name and port
- Check firewall rules
- Ensure SQL Server allows remote connections
- Verify credentials (if using SQL authentication)
- Test with SQL Server Management Studio first

#### ODBC Driver Not Found
**Error**: "ODBC Driver 17 for SQL Server not found"

**Solution**: Install Microsoft ODBC Driver from:
https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

#### Permission Denied
**Error**: "Permission denied to enable CDC"

**Solution**: User must be member of `sysadmin` fixed server role to enable CDC

### Performance Optimization

#### High Volume Tables
- Adjust `batch_size` in sync engine (default: 100)
- Increase `poll_interval` in CDC monitor (default: 5 seconds)
- Consider partitioning large tables

#### Network Latency
- Deploy application closer to database servers
- Use connection pooling (already implemented)
- Compress network traffic if possible

#### Memory Usage
- DuckDB uses in-memory processing - ensure adequate RAM
- History logs rotate daily to prevent disk filling
- Limit sample size for data quality verification on large tables

## Development

### Project Structure
```
database-synchronizer/
├── backend/
│   ├── api/              # FastAPI endpoints
│   │   ├── admin.py
│   │   ├── operations.py
│   │   ├── monitoring.py
│   │   └── web_routes.py
│   ├── core/             # Business logic
│   │   ├── cdc_monitor.py
│   │   ├── sync_engine.py
│   │   ├── duckdb_processor.py
│   │   ├── config_manager.py
│   │   ├── mapping_manager.py
│   │   ├── history_manager.py
│   │   └── data_quality.py
│   ├── db/               # Database layer
│   │   ├── mssql_manager.py
│   │   └── cdc_operations.py
│   └── models/           # Pydantic models
│       └── schemas.py
├── frontend/
│   ├── static/           # CSS & JavaScript
│   │   ├── style.css
│   │   ├── admin.js
│   │   ├── operations.js
│   │   └── monitoring.js
│   └── templates/        # HTML templates
│       ├── index.html
│       ├── admin.html
│       ├── operations.html
│       └── monitoring.html
├── config/               # Configuration files
├── history/              # Event history logs
├── main.py              # Application entry point
├── requirements.txt
└── README.md
```

### Running Tests
```bash
# Unit tests (to be implemented)
pytest tests/

# Integration tests (to be implemented)
pytest tests/integration/
```

### Code Style
The project follows PEP 8 style guidelines. Use:
```bash
# Format code
black backend/

# Lint code
pylint backend/
```

## Security Considerations

### Database Credentials
- Use Windows Authentication when possible
- Store credentials securely (consider environment variables for production)
- Rotate passwords regularly
- Use least-privilege accounts

### Network Security
- Use SSL/TLS for database connections in production
- Implement firewall rules to restrict access
- Consider VPN for remote deployments

### Application Security
- Run application as non-privileged user
- Keep dependencies updated
- Enable HTTPS for web UI in production
- Implement authentication/authorization for web UI (future enhancement)

## Limitations

### Current Limitations
1. **Primary Keys**: Data quality verification assumes primary keys contain "id" in name
2. **Transformations**: Limited transformation support (SQL expressions in mappings)
3. **Conflict Resolution**: Last-write-wins strategy for updates
4. **Schema Changes**: Doesn't automatically handle schema changes
5. **Authentication**: Web UI currently has no authentication

### Future Enhancements
- User authentication and authorization
- Advanced transformation engine
- Schema change detection and handling
- Multi-master synchronization support
- Conflict resolution strategies
- Performance metrics dashboard
- Automated testing suite
- Docker containerization
- Kubernetes deployment manifests

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Support

For issues, questions, or suggestions:
- Create an issue on GitHub
- Check existing documentation
- Review API documentation at `/docs`

## Acknowledgments

- FastAPI for the excellent web framework
- DuckDB for in-memory analytical processing
- Bootstrap for the UI components
- Microsoft for SQL Server and CDC functionality

## Version History

### v1.0.0 (Current)
- Initial release
- Real-time CDC synchronization
- Web-based administration interface
- Live event monitoring
- Data quality verification
- JSON-based configuration and history

---

**Built with ❤️ for database synchronization needs**





