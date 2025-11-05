"""Utility helper functions."""
import logging
from functools import wraps
from typing import Callable, Any
import asyncio

logger = logging.getLogger(__name__)


def retry_on_error(max_retries: int = 3, delay: float = 1.0):
    """Decorator to retry a function on error.
    
    Args:
        max_retries: Maximum number of retry attempts
        delay: Delay between retries in seconds
        
    Returns:
        Decorated function
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs) -> Any:
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    logger.warning(f"Attempt {attempt + 1}/{max_retries} failed: {e}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(delay)
            
            logger.error(f"All {max_retries} attempts failed")
            raise last_exception
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs) -> Any:
            last_exception = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    logger.warning(f"Attempt {attempt + 1}/{max_retries} failed: {e}")
                    if attempt < max_retries - 1:
                        import time
                        time.sleep(delay)
            
            logger.error(f"All {max_retries} attempts failed")
            raise last_exception
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def format_lsn(lsn: bytes) -> str:
    """Format LSN bytes as hex string.
    
    Args:
        lsn: LSN as bytes
        
    Returns:
        Formatted hex string
    """
    if not lsn:
        return "None"
    return lsn.hex().upper()


def parse_lsn(lsn_str: str) -> bytes:
    """Parse LSN hex string to bytes.
    
    Args:
        lsn_str: LSN as hex string
        
    Returns:
        LSN as bytes
    """
    if not lsn_str or lsn_str == "None":
        return None
    return bytes.fromhex(lsn_str)


def sanitize_table_name(schema: str, table: str) -> str:
    """Create a sanitized table name for use in identifiers.
    
    Args:
        schema: Schema name
        table: Table name
        
    Returns:
        Sanitized name
    """
    return f"{schema}_{table}".replace('-', '_').replace(' ', '_')


def format_bytes(bytes_count: int) -> str:
    """Format bytes as human-readable string.
    
    Args:
        bytes_count: Number of bytes
        
    Returns:
        Formatted string (e.g., "1.5 MB")
    """
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_count < 1024.0:
            return f"{bytes_count:.1f} {unit}"
        bytes_count /= 1024.0
    return f"{bytes_count:.1f} PB"


def truncate_string(s: str, max_length: int = 50) -> str:
    """Truncate string to maximum length.
    
    Args:
        s: String to truncate
        max_length: Maximum length
        
    Returns:
        Truncated string
    """
    if len(s) <= max_length:
        return s
    return s[:max_length - 3] + "..."


class CircularBuffer:
    """Simple circular buffer for storing recent items."""
    
    def __init__(self, max_size: int = 1000):
        """Initialize circular buffer.
        
        Args:
            max_size: Maximum number of items to store
        """
        self.max_size = max_size
        self.items = []
    
    def append(self, item: Any):
        """Add item to buffer.
        
        Args:
            item: Item to add
        """
        self.items.append(item)
        if len(self.items) > self.max_size:
            self.items.pop(0)
    
    def get_all(self):
        """Get all items in buffer.
        
        Returns:
            List of items
        """
        return self.items.copy()
    
    def clear(self):
        """Clear all items from buffer."""
        self.items.clear()
    
    def size(self) -> int:
        """Get current buffer size.
        
        Returns:
            Number of items in buffer
        """
        return len(self.items)





