// Admin page JavaScript

const API_BASE = '/api';

// Toggle credentials fields based on Windows Auth checkbox
document.getElementById('srcWindowsAuth').addEventListener('change', function() {
    document.getElementById('srcCredentials').style.display = this.checked ? 'none' : 'block';
});

document.getElementById('destWindowsAuth').addEventListener('change', function() {
    document.getElementById('destCredentials').style.display = this.checked ? 'none' : 'block';
});

// Test connection
async function testConnection(type) {
    const prefix = type === 'source' ? 'src' : 'dest';
    const statusDiv = document.getElementById(`${prefix}ConnectionStatus`);
    
    const config = {
        name: document.getElementById(`${prefix}Name`).value,
        server: document.getElementById(`${prefix}Server`).value,
        port: parseInt(document.getElementById(`${prefix}Port`).value),
        database: document.getElementById(`${prefix}Database`).value,
        use_windows_auth: document.getElementById(`${prefix}WindowsAuth`).checked,
        username: document.getElementById(`${prefix}Username`).value || null,
        password: document.getElementById(`${prefix}Password`).value || null
    };
    
    try {
        statusDiv.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div> Testing connection...';
        
        const response = await fetch(`${API_BASE}/admin/connect/test`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        
        if (result.success) {
            statusDiv.innerHTML = `<div class="alert alert-success">${result.message}</div>`;
        } else {
            statusDiv.innerHTML = `<div class="alert alert-danger">${result.message}</div>`;
        }
    } catch (error) {
        statusDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

// Save connection
document.getElementById('sourceConnectionForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    await saveConnection('source');
});

document.getElementById('destConnectionForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    await saveConnection('destination');
});

async function saveConnection(type) {
    const prefix = type === 'source' ? 'src' : 'dest';
    
    const config = {
        name: document.getElementById(`${prefix}Name`).value,
        server: document.getElementById(`${prefix}Server`).value,
        port: parseInt(document.getElementById(`${prefix}Port`).value),
        database: document.getElementById(`${prefix}Database`).value,
        use_windows_auth: document.getElementById(`${prefix}WindowsAuth`).checked,
        username: document.getElementById(`${prefix}Username`).value || null,
        password: document.getElementById(`${prefix}Password`).value || null
    };
    
    try {
        const response = await fetch(`${API_BASE}/admin/connect/set?connection_type=${type}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', `${type} connection saved successfully`);
        } else {
            showAlert('danger', `Error saving ${type} connection`);
        }
    } catch (error) {
        showAlert('danger', `Error: ${error.message}`);
    }
}

// CDC Management
async function checkCDCStatus() {
    const statusDiv = document.getElementById('cdcStatus');
    const tablesDiv = document.getElementById('cdcTables');
    
    try {
        statusDiv.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Checking CDC status...';
        
        const response = await fetch(`${API_BASE}/admin/cdc/status?connection_type=source`);
        const result = await response.json();
        
        if (result.cdc_enabled) {
            statusDiv.innerHTML = `<div class="alert alert-success">CDC is enabled on database: ${result.database}</div>`;
            
            if (result.tables && result.tables.length > 0) {
                let tableHtml = '<table class="table"><thead><tr><th>Schema</th><th>Table</th><th>Capture Instance</th></tr></thead><tbody>';
                result.tables.forEach(table => {
                    tableHtml += `<tr><td>${table.source_schema}</td><td>${table.source_table}</td><td>${table.capture_instance}</td></tr>`;
                });
                tableHtml += '</tbody></table>';
                tablesDiv.innerHTML = tableHtml;
            } else {
                tablesDiv.innerHTML = '<p class="text-muted">No tables have CDC enabled</p>';
            }
        } else {
            statusDiv.innerHTML = `<div class="alert alert-warning">CDC is NOT enabled on database: ${result.database}</div>`;
            tablesDiv.innerHTML = '<p class="text-muted">Enable CDC on database first</p>';
        }
    } catch (error) {
        statusDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

async function enableDatabaseCDC() {
    try {
        const response = await fetch(`${API_BASE}/admin/cdc/enable-db`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({connection_type: 'source'})
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', result.message);
            checkCDCStatus();
        } else {
            showAlert('danger', result.message || 'Failed to enable CDC');
        }
    } catch (error) {
        showAlert('danger', `Error: ${error.message}`);
    }
}

async function enableTableCDC() {
    const schema = document.getElementById('cdcSchema').value;
    const table = document.getElementById('cdcTable').value;
    
    if (!schema || !table) {
        showAlert('warning', 'Please enter schema and table name');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/cdc/enable-table`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                connection_type: 'source',
                schema_name: schema,
                table_name: table
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', result.message);
            checkCDCStatus();
        } else {
            showAlert('danger', result.message || 'Failed to enable CDC on table');
        }
    } catch (error) {
        showAlert('danger', `Error: ${error.message}`);
    }
}

// Mappings
async function loadMappings() {
    const listDiv = document.getElementById('mappingsList');
    
    try {
        listDiv.innerHTML = '<div class="spinner-border"></div> Loading mappings...';
        
        const response = await fetch(`${API_BASE}/admin/mapping/list`);
        const mappings = await response.json();
        
        if (mappings.length === 0) {
            listDiv.innerHTML = '<p class="text-muted">No mappings configured.</p>';
            return;
        }
        
        let html = '';
        mappings.forEach(mapping => {
            html += `
                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title">${mapping.source_schema}.${mapping.source_table} → ${mapping.destination_schema}.${mapping.destination_table}</h5>
                        <p class="card-text">
                            <strong>Columns:</strong> ${mapping.column_mappings.length} mapped<br>
                            <strong>Status:</strong> ${mapping.enabled ? '<span class="badge bg-success">Enabled</span>' : '<span class="badge bg-secondary">Disabled</span>'}
                        </p>
                        <button class="btn btn-sm btn-danger" onclick="deleteMapping('${mapping.id}')">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
    } catch (error) {
        listDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

function showCreateMappingModal() {
    showAlert('info', 'Mapping creation UI would open here. Use API to create mappings programmatically.');
}

async function deleteMapping(mappingId) {
    if (!confirm('Are you sure you want to delete this mapping?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/mapping/${mappingId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', 'Mapping deleted successfully');
            loadMappings();
        } else {
            showAlert('danger', 'Failed to delete mapping');
        }
    } catch (error) {
        showAlert('danger', `Error: ${error.message}`);
    }
}

// Working Sets
async function loadWorksets() {
    const listDiv = document.getElementById('worksetsList');
    
    try {
        listDiv.innerHTML = '<div class="spinner-border"></div> Loading working sets...';
        
        const response = await fetch(`${API_BASE}/admin/workset/list`);
        const worksets = await response.json();
        
        if (worksets.length === 0) {
            listDiv.innerHTML = '<p class="text-muted">No working sets configured.</p>';
            return;
        }
        
        let html = '';
        worksets.forEach(ws => {
            html += `
                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title">
                            ${ws.name}
                            ${ws.is_active ? '<span class="badge bg-success ms-2">Active</span>' : ''}
                        </h5>
                        <p class="card-text">
                            ${ws.description || 'No description'}<br>
                            <strong>Mappings:</strong> ${ws.table_mappings.length}
                        </p>
                        <button class="btn btn-sm btn-primary" onclick="activateWorkset('${ws.id}')" ${ws.is_active ? 'disabled' : ''}>
                            <i class="bi bi-check-circle"></i> Activate
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteWorkset('${ws.id}')">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
    } catch (error) {
        listDiv.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
    }
}

function showCreateWorksetModal() {
    showAlert('info', 'Working set creation UI would open here. Use API to create working sets programmatically.');
}

async function activateWorkset(worksetId) {
    try {
        const response = await fetch(`${API_BASE}/admin/workset/activate/${worksetId}`, {
            method: 'PUT'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', 'Working set activated successfully');
            loadWorksets();
        } else {
            showAlert('danger', 'Failed to activate working set');
        }
    } catch (error) {
        showAlert('danger', `Error: ${error.message}`);
    }
}

async function deleteWorkset(worksetId) {
    if (!confirm('Are you sure you want to delete this working set?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/workset/${worksetId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', 'Working set deleted successfully');
            loadWorksets();
        } else {
            showAlert('danger', 'Failed to delete working set');
        }
    } catch (error) {
        showAlert('danger', `Error: ${error.message}`);
    }
}

// Utility function to show alerts
function showAlert(type, message) {
    const alertHtml = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    // Create container if it doesn't exist
    let container = document.getElementById('alertContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'alertContainer';
        container.className = 'position-fixed top-0 end-0 p-3';
        container.style.zIndex = '11';
        document.body.appendChild(container);
    }
    
    container.innerHTML = alertHtml;
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000);
}

// Load initial data when tabs are clicked
document.getElementById('mappings-tab').addEventListener('click', loadMappings);
document.getElementById('worksets-tab').addEventListener('click', loadWorksets);





