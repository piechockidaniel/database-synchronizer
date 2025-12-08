# Changelog

All notable changes to the MSSQL CDC Database Synchronizer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-04

### Added
- Initial release of MSSQL CDC Database Synchronizer
- Real-time CDC monitoring with asyncio
- FastAPI-based REST API
- Modern web-based UI with Bootstrap 5
- Database connection management (source and destination)
- CDC enable/disable functionality at database and table levels
- Table and column scanning
- Flexible table mapping configuration
- Column-to-column mapping with optional transformations
- Working sets for managing multiple synchronization workflows
- Start/Stop/Pause/Resume synchronization controls
- Real-time sync status monitoring
- DuckDB integration for in-memory data processing and transformation
- Synchronization engine with INSERT/UPDATE/DELETE support
- JSON-based configuration persistence
- JSON-based event history logging with daily rotation
- WebSocket support for live event streaming
- Historical event querying
- Comprehensive statistics dashboard
- Data quality verificator with:
  - Row count comparison
  - Random sampling
  - Reverse mapping validation
- LSN (Log Sequence Number) state tracking
- Error handling and logging
- Interactive API documentation (Swagger UI)
- Comprehensive README with setup instructions

### Security
- Support for Windows Authentication
- Support for SQL Server Authentication
- Connection string security (passwords not logged)

### Performance
- Connection pooling for database connections
- In-memory processing with DuckDB
- Configurable batch sizes
- Efficient CDC polling with LSN tracking

### Documentation
- Complete README with installation guide
- API documentation via FastAPI
- Quick start guide
- Troubleshooting section
- Architecture diagrams
- Configuration examples

## Future Enhancements (Planned)

### [1.1.0] - TBD
- User authentication and authorization for web UI
- Role-based access control
- Enhanced transformation engine
- Schema change detection and handling
- Improved conflict resolution strategies

### [1.2.0] - TBD
- Docker containerization
- Kubernetes deployment manifests
- Automated testing suite
- Performance metrics dashboard
- Enhanced error recovery mechanisms

### [2.0.0] - TBD
- Multi-master synchronization support
- Bidirectional sync capabilities
- Advanced data validation rules
- Custom plugin system
- Email/Slack notifications for events
- Backup and restore functionality

---

For more information, see the [README.md](README.md) file.





