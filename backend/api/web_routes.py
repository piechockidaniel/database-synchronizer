"""Web routes for serving HTML templates."""
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter()
templates = Jinja2Templates(directory="frontend/templates")


@router.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Serve the main application page.
    
    Args:
        request: FastAPI request
        
    Returns:
        HTML response
    """
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/admin", response_class=HTMLResponse)
async def admin_page(request: Request):
    """Serve the administration page.
    
    Args:
        request: FastAPI request
        
    Returns:
        HTML response
    """
    return templates.TemplateResponse("admin.html", {"request": request})


@router.get("/operations", response_class=HTMLResponse)
async def operations_page(request: Request):
    """Serve the operations page.
    
    Args:
        request: FastAPI request
        
    Returns:
        HTML response
    """
    return templates.TemplateResponse("operations.html", {"request": request})


@router.get("/monitoring", response_class=HTMLResponse)
async def monitoring_page(request: Request):
    """Serve the monitoring page.
    
    Args:
        request: FastAPI request
        
    Returns:
        HTML response
    """
    return templates.TemplateResponse("monitoring.html", {"request": request})





