"""FastAPI application setup."""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
import logging

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="MSSQL CDC Database Synchronizer",
    description="Real-time database synchronization using Change Data Capture",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

# Setup templates
templates = Jinja2Templates(directory="frontend/templates")

# Import and include routers
from backend.api import admin, operations, monitoring

app.include_router(admin.router, prefix="/api/admin", tags=["Administration"])
app.include_router(operations.router, prefix="/api/operations", tags=["Operations"])
app.include_router(monitoring.router, prefix="/api/monitoring", tags=["Monitoring"])

# Import web routes
from backend.api import web_routes

app.include_router(web_routes.router)

@app.on_event("startup")
async def startup_event():
    """Application startup event."""
    logger.info("Application started")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event."""
    logger.info("Application shutdown")
    
    # Clean up connections
    from backend.db.mssql_manager import connection_pool
    connection_pool.close_all()
    
    # Close DuckDB
    from backend.core.duckdb_processor import duckdb_processor
    duckdb_processor.close()


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "mssql-cdc-synchronizer"}




