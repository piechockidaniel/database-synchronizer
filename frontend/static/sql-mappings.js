// SQL Mappings Management
const API_BASE = '/api';

let currentSQLMapping = null;
let availableWorksets = [];

// Load SQL mappings when tab is shown
document.addEventListener('DOMContentLoaded', () => {
    const sqlMappingsTab = document.getElementById('sql-mappings-tab');
    if (sqlMappingsTab) {
        sqlMappingsTab.addEventListener('shown.bs.tab', () => {
            loadSQLMappings();
            loadWorksetsForSQLMapping();
        });
    }
    
    // Show/hide key columns based on sync mode
    const syncModeSelect = document.getElementById('sqlMappingSyncMode');
    if (syncModeSelect) {
        syncModeSelect.addEventListener('change', function() {
            const keyColumnsContainer = document.getElementById('sqlMappingKeyColumnsContainer');
            if (this.value === 'upsert') {
                keyColumnsContainer.style.display = 'block';
            } else {
                keyColumnsContainer.style.display = 'none';
            }
        });
    }
    
    // Load worksets on page load
    loadWorksetsForSQLMapping();
});

// Load worksets for assignment dropdown
async function loadWorksetsForSQLMapping() {
    try {
        const response = await fetch(`${API_BASE}/admin/workset/list`);
        const worksets = await response.json();
        availableWorksets = worksets;
        
        const worksetSelect = document.getElementById('sqlMappingWorkset');
        if (!worksetSelect) return;
        
        worksetSelect.innerHTML = '';
        worksets.forEach(ws => {
            const option = document.createElement('option');
            option.value = ws.id;
            option.textContent = `${ws.name}${ws.is_active ? ' (Active)' : ''}`;
            worksetSelect.appendChild(option);
        });
        
        if (worksets.length === 0) {
            worksetSelect.innerHTML = '<option value="">No worksets available</option>';
        }
    } catch (error) {
        console.error('Error loading worksets:', error);
        const worksetSelect = document.getElementById('sqlMappingWorkset');
        if (worksetSelect) {
            worksetSelect.innerHTML = '<option value="">Error loading worksets</option>';
        }
    }
}

// Load all SQL mappings
async function loadSQLMappings() {
    try {
        const response = await fetch(`${API_BASE}/admin/sql-mapping/list`);
        const mappings = await response.json();
        
        const container = document.getElementById('sqlMappingsList');
        
        if (!mappings || mappings.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> No SQL mappings found. 
                    Click "Create SQL Mapping" to create your first one.
                </div>
            `;
            return;
        }
        
        let html = '<div class="table-responsive"><table class="table table-hover">';
        html += `
            <thead>
                <tr>
                    <th>Name</th>
                    <th>ID</th>
                    <th>Destination</th>
                    <th>Sync Mode</th>
                    <th>Schedule</th>
                    <th>Worksets</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        // Load worksets to map IDs to names
        const worksetMap = {};
        availableWorksets.forEach(ws => {
            worksetMap[ws.id] = ws.name;
        });
        
        mappings.forEach(mapping => {
            const createdDate = new Date(mapping.created_at).toLocaleDateString();
            const scheduleDisplay = mapping.sync_schedule ? 
                `<code class="small">${mapping.sync_schedule}</code>` : 
                '<span class="text-muted">Manual</span>';
            
            // Get workset names for this mapping
            const assignedWorksets = mapping.assigned_worksets || [];
            const worksetNames = assignedWorksets
                .map(wsId => worksetMap[wsId] || wsId)
                .join(', ') || '<span class="text-muted">None</span>';
            
            html += `
                <tr>
                    <td><strong>${mapping.name}</strong></td>
                    <td><code>${mapping.id}</code></td>
                    <td>${mapping.destination_schema}.${mapping.destination_table}</td>
                    <td><span class="badge bg-info">${mapping.sync_mode}</span></td>
                    <td>${scheduleDisplay}</td>
                    <td><small>${worksetNames}</small></td>
                    <td>
                        ${mapping.enabled ? 
                            '<span class="badge bg-success">Enabled</span>' : 
                            '<span class="badge bg-secondary">Disabled</span>'}
                    </td>
                    <td>${createdDate}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="viewSQLMapping('${mapping.id}')">
                            <i class="bi bi-eye"></i> View
                        </button>
                        <button class="btn btn-sm btn-outline-info" onclick="editSQLMapping('${mapping.id}')">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-outline-success" onclick="executeSQLMapping('${mapping.id}')">
                            <i class="bi bi-play-circle"></i> Run
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteSQLMapping('${mapping.id}')">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading SQL mappings:', error);
        showAlert('danger', `Error loading SQL mappings: ${error.message}`);
    }
}

// Show SQL mapping modal for creation
function showSQLMappingModal() {
    currentSQLMapping = null;
    document.getElementById('sqlMappingModalTitle').textContent = 'Create SQL Mapping';
    document.getElementById('sqlMappingForm').reset();
    document.getElementById('sqlMappingId').value = '';
    document.getElementById('sqlMappingIdInput').disabled = false;
    document.getElementById('sqlMappingEnabled').checked = true;
    document.getElementById('sqlMappingSyncMode').value = 'full';
    document.getElementById('sqlMappingBatchSize').value = '1000';
    document.getElementById('sqlMappingTimeout').value = '300';
    document.getElementById('sqlMappingSchedule').value = '';
    document.getElementById('sqlMappingKeyColumnsContainer').style.display = 'none';
    
    // Clear workset selection
    const worksetSelect = document.getElementById('sqlMappingWorkset');
    if (worksetSelect) {
        Array.from(worksetSelect.options).forEach(option => {
            option.selected = false;
        });
    }
    
    const modal = new bootstrap.Modal(document.getElementById('sqlMappingModal'));
    modal.show();
}

// View SQL mapping details
async function viewSQLMapping(mappingId) {
    try {
        const response = await fetch(`${API_BASE}/admin/sql-mapping/${mappingId}`);
        const mapping = await response.json();
        
        let html = `
            <div class="card">
                <div class="card-header">
                    <h5><i class="bi bi-code-square"></i> ${mapping.name}</h5>
                </div>
                <div class="card-body">
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <strong>Mapping ID:</strong> <code>${mapping.id}</code>
                        </div>
                        <div class="col-md-6">
                            <strong>Status:</strong> 
                            ${mapping.enabled ? 
                                '<span class="badge bg-success">Enabled</span>' : 
                                '<span class="badge bg-secondary">Disabled</span>'}
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <strong>Source Query:</strong>
                        <pre class="bg-light p-3 rounded"><code>${mapping.source_query}</code></pre>
                    </div>
                    
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <strong>Destination:</strong> ${mapping.destination_schema}.${mapping.destination_table}
                        </div>
                        <div class="col-md-6">
                            <strong>Sync Mode:</strong> <span class="badge bg-info">${mapping.sync_mode}</span>
                        </div>
                    </div>
                    
                    <div class="row mb-3">
                        <div class="col-md-4">
                            <strong>Batch Size:</strong> ${mapping.batch_size}
                        </div>
                        <div class="col-md-4">
                            <strong>Timeout:</strong> ${mapping.timeout_seconds}s
                        </div>
                        <div class="col-md-4">
                            <strong>Key Columns:</strong> ${mapping.key_columns ? mapping.key_columns.join(', ') : 'N/A'}
                        </div>
                    </div>
                    
                    ${mapping.insert_query ? `
                        <div class="mb-3">
                            <strong>Custom INSERT Query:</strong>
                            <pre class="bg-light p-2 rounded small"><code>${mapping.insert_query}</code></pre>
                        </div>
                    ` : ''}
                    
                    ${mapping.update_query ? `
                        <div class="mb-3">
                            <strong>Custom UPDATE Query:</strong>
                            <pre class="bg-light p-2 rounded small"><code>${mapping.update_query}</code></pre>
                        </div>
                    ` : ''}
                    
                    <div class="mb-3">
                        <strong>Schedule:</strong> ${mapping.sync_schedule ? `<code>${mapping.sync_schedule}</code>` : '<span class="text-muted">Manual execution only</span>'}
                    </div>
                    
                    <div class="mb-3">
                        <strong>Assigned Worksets:</strong> 
                        ${mapping.assigned_worksets && mapping.assigned_worksets.length > 0 ? 
                            mapping.assigned_worksets.map(wsId => {
                                const ws = availableWorksets.find(w => w.id === wsId);
                                return ws ? ws.name : wsId;
                            }).join(', ') : 
                            '<span class="text-muted">None</span>'}
                    </div>
                    
                    <div class="mb-3">
                        <strong>Created:</strong> ${new Date(mapping.created_at).toLocaleString()}<br>
                        <strong>Updated:</strong> ${new Date(mapping.updated_at).toLocaleString()}
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-sm btn-primary" onclick="editSQLMapping('${mapping.id}')">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSQLMapping('${mapping.id}')">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
        
        // Show in a modal or alert
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">SQL Mapping Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">${html}</div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
        modal.addEventListener('hidden.bs.modal', () => modal.remove());
        
    } catch (error) {
        console.error('Error viewing SQL mapping:', error);
        showAlert('danger', `Error loading SQL mapping: ${error.message}`);
    }
}

// Edit SQL mapping
async function editSQLMapping(mappingId) {
    try {
        const response = await fetch(`${API_BASE}/admin/sql-mapping/${mappingId}`);
        const mapping = await response.json();
        
        currentSQLMapping = mapping;
        document.getElementById('sqlMappingModalTitle').textContent = 'Edit SQL Mapping';
        document.getElementById('sqlMappingId').value = mapping.id;
        document.getElementById('sqlMappingIdInput').value = mapping.id;
        document.getElementById('sqlMappingIdInput').disabled = true;
        document.getElementById('sqlMappingName').value = mapping.name;
        document.getElementById('sqlMappingSourceQuery').value = mapping.source_query;
        document.getElementById('sqlMappingDestSchema').value = mapping.destination_schema;
        document.getElementById('sqlMappingDestTable').value = mapping.destination_table;
        document.getElementById('sqlMappingSyncMode').value = mapping.sync_mode;
        document.getElementById('sqlMappingBatchSize').value = mapping.batch_size;
        document.getElementById('sqlMappingTimeout').value = mapping.timeout_seconds;
        document.getElementById('sqlMappingEnabled').checked = mapping.enabled;
        document.getElementById('sqlMappingInsertQuery').value = mapping.insert_query || '';
        document.getElementById('sqlMappingUpdateQuery').value = mapping.update_query || '';
        document.getElementById('sqlMappingSchedule').value = mapping.sync_schedule || '';
        
        if (mapping.key_columns && mapping.key_columns.length > 0) {
            document.getElementById('sqlMappingKeyColumns').value = mapping.key_columns.join(', ');
        }
        
        // Set workset selection
        const worksetSelect = document.getElementById('sqlMappingWorkset');
        if (worksetSelect && mapping.assigned_worksets) {
            Array.from(worksetSelect.options).forEach(option => {
                option.selected = mapping.assigned_worksets.includes(option.value);
            });
        }
        
        // Show/hide key columns container
        const keyColumnsContainer = document.getElementById('sqlMappingKeyColumnsContainer');
        if (mapping.sync_mode === 'upsert') {
            keyColumnsContainer.style.display = 'block';
        } else {
            keyColumnsContainer.style.display = 'none';
        }
        
        const modal = new bootstrap.Modal(document.getElementById('sqlMappingModal'));
        modal.show();
        
    } catch (error) {
        console.error('Error loading SQL mapping for edit:', error);
        showAlert('danger', `Error loading SQL mapping: ${error.message}`);
    }
}

// Save SQL mapping
async function saveSQLMapping() {
    const form = document.getElementById('sqlMappingForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const mappingId = document.getElementById('sqlMappingIdInput').value.trim();
    const keyColumnsValue = document.getElementById('sqlMappingKeyColumns').value.trim();
    const scheduleValue = document.getElementById('sqlMappingSchedule').value.trim();
    
    // Get selected worksets
    const worksetSelect = document.getElementById('sqlMappingWorkset');
    const selectedWorksets = Array.from(worksetSelect.selectedOptions).map(opt => opt.value);
    
    const mapping = {
        id: mappingId,
        name: document.getElementById('sqlMappingName').value.trim(),
        source_query: document.getElementById('sqlMappingSourceQuery').value.trim(),
        destination_schema: document.getElementById('sqlMappingDestSchema').value.trim(),
        destination_table: document.getElementById('sqlMappingDestTable').value.trim(),
        sync_mode: document.getElementById('sqlMappingSyncMode').value,
        batch_size: parseInt(document.getElementById('sqlMappingBatchSize').value),
        timeout_seconds: parseInt(document.getElementById('sqlMappingTimeout').value),
        enabled: document.getElementById('sqlMappingEnabled').checked,
        sync_schedule: scheduleValue || null,
        insert_query: document.getElementById('sqlMappingInsertQuery').value.trim() || null,
        update_query: document.getElementById('sqlMappingUpdateQuery').value.trim() || null,
        key_columns: keyColumnsValue ? keyColumnsValue.split(',').map(s => s.trim()) : null,
        assigned_worksets: selectedWorksets
    };
    
    try {
        const url = currentSQLMapping ? 
            `${API_BASE}/admin/sql-mapping/update` : 
            `${API_BASE}/admin/sql-mapping/create`;
        const method = currentSQLMapping ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(mapping)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', result.message);
            bootstrap.Modal.getInstance(document.getElementById('sqlMappingModal')).hide();
            loadSQLMappings();
        } else {
            showAlert('danger', result.message || 'Failed to save SQL mapping');
        }
    } catch (error) {
        console.error('Error saving SQL mapping:', error);
        showAlert('danger', `Error saving SQL mapping: ${error.message}`);
    }
}

// Test SQL mapping query
async function testSQLMapping() {
    const sourceQuery = document.getElementById('sqlMappingSourceQuery').value.trim();
    
    if (!sourceQuery) {
        showAlert('warning', 'Please enter a source query first');
        return;
    }
    
    const mappingId = document.getElementById('sqlMappingId').value || 'test';
    
    try {
        showAlert('info', 'Testing query...');
        
        const response = await fetch(`${API_BASE}/admin/sql-mapping/${mappingId}/test`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            let html = `
                <div class="alert alert-success">
                    <h6><i class="bi bi-check-circle"></i> Query Test Successful</h6>
                    <p><strong>Rows returned:</strong> ${result.row_count}</p>
                    <p><strong>Columns:</strong> ${result.columns.join(', ')}</p>
            `;
            
            if (result.sample_data && result.sample_data.length > 0) {
                html += '<h6>Sample Data:</h6><pre class="bg-light p-2 rounded small">';
                html += JSON.stringify(result.sample_data, null, 2);
                html += '</pre>';
            }
            
            html += '</div>';
            
            showAlert('success', html, true);
        } else {
            showAlert('danger', `Query test failed: ${result.error}`);
        }
    } catch (error) {
        console.error('Error testing SQL mapping:', error);
        showAlert('danger', `Error testing query: ${error.message}`);
    }
}

// Execute SQL mapping
async function executeSQLMapping(mappingId) {
    if (!confirm(`Execute SQL mapping "${mappingId}" now?`)) {
        return;
    }
    
    try {
        showAlert('info', 'Executing SQL mapping...');
        
        const response = await fetch(`${API_BASE}/operations/sql-mapping/${mappingId}/execute`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', `SQL mapping executed successfully: ${result.rows_processed} rows processed`);
            loadSQLMappings(); // Refresh list
        } else {
            showAlert('danger', `Execution failed: ${result.message}`);
        }
    } catch (error) {
        console.error('Error executing SQL mapping:', error);
        showAlert('danger', `Error executing SQL mapping: ${error.message}`);
    }
}

// Show cron expression helper
function showCronHelper() {
    const examples = [
        { expr: '0 0 * * *', desc: 'Daily at midnight' },
        { expr: '0 */6 * * *', desc: 'Every 6 hours' },
        { expr: '0 0 * * 0', desc: 'Weekly on Sunday at midnight' },
        { expr: '0 0 1 * *', desc: 'Monthly on the 1st at midnight' },
        { expr: '*/15 * * * *', desc: 'Every 15 minutes' },
        { expr: '0 9-17 * * 1-5', desc: 'Every hour from 9 AM to 5 PM, weekdays' },
        { expr: '0 0 1 1 *', desc: 'Yearly on January 1st' }
    ];
    
    let html = `
        <div class="card">
            <div class="card-header">
                <h6><i class="bi bi-clock"></i> Cron Expression Helper</h6>
            </div>
            <div class="card-body">
                <p class="small">Format: <code>minute hour day month weekday</code></p>
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Expression</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    examples.forEach(ex => {
        html += `
            <tr>
                <td><code>${ex.expr}</code></td>
                <td>${ex.desc}</td>
            </tr>
        `;
    });
    
    html += `
                    </tbody>
                </table>
                <div class="alert alert-info small">
                    <strong>Fields:</strong><br>
                    <code>minute</code>: 0-59<br>
                    <code>hour</code>: 0-23<br>
                    <code>day</code>: 1-31<br>
                    <code>month</code>: 1-12<br>
                    <code>weekday</code>: 0-7 (0 or 7 = Sunday)
                </div>
                <div class="alert alert-warning small">
                    <strong>Special characters:</strong><br>
                    <code>*</code> = any value<br>
                    <code>*/n</code> = every n units<br>
                    <code>a-b</code> = range from a to b<br>
                    <code>a,b</code> = list of values
                </div>
            </div>
            <div class="card-footer">
                <button class="btn btn-sm btn-secondary" onclick="this.closest('.modal').querySelector('.btn-close').click()">Close</button>
            </div>
        </div>
    `;
    
    // Create and show modal
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Cron Expression Helper</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">${html}</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}

// Delete SQL mapping
async function deleteSQLMapping(mappingId) {
    if (!confirm('Are you sure you want to delete this SQL mapping? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/admin/sql-mapping/${mappingId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', result.message);
            loadSQLMappings();
        } else {
            showAlert('danger', result.message || 'Failed to delete SQL mapping');
        }
    } catch (error) {
        console.error('Error deleting SQL mapping:', error);
        showAlert('danger', `Error deleting SQL mapping: ${error.message}`);
    }
}

