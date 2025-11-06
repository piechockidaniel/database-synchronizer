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
            // Count mapping types
            let simpleCount = 0;
            let complexCount = 0;
            mapping.column_mappings.forEach(cm => {
                if (cm.source_columns && cm.source_columns.length > 1) {
                    complexCount++;
                } else if (cm.transformation || cm.transformation_type) {
                    complexCount++;
                } else {
                    simpleCount++;
                }
            });
            
            html += `
                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title">${mapping.source_schema}.${mapping.source_table} → ${mapping.destination_schema}.${mapping.destination_table}</h5>
                        <p class="card-text">
                            <strong>Columns:</strong> ${mapping.column_mappings.length} mapped
                            ${simpleCount > 0 ? `<span class="badge bg-info ms-1">${simpleCount} direct</span>` : ''}
                            ${complexCount > 0 ? `<span class="badge bg-warning ms-1">${complexCount} transformed</span>` : ''}
                            <br>
                            <strong>Status:</strong> ${mapping.enabled ? '<span class="badge bg-success">Enabled</span>' : '<span class="badge bg-secondary">Disabled</span>'}
                        </p>
                        <button class="btn btn-sm btn-info" onclick="viewMappingDetails('${mapping.id}')">
                            <i class="bi bi-eye"></i> View Details
                        </button>
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
    
    // Auto-load databases when modal opens
    loadSourceDatabases();
    loadDestDatabases();
}

// Load databases from source connection
async function loadSourceDatabases() {
    const dbSelect = document.getElementById('mapSourceDatabase');
    
    try {
        dbSelect.innerHTML = '<option value="">Loading databases...</option>';
        
        const response = await fetch(`${API_BASE}/admin/scan/databases?connection_type=source`);
        const databases = await response.json();
        
        if (databases && databases.length > 0) {
            dbSelect.innerHTML = '<option value="">Select database...</option>';
            databases.forEach(db => {
                const option = document.createElement('option');
                option.value = db.name;
                option.textContent = db.name + (db.cdc_enabled ? ' (CDC Enabled)' : '');
                // If this is the configured database, select it
                option.selected = db.cdc_enabled; // Select CDC-enabled by default
                dbSelect.appendChild(option);
            });
            
            // If a database is selected, show it
            if (dbSelect.value) {
                showAlert('success', `Source databases loaded. Using: ${dbSelect.value}`);
            }
        } else {
            dbSelect.innerHTML = '<option value="">No databases found</option>';
        }
    } catch (error) {
        dbSelect.innerHTML = '<option value="">Error loading databases</option>';
        showAlert('danger', `Error loading source databases: ${error.message}`);
    }
}

// Load databases from destination connection
async function loadDestDatabases() {
    const dbSelect = document.getElementById('mapDestDatabase');
    
    try {
        dbSelect.innerHTML = '<option value="">Loading databases...</option>';
        
        const response = await fetch(`${API_BASE}/admin/scan/databases?connection_type=destination`);
        const databases = await response.json();
        
        if (databases && databases.length > 0) {
            dbSelect.innerHTML = '<option value="">Select database...</option>';
            databases.forEach(db => {
                const option = document.createElement('option');
                option.value = db.name;
                option.textContent = db.name + (db.cdc_enabled ? ' (CDC Enabled)' : '');
                dbSelect.appendChild(option);
            });
            
            // Auto-select the first database or CDC-enabled one
            if (databases.length === 1) {
                dbSelect.value = databases[0].name;
            } else {
                const cdcDb = databases.find(db => db.cdc_enabled);
                if (cdcDb) {
                    dbSelect.value = cdcDb.name;
                }
            }
            
            if (dbSelect.value) {
                showAlert('success', `Destination databases loaded. Using: ${dbSelect.value}`);
            }
        } else {
            dbSelect.innerHTML = '<option value="">No databases found</option>';
        }
    } catch (error) {
        dbSelect.innerHTML = '<option value="">Error loading databases</option>';
        showAlert('danger', `Error loading destination databases: ${error.message}`);
    }
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
            // Use array format for consistency with new UI
            addColumnMapping([srcCol.column_name], matchingDestCol.column_name);
            mappedCount++;
        }
    });
    
    if (mappedCount > 0) {
        showAlert('success', `Auto-mapped ${mappedCount} matching columns`);
    } else {
        showAlert('info', 'No matching columns found');
    }
}

// Add a single column mapping row with advanced options
function addColumnMapping(preSelectedSources = [], destCol = '', transformation = '', transformationType = '', ignoreChanges = false, autoGenerate = 'none', autoGenerateExpr = '') {
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
    
    // Convert single source to array for backward compatibility
    if (typeof preSelectedSources === 'string' && preSelectedSources) {
        preSelectedSources = [preSelectedSources];
    }
    
    const mappingRow = document.createElement('div');
    mappingRow.className = 'card mb-3 column-mapping-row';
    mappingRow.id = `mapping-row-${mappingId}`;
    mappingRow.innerHTML = `
        <div class="card-body">
            <div class="row align-items-start">
                <!-- Source Columns (Multi-select with checkboxes) -->
                <div class="col-md-5">
                    <label class="form-label fw-bold">Source Column(s)</label>
                    <div class="border rounded p-2" style="max-height: 200px; overflow-y: auto; background-color: #f8f9fa;">
                        ${sourceColumns.map(col => {
                            const isChecked = preSelectedSources.includes(col.column_name);
                            return `
                                <div class="form-check">
                                    <input class="form-check-input src-col-checkbox-${mappingId}" 
                                           type="checkbox" 
                                           value="${col.column_name}" 
                                           id="src-${mappingId}-${col.column_name}"
                                           ${isChecked ? 'checked' : ''}
                                           onchange="updateMappingPreview(${mappingId})">
                                    <label class="form-check-label small" for="src-${mappingId}-${col.column_name}">
                                        ${col.column_name} <span class="text-muted">(${col.data_type})</span>
                                    </label>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <small class="text-muted">Select one or more columns</small>
                    
                    <!-- Column Control Options -->
                    <div class="mt-3 p-2 border rounded bg-white">
                        <label class="form-label small fw-bold mb-2">Column Controls</label>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="ignore-changes-${mappingId}" 
                                   ${ignoreChanges ? 'checked' : ''} onchange="updateMappingPreview(${mappingId})">
                            <label class="form-check-label small" for="ignore-changes-${mappingId}">
                                <i class="bi bi-x-circle text-warning"></i> Ignore Changes
                            </label>
                            <div><small class="text-muted">Skip syncing changes for these columns</small></div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-1 text-center d-flex align-items-center justify-content-center">
                    <i class="bi bi-arrow-right fs-4"></i>
                </div>
                
                <!-- Destination Column -->
                <div class="col-md-5">
                    <label class="form-label fw-bold">Destination Column</label>
                    <select class="form-select form-select-sm mb-2" id="dest-col-${mappingId}" required onchange="updateMappingPreview(${mappingId})">
                        <option value="">Select destination column...</option>
                        ${destColumns.map(col => `
                            <option value="${col.column_name}" ${col.column_name === destCol ? 'selected' : ''}>
                                ${col.column_name} (${col.data_type})
                            </option>
                        `).join('')}
                    </select>
                    
                    <!-- Transformation Type -->
                    <label class="form-label small">Transformation Type</label>
                    <select class="form-select form-select-sm mb-2" id="trans-type-${mappingId}" onchange="handleTransformationTypeChange(${mappingId})">
                        <option value="">Direct Mapping (No Transformation)</option>
                        <option value="json" ${transformationType === 'json' ? 'selected' : ''}>JSON Object</option>
                        <option value="concat" ${transformationType === 'concat' ? 'selected' : ''}>Concatenation</option>
                        <option value="custom" ${transformationType === 'custom' ? 'selected' : ''}>Custom SQL Expression</option>
                    </select>
                    
                    <!-- Custom Transformation Field -->
                    <div id="trans-custom-${mappingId}" style="display: ${transformationType === 'custom' ? 'block' : 'none'};">
                        <label class="form-label small">Custom SQL Expression</label>
                        <input type="text" class="form-control form-control-sm" id="trans-expr-${mappingId}" 
                               placeholder="e.g., CONCAT({col1}, ' - ', {col2})"
                               value="${transformation || ''}"
                               onchange="updateMappingPreview(${mappingId})">
                        <small class="text-muted">Use {col1}, {col2}, etc. as placeholders</small>
                    </div>
                    
                    <!-- Auto-Generate Options -->
                    <div class="mt-2 p-2 border rounded bg-white">
                        <label class="form-label small fw-bold mb-2">Auto-Generate Value</label>
                        <select class="form-select form-select-sm mb-2" id="auto-gen-mode-${mappingId}" onchange="handleAutoGenerateChange(${mappingId})">
                            <option value="none" ${autoGenerate === 'none' ? 'selected' : ''}>No Auto-Generation</option>
                            <option value="on_insert" ${autoGenerate === 'on_insert' ? 'selected' : ''}>On Every Insert</option>
                            <option value="on_init" ${autoGenerate === 'on_init' ? 'selected' : ''}>On Init Only (Once)</option>
                        </select>
                        <div id="auto-gen-expr-div-${mappingId}" style="display: ${autoGenerate !== 'none' ? 'block' : 'none'};">
                            <input type="text" class="form-control form-control-sm" id="auto-gen-expr-${mappingId}" 
                                   placeholder="e.g., NEWID(), GETDATE(), CURRENT_TIMESTAMP"
                                   value="${autoGenerateExpr || ''}"
                                   onchange="updateMappingPreview(${mappingId})">
                            <small class="text-muted d-block">SQL expression to generate value</small>
                            <small class="text-muted">Common: NEWID(), GETDATE(), CURRENT_USER</small>
                        </div>
                    </div>
                    
                    <!-- Default Value -->
                    <div class="mt-2 p-2 border rounded bg-white">
                        <label class="form-label small fw-bold mb-2">Default Value</label>
                        <input type="text" class="form-control form-control-sm" id="default-value-${mappingId}" 
                               placeholder="e.g., 'UNKNOWN', 0, GETDATE()"
                               value=""
                               onchange="updateMappingPreview(${mappingId})">
                        <small class="text-muted">Value to use if source is NULL or missing</small>
                    </div>
                    
                    <!-- Preview -->
                    <div class="mt-2 p-2 bg-light border rounded" id="mapping-preview-${mappingId}">
                        <small class="text-muted">Mapping preview will appear here</small>
                    </div>
                </div>
                
                <div class="col-md-1 text-center">
                    <button type="button" class="btn btn-sm btn-danger" onclick="removeColumnMapping(${mappingId})" title="Remove mapping">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(mappingRow);
    
    // Update preview on creation
    updateMappingPreview(mappingId);
}

// Handle transformation type change
function handleTransformationTypeChange(mappingId) {
    const transType = document.getElementById(`trans-type-${mappingId}`).value;
    const customDiv = document.getElementById(`trans-custom-${mappingId}`);
    
    // Show/hide custom expression field
    if (transType === 'custom') {
        customDiv.style.display = 'block';
    } else {
        customDiv.style.display = 'none';
    }
    
    updateMappingPreview(mappingId);
}

// Handle auto-generate mode change
function handleAutoGenerateChange(mappingId) {
    const autoGenMode = document.getElementById(`auto-gen-mode-${mappingId}`).value;
    const exprDiv = document.getElementById(`auto-gen-expr-div-${mappingId}`);
    
    // Show/hide expression field based on mode
    if (autoGenMode !== 'none') {
        exprDiv.style.display = 'block';
    } else {
        exprDiv.style.display = 'none';
    }
    
    updateMappingPreview(mappingId);
}

// Update mapping preview
function updateMappingPreview(mappingId) {
    const previewDiv = document.getElementById(`mapping-preview-${mappingId}`);
    const destCol = document.getElementById(`dest-col-${mappingId}`).value;
    const transType = document.getElementById(`trans-type-${mappingId}`).value;
    const ignoreChanges = document.getElementById(`ignore-changes-${mappingId}`).checked;
    const autoGenMode = document.getElementById(`auto-gen-mode-${mappingId}`).value;
    
    // Get selected source columns
    const selectedSources = [];
    document.querySelectorAll(`.src-col-checkbox-${mappingId}:checked`).forEach(cb => {
        selectedSources.push(cb.value);
    });
    
    if (selectedSources.length === 0 || !destCol) {
        previewDiv.innerHTML = '<small class="text-muted">Select source and destination columns</small>';
        return;
    }
    
    let previewText = '';
    let badges = [];
    
    // Add control badges
    if (ignoreChanges) {
        badges.push('<span class="badge bg-warning">Ignore Changes</span>');
    }
    if (autoGenMode !== 'none') {
        const autoGenExpr = document.getElementById(`auto-gen-expr-${mappingId}`).value;
        const modeText = autoGenMode === 'on_insert' ? 'Auto-Gen (Insert)' : 'Auto-Gen (Init)';
        badges.push(`<span class="badge bg-info">${modeText}</span>`);
    }
    
    if (selectedSources.length === 1 && !transType && autoGenMode === 'none') {
        // Simple 1:1 mapping
        previewText = `<strong>${selectedSources[0]}</strong> → <strong>${destCol}</strong>`;
        if (badges.length > 0) {
            previewText += `<div class="mt-1">${badges.join(' ')}</div>`;
        }
    } else {
        // Complex mapping with transformation or controls
        let transformation = '';
        
        if (autoGenMode !== 'none') {
            const autoGenExpr = document.getElementById(`auto-gen-expr-${mappingId}`).value;
            transformation = autoGenExpr || '<i>Enter auto-generate expression</i>';
        } else if (transType === 'json') {
            const jsonPairs = selectedSources.map(col => `'${col}': ${col}`).join(', ');
            transformation = `JSON_OBJECT(${jsonPairs})`;
        } else if (transType === 'concat') {
            transformation = `CONCAT(${selectedSources.join(", ', ', ")})`;
        } else if (transType === 'custom') {
            const customExpr = document.getElementById(`trans-expr-${mappingId}`).value;
            transformation = customExpr || '<i>Enter custom expression</i>';
        } else {
            // Multiple columns without transformation
            transformation = `[${selectedSources.join(', ')}]`;
        }
        
        previewText = `
            <div><strong>Sources:</strong> ${selectedSources.join(', ')}</div>
            <div><strong>Destination:</strong> ${destCol}</div>
            <div><strong>Transform:</strong> <code class="small">${transformation}</code></div>
        `;
        
        if (badges.length > 0) {
            previewText += `<div class="mt-2">${badges.join(' ')}</div>`;
        }
    }
    
    previewDiv.innerHTML = previewText;
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
    let errorMessage = '';
    
    mappingRows.forEach((row, index) => {
        const rowId = row.id.split('-')[2];
        
        // Get selected source columns (checkboxes)
        const selectedSources = [];
        document.querySelectorAll(`.src-col-checkbox-${rowId}:checked`).forEach(cb => {
            selectedSources.push(cb.value);
        });
        
        const destCol = document.getElementById(`dest-col-${rowId}`).value;
        const transType = document.getElementById(`trans-type-${rowId}`).value;
        const ignoreChanges = document.getElementById(`ignore-changes-${rowId}`).checked;
        const autoGenMode = document.getElementById(`auto-gen-mode-${rowId}`).value;
        const autoGenExpr = document.getElementById(`auto-gen-expr-${rowId}`)?.value || null;
        const defaultValue = document.getElementById(`default-value-${rowId}`)?.value || null;
        
        // Validation
        if (selectedSources.length === 0) {
            hasError = true;
            errorMessage = `Mapping ${index + 1}: Please select at least one source column`;
            return;
        }
        
        if (!destCol) {
            hasError = true;
            errorMessage = `Mapping ${index + 1}: Please select a destination column`;
            return;
        }
        
        // Validate auto-generate expression if mode is set
        if (autoGenMode !== 'none' && !autoGenExpr) {
            hasError = true;
            errorMessage = `Mapping ${index + 1}: Please enter an auto-generate expression`;
            return;
        }
        
        // Build transformation
        let transformation = null;
        let transformationType = null;
        
        if (transType) {
            transformationType = transType;
            
            if (transType === 'json') {
                // Generate JSON_OBJECT transformation
                const jsonPairs = selectedSources.map(col => `'${col}', ${col}`).join(', ');
                transformation = `JSON_OBJECT(${jsonPairs})`;
            } else if (transType === 'concat') {
                // Generate CONCAT transformation
                transformation = `CONCAT(${selectedSources.join(", ', ', ")})`;
            } else if (transType === 'custom') {
                // Use custom expression
                const customExpr = document.getElementById(`trans-expr-${rowId}`).value;
                if (!customExpr) {
                    hasError = true;
                    errorMessage = `Mapping ${index + 1}: Please enter a custom transformation expression`;
                    return;
                }
                transformation = customExpr;
                
                // Replace placeholders with actual column names
                selectedSources.forEach((col, idx) => {
                    const placeholder = `{col${idx + 1}}`;
                    transformation = transformation.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), col);
                });
            }
        }
        
        // Create column mapping object
        const colMapping = {
            destination_column: destCol,
            transformation: transformation,
            transformation_type: transformationType,
            ignore_changes: ignoreChanges,
            auto_generate: autoGenMode,
            auto_generate_expression: autoGenExpr,
            default_value: defaultValue
        };
        
        // Add source column(s) - backward compatible
        if (selectedSources.length === 1) {
            colMapping.source_column = selectedSources[0];
        } else {
            colMapping.source_columns = selectedSources;
        }
        
        columnMappings.push(colMapping);
    });
    
    if (hasError) {
        showAlert('warning', errorMessage || 'Please complete all column mappings');
        return;
    }
    
    // Build the mapping object
    const useDuckDB = document.getElementById('mapUseDuckDB').checked;
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
        sync_deletes: document.getElementById('mapSyncDeletes').checked,
        use_duckdb_transformation: useDuckDB
    };
    
    // Add DuckDB transformation details if enabled
    if (useDuckDB) {
        const scriptSelect = document.getElementById('mapDuckDBScript').value;
        const scriptContent = document.getElementById('mapDuckDBScriptContent').value;
        
        if (scriptSelect && scriptSelect !== '__inline__') {
            mapping.duckdb_script_name = scriptSelect;
        } else if (scriptContent && scriptContent.trim()) {
            mapping.duckdb_script_content = scriptContent;
        } else {
            showAlert('warning', 'DuckDB transformation enabled but no script provided');
            return;
        }
    }
    
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

// View mapping details
async function viewMappingDetails(mappingId) {
    try {
        const response = await fetch(`${API_BASE}/admin/mapping/${mappingId}`);
        const mapping = await response.json();
        
        let detailsHtml = `
            <div class="mb-3">
                <h6>Source: ${mapping.source_schema}.${mapping.source_table}</h6>
                <h6>Destination: ${mapping.destination_schema}.${mapping.destination_table}</h6>
            </div>
            <hr>
            <h6 class="mb-3">Column Mappings:</h6>
            <div class="table-responsive">
                <table class="table table-sm table-bordered">
                    <thead>
                        <tr>
                            <th>Source Column(s)</th>
                            <th>Destination Column</th>
                            <th>Transformation</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        mapping.column_mappings.forEach((cm, idx) => {
            let sourceDisplay = '';
            if (cm.source_columns && cm.source_columns.length > 0) {
                sourceDisplay = cm.source_columns.join(', ');
            } else if (cm.source_column) {
                sourceDisplay = cm.source_column;
            }
            
            let transformDisplay = '-';
            let controlBadges = [];
            
            // Add transformation display
            if (cm.transformation_type) {
                if (cm.transformation_type === 'json') {
                    transformDisplay = '<span class="badge bg-info">JSON Object</span>';
                } else if (cm.transformation_type === 'concat') {
                    transformDisplay = '<span class="badge bg-warning">Concatenation</span>';
                } else if (cm.transformation_type === 'custom') {
                    transformDisplay = '<span class="badge bg-primary">Custom</span>';
                }
                if (cm.transformation) {
                    transformDisplay += `<br><code class="small">${cm.transformation}</code>`;
                }
            } else if (cm.transformation) {
                transformDisplay = `<code class="small">${cm.transformation}</code>`;
            }
            
            // Add control badges
            if (cm.ignore_changes) {
                controlBadges.push('<span class="badge bg-warning"><i class="bi bi-x-circle"></i> Ignore Changes</span>');
            }
            if (cm.auto_generate && cm.auto_generate !== 'none') {
                const mode = cm.auto_generate === 'on_insert' ? 'On Insert' : 'On Init';
                controlBadges.push(`<span class="badge bg-info"><i class="bi bi-lightning"></i> Auto-Gen (${mode})</span>`);
                if (cm.auto_generate_expression) {
                    controlBadges.push(`<br><small><code>${cm.auto_generate_expression}</code></small>`);
                }
            }
            
            if (controlBadges.length > 0) {
                transformDisplay += '<br>' + controlBadges.join(' ');
            }
            
            detailsHtml += `
                <tr>
                    <td>${sourceDisplay}</td>
                    <td><strong>${cm.destination_column}</strong></td>
                    <td>${transformDisplay}</td>
                </tr>
            `;
        });
        
        detailsHtml += `
                    </tbody>
                </table>
            </div>
            <hr>
            <div class="row">
                <div class="col-md-4">
                    <strong>Sync Inserts:</strong> ${mapping.sync_inserts ? '✓' : '✗'}
                </div>
                <div class="col-md-4">
                    <strong>Sync Updates:</strong> ${mapping.sync_updates ? '✓' : '✗'}
                </div>
                <div class="col-md-4">
                    <strong>Sync Deletes:</strong> ${mapping.sync_deletes ? '✓' : '✗'}
                </div>
            </div>
        `;
        
        // Show in alert or modal (for now, let's use a simple approach)
        // Create a temporary modal
        const existingModal = document.getElementById('mappingDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modalHtml = `
            <div class="modal fade" id="mappingDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Mapping Details: ${mapping.id}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${detailsHtml}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('mappingDetailsModal'));
        modal.show();
        
        // Remove modal from DOM when hidden
        document.getElementById('mappingDetailsModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
        
    } catch (error) {
        showAlert('danger', `Error loading mapping details: ${error.message}`);
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

// ==================== DUCKDB TRANSFORMATION FUNCTIONS ====================

function toggleDuckDBOptions() {
    const checkbox = document.getElementById('mapUseDuckDB');
    const options = document.getElementById('duckdbOptions');
    
    if (checkbox.checked) {
        options.style.display = 'block';
        loadAvailableDuckDBScripts();
    } else {
        options.style.display = 'none';
    }
}

async function loadAvailableDuckDBScripts() {
    const select = document.getElementById('mapDuckDBScript');
    
    try {
        const response = await fetch(`${API_BASE}/admin/duckdb/scripts/list`);
        const scripts = await response.json();
        
        // Keep the inline option
        select.innerHTML = '<option value="">Select script...</option><option value="__inline__">Inline Script (Enter Below)</option>';
        
        // Add templates
        const templates = scripts.filter(s => s.category === 'template');
        if (templates.length > 0) {
            const templateGroup = document.createElement('optgroup');
            templateGroup.label = 'Templates';
            templates.forEach(script => {
                const option = document.createElement('option');
                option.value = script.name;
                option.textContent = `${script.name} - ${script.description}`;
                option.dataset.category = 'template';
                templateGroup.appendChild(option);
            });
            select.appendChild(templateGroup);
        }
        
        // Add custom scripts
        const customs = scripts.filter(s => s.category === 'custom');
        if (customs.length > 0) {
            const customGroup = document.createElement('optgroup');
            customGroup.label = 'Custom Scripts';
            customs.forEach(script => {
                const option = document.createElement('option');
                option.value = script.name;
                option.textContent = `${script.name} - ${script.description}`;
                option.dataset.category = 'custom';
                customGroup.appendChild(option);
            });
            select.appendChild(customGroup);
        }
        
    } catch (error) {
        console.error('Error loading DuckDB scripts:', error);
        showAlert('warning', 'Could not load DuckDB scripts list');
    }
}

async function loadDuckDBScriptPreview() {
    const select = document.getElementById('mapDuckDBScript');
    const textarea = document.getElementById('mapDuckDBScriptContent');
    const scriptName = select.value;
    
    if (!scriptName || scriptName === '__inline__') {
        // Clear for inline entry
        if (scriptName === '__inline__') {
            textarea.value = '';
            textarea.readOnly = false;
            textarea.focus();
        }
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/duckdb/scripts/${scriptName}`);
        const result = await response.json();
        
        if (result.success && result.content) {
            textarea.value = result.content;
            textarea.readOnly = true; // Make read-only for loaded scripts
            showAlert('success', `Loaded script: ${scriptName}`);
        } else {
            showAlert('danger', 'Could not load script content');
        }
    } catch (error) {
        console.error('Error loading script content:', error);
        showAlert('danger', `Error loading script: ${error.message}`);
    }
}

async function uploadDuckDBScript() {
    const fileInput = document.getElementById('mapDuckDBScriptFile');
    const textarea = document.getElementById('mapDuckDBScriptContent');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        showAlert('warning', 'Please select a file to upload');
        return;
    }
    
    const file = fileInput.files[0];
    
    try {
        const content = await file.text();
        textarea.value = content;
        textarea.readOnly = false;
        
        // Set select to inline
        document.getElementById('mapDuckDBScript').value = '__inline__';
        
        showAlert('success', `Loaded script from file: ${file.name}`);
    } catch (error) {
        console.error('Error reading file:', error);
        showAlert('danger', `Error reading file: ${error.message}`);
    }
}

async function validateDuckDBScript() {
    const content = document.getElementById('mapDuckDBScriptContent').value;
    
    if (!content || !content.trim()) {
        showAlert('warning', 'Please enter a script to validate');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/duckdb/scripts/validate`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({content: content})
        });
        
        const result = await response.json();
        
        if (result.valid) {
            showAlert('success', 'Script validation passed! ' + result.message);
        } else {
            showAlert('danger', 'Script validation failed: ' + result.message);
        }
    } catch (error) {
        console.error('Error validating script:', error);
        showAlert('danger', `Error validating script: ${error.message}`);
    }
}

function viewDuckDBScripts() {
    showAlert('info', 'DuckDB scripts are located in the duckdb_scripts/ directory. Templates in duckdb_scripts/templates/, custom scripts in duckdb_scripts/custom/.');
}





