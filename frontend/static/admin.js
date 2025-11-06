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

// ==================== MAPPING MODAL FUNCTIONALITY ====================

// Global variables to store column data
let sourceColumns = [];
let destColumns = [];
let columnMappingCounter = 0;

function showCreateMappingModal() {
    // Reset the form
    document.getElementById('createMappingForm').reset();
    document.getElementById('mapEnabled').checked = true;
    document.getElementById('mapSyncInserts').checked = true;
    document.getElementById('mapSyncUpdates').checked = true;
    document.getElementById('mapSyncDeletes').checked = true;
    
    // Clear previous data
    sourceColumns = [];
    destColumns = [];
    columnMappingCounter = 0;
    document.getElementById('columnMappingsContainer').innerHTML = '<p class="text-muted">Load source and destination columns, then add mappings.</p>';
    document.getElementById('mapId').value = '';
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('createMappingModal'));
    modal.show();
}

// Load tables from source database
async function loadSourceTables() {
    const schemaSelect = document.getElementById('mapSourceSchema');
    const tableSelect = document.getElementById('mapSourceTable');
    
    try {
        const response = await fetch(`${API_BASE}/admin/scan/tables?connection_type=source`);
        const result = await response.json();
        
        if (result.success && result.tables) {
            // Get unique schemas
            const schemas = [...new Set(result.tables.map(t => t.schema_name))];
            
            // Populate schema dropdown
            schemaSelect.innerHTML = '<option value="">Select schema...</option>';
            schemas.forEach(schema => {
                const option = document.createElement('option');
                option.value = schema;
                option.textContent = schema;
                schemaSelect.appendChild(option);
            });
            
            // Add event listener to load tables when schema is selected
            schemaSelect.onchange = function() {
                const selectedSchema = this.value;
                tableSelect.innerHTML = '<option value="">Select table...</option>';
                
                if (selectedSchema) {
                    const filteredTables = result.tables.filter(t => t.schema_name === selectedSchema);
                    filteredTables.forEach(table => {
                        const option = document.createElement('option');
                        option.value = table.table_name;
                        option.textContent = table.table_name;
                        tableSelect.appendChild(option);
                    });
                }
            };
            
            showAlert('success', 'Source tables loaded successfully');
        } else {
            showAlert('danger', 'Failed to load source tables');
        }
    } catch (error) {
        showAlert('danger', `Error loading source tables: ${error.message}`);
    }
}

// Load tables from destination database
async function loadDestTables() {
    const schemaSelect = document.getElementById('mapDestSchema');
    const tableSelect = document.getElementById('mapDestTable');
    
    try {
        const response = await fetch(`${API_BASE}/admin/scan/tables?connection_type=destination`);
        const result = await response.json();
        
        if (result.success && result.tables) {
            // Get unique schemas
            const schemas = [...new Set(result.tables.map(t => t.schema_name))];
            
            // Populate schema dropdown
            schemaSelect.innerHTML = '<option value="">Select schema...</option>';
            schemas.forEach(schema => {
                const option = document.createElement('option');
                option.value = schema;
                option.textContent = schema;
                schemaSelect.appendChild(option);
            });
            
            // Add event listener to load tables when schema is selected
            schemaSelect.onchange = function() {
                const selectedSchema = this.value;
                tableSelect.innerHTML = '<option value="">Select table...</option>';
                
                if (selectedSchema) {
                    const filteredTables = result.tables.filter(t => t.schema_name === selectedSchema);
                    filteredTables.forEach(table => {
                        const option = document.createElement('option');
                        option.value = table.table_name;
                        option.textContent = table.table_name;
                        tableSelect.appendChild(option);
                    });
                }
            };
            
            showAlert('success', 'Destination tables loaded successfully');
        } else {
            showAlert('danger', 'Failed to load destination tables');
        }
    } catch (error) {
        showAlert('danger', `Error loading destination tables: ${error.message}`);
    }
}

// Load columns from source table
async function loadSourceColumns() {
    const schema = document.getElementById('mapSourceSchema').value;
    const table = document.getElementById('mapSourceTable').value;
    
    if (!schema || !table) {
        showAlert('warning', 'Please select schema and table first');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/scan/columns?connection_type=source&schema=${schema}&table=${table}`);
        const result = await response.json();
        
        if (result.success && result.columns) {
            sourceColumns = result.columns;
            showAlert('success', `Loaded ${sourceColumns.length} source columns`);
            updateMappingId();
        } else {
            showAlert('danger', 'Failed to load source columns');
        }
    } catch (error) {
        showAlert('danger', `Error loading source columns: ${error.message}`);
    }
}

// Load columns from destination table
async function loadDestColumns() {
    const schema = document.getElementById('mapDestSchema').value;
    const table = document.getElementById('mapDestTable').value;
    
    if (!schema || !table) {
        showAlert('warning', 'Please select schema and table first');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/scan/columns?connection_type=destination&schema=${schema}&table=${table}`);
        const result = await response.json();
        
        if (result.success && result.columns) {
            destColumns = result.columns;
            showAlert('success', `Loaded ${destColumns.length} destination columns`);
            updateMappingId();
        } else {
            showAlert('danger', 'Failed to load destination columns');
        }
    } catch (error) {
        showAlert('danger', `Error loading destination columns: ${error.message}`);
    }
}

// Auto-generate mapping ID
function updateMappingId() {
    const sourceTable = document.getElementById('mapSourceTable').value;
    const destTable = document.getElementById('mapDestTable').value;
    
    if (sourceTable && destTable) {
        const mappingId = `map_${sourceTable}_to_${destTable}_${Date.now()}`;
        document.getElementById('mapId').value = mappingId;
    }
}

// Auto-map columns with matching names
function autoMapColumns() {
    if (sourceColumns.length === 0 || destColumns.length === 0) {
        showAlert('warning', 'Please load source and destination columns first');
        return;
    }
    
    clearColumnMappings();
    
    let mappedCount = 0;
    sourceColumns.forEach(srcCol => {
        const matchingDestCol = destColumns.find(destCol => 
            destCol.column_name.toLowerCase() === srcCol.column_name.toLowerCase()
        );
        
        if (matchingDestCol) {
            addColumnMapping(srcCol.column_name, matchingDestCol.column_name);
            mappedCount++;
        }
    });
    
    if (mappedCount > 0) {
        showAlert('success', `Auto-mapped ${mappedCount} matching columns`);
    } else {
        showAlert('info', 'No matching columns found');
    }
}

// Add a single column mapping row
function addColumnMapping(sourceCol = '', destCol = '') {
    if (sourceColumns.length === 0 || destColumns.length === 0) {
        showAlert('warning', 'Please load source and destination columns first');
        return;
    }
    
    const container = document.getElementById('columnMappingsContainer');
    
    // If this is the first mapping, clear the placeholder text
    if (columnMappingCounter === 0) {
        container.innerHTML = '';
    }
    
    const mappingId = columnMappingCounter++;
    
    const mappingRow = document.createElement('div');
    mappingRow.className = 'row mb-2 column-mapping-row';
    mappingRow.id = `mapping-row-${mappingId}`;
    mappingRow.innerHTML = `
        <div class="col-md-5">
            <select class="form-select form-select-sm" id="src-col-${mappingId}" required>
                <option value="">Select source column...</option>
                ${sourceColumns.map(col => `
                    <option value="${col.column_name}" ${col.column_name === sourceCol ? 'selected' : ''}>
                        ${col.column_name} (${col.data_type})
                    </option>
                `).join('')}
            </select>
        </div>
        <div class="col-md-1 text-center">
            <i class="bi bi-arrow-right"></i>
        </div>
        <div class="col-md-5">
            <select class="form-select form-select-sm" id="dest-col-${mappingId}" required>
                <option value="">Select destination column...</option>
                ${destColumns.map(col => `
                    <option value="${col.column_name}" ${col.column_name === destCol ? 'selected' : ''}>
                        ${col.column_name} (${col.data_type})
                    </option>
                `).join('')}
            </select>
        </div>
        <div class="col-md-1 text-center">
            <button type="button" class="btn btn-sm btn-danger" onclick="removeColumnMapping(${mappingId})">
                <i class="bi bi-trash"></i>
            </button>
        </div>
    `;
    
    container.appendChild(mappingRow);
}

// Remove a column mapping row
function removeColumnMapping(mappingId) {
    const row = document.getElementById(`mapping-row-${mappingId}`);
    if (row) {
        row.remove();
    }
    
    // Check if there are any mappings left
    const container = document.getElementById('columnMappingsContainer');
    if (container.children.length === 0) {
        container.innerHTML = '<p class="text-muted">No column mappings. Click "Add Column Mapping" to start.</p>';
        columnMappingCounter = 0;
    }
}

// Clear all column mappings
function clearColumnMappings() {
    document.getElementById('columnMappingsContainer').innerHTML = '<p class="text-muted">No column mappings. Click "Add Column Mapping" to start.</p>';
    columnMappingCounter = 0;
}

// Save the mapping
async function saveMappingFromModal() {
    // Validate basic fields
    const sourceSchema = document.getElementById('mapSourceSchema').value;
    const sourceTable = document.getElementById('mapSourceTable').value;
    const destSchema = document.getElementById('mapDestSchema').value;
    const destTable = document.getElementById('mapDestTable').value;
    
    if (!sourceSchema || !sourceTable || !destSchema || !destTable) {
        showAlert('warning', 'Please select source and destination tables');
        return;
    }
    
    // Collect column mappings
    const columnMappings = [];
    const mappingRows = document.querySelectorAll('.column-mapping-row');
    
    if (mappingRows.length === 0) {
        showAlert('warning', 'Please add at least one column mapping');
        return;
    }
    
    let hasError = false;
    mappingRows.forEach(row => {
        const rowId = row.id.split('-')[2];
        const srcCol = document.getElementById(`src-col-${rowId}`).value;
        const destCol = document.getElementById(`dest-col-${rowId}`).value;
        
        if (!srcCol || !destCol) {
            hasError = true;
            return;
        }
        
        columnMappings.push({
            source_column: srcCol,
            destination_column: destCol,
            transformation: null
        });
    });
    
    if (hasError) {
        showAlert('warning', 'Please complete all column mappings');
        return;
    }
    
    // Build the mapping object
    const mapping = {
        id: document.getElementById('mapId').value || `map_${sourceTable}_to_${destTable}_${Date.now()}`,
        source_schema: sourceSchema,
        source_table: sourceTable,
        destination_schema: destSchema,
        destination_table: destTable,
        column_mappings: columnMappings,
        enabled: document.getElementById('mapEnabled').checked,
        sync_inserts: document.getElementById('mapSyncInserts').checked,
        sync_updates: document.getElementById('mapSyncUpdates').checked,
        sync_deletes: document.getElementById('mapSyncDeletes').checked
    };
    
    try {
        const response = await fetch(`${API_BASE}/admin/mapping/create`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(mapping)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', 'Mapping created successfully!');
            
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createMappingModal'));
            modal.hide();
            
            // Refresh the mappings list
            loadMappings();
        } else {
            showAlert('danger', result.message || 'Failed to create mapping');
        }
    } catch (error) {
        showAlert('danger', `Error creating mapping: ${error.message}`);
    }
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





