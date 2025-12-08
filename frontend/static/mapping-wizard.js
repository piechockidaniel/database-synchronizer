// Unified Mapping Creation Wizard
const API_BASE = '/api';

let currentStep = 1;
let mappingData = {
    mapping_type: null,
    // Common fields
    id: '',
    name: '',
    destination_schema: '',
    destination_table: '',
    enabled: true,
    assigned_worksets: [],
    sync_mode: 'full',
    sync_schedule: null,
    batch_size: 1000,
    timeout_seconds: 300,
    // TABLE-specific fields
    source_schema: '',
    source_table: '',
    column_mappings: [],
    sync_deletes: true,
    sync_updates: true,
    sync_inserts: true,
    use_duckdb_transformation: false,
    duckdb_script_name: null,
    duckdb_script_content: null,
    perform_initial_snapshot: false,
    // SQL-specific fields
    source_query: '',
    insert_query: null,
    update_query: null,
    delete_query: null,
    key_columns: []
};

// Initialize wizard
function initMappingWizard() {
    currentStep = 1;
    mappingData = {
        mapping_type: null,
        id: '',
        name: '',
        destination_schema: '',
        destination_table: '',
        enabled: true,
        assigned_worksets: [],
        sync_mode: 'full',
        sync_schedule: null,
        batch_size: 1000,
        timeout_seconds: 300,
        source_schema: '',
        source_table: '',
        column_mappings: [],
        sync_deletes: true,
        sync_updates: true,
        sync_inserts: true,
        use_duckdb_transformation: false,
        duckdb_script_name: null,
        duckdb_script_content: null,
        perform_initial_snapshot: false,
        source_query: '',
        insert_query: null,
        update_query: null,
        delete_query: null,
        key_columns: []
    };
    updateWizardUI();
}

// Show wizard modal
function showMappingWizard() {
    initMappingWizard();
    const modal = new bootstrap.Modal(document.getElementById('mappingWizardModal'));
    modal.show();
}

// Show wizard for editing
function showMappingWizardForEdit(mappingId) {
    initMappingWizard();
    loadMappingForEdit(mappingId);
    const modal = new bootstrap.Modal(document.getElementById('mappingWizardModal'));
    modal.show();
}

// Load mapping for editing
async function loadMappingForEdit(mappingId) {
    try {
        const response = await fetch(`${API_BASE}/admin/mapping/${mappingId}`);
        if (!response.ok) throw new Error('Failed to load mapping');
        
        const mapping = await response.json();
        
        // Populate mappingData
        Object.keys(mapping).forEach(key => {
            if (mapping[key] !== null && mapping[key] !== undefined) {
                mappingData[key] = mapping[key];
            }
        });
        
        // Set current step based on mapping type
        currentStep = mapping.mapping_type === 'table' ? 2 : 2;
        updateWizardUI();
        populateWizardForm();
    } catch (error) {
        showAlert('danger', `Error loading mapping: ${error.message}`);
    }
}

// Update wizard UI based on current step
function updateWizardUI() {
    // Update step indicators
    for (let i = 1; i <= 5; i++) {
        const stepEl = document.getElementById(`wizardStep${i}`);
        if (stepEl) {
            if (i < currentStep) {
                stepEl.classList.add('completed');
                stepEl.classList.remove('active');
            } else if (i === currentStep) {
                stepEl.classList.add('active');
                stepEl.classList.remove('completed');
            } else {
                stepEl.classList.remove('active', 'completed');
            }
        }
        
        const stepContent = document.getElementById(`wizardStepContent${i}`);
        if (stepContent) {
            stepContent.style.display = i === currentStep ? 'block' : 'none';
        }
    }
    
    // Update buttons
    const prevBtn = document.getElementById('wizardPrevBtn');
    const nextBtn = document.getElementById('wizardNextBtn');
    
    if (prevBtn) {
        prevBtn.disabled = currentStep === 1;
    }
    
    if (nextBtn) {
        if (currentStep === 5) {
            nextBtn.innerHTML = '<i class="bi bi-save"></i> Save Mapping';
            nextBtn.onclick = saveMappingFromWizard;
        } else {
            nextBtn.innerHTML = 'Next <i class="bi bi-arrow-right"></i>';
            nextBtn.onclick = nextWizardStep;
        }
    }
    
    // Load step-specific data when step becomes active
    if (currentStep === 4) {
        // Load worksets when step 4 becomes active
        loadWorksetsForWizard();
    } else if (currentStep === 5) {
        // Populate review content when step 5 becomes active
        populateReviewContent();
    }
}

// Navigate to next step
function nextWizardStep() {
    if (validateCurrentStep()) {
        if (currentStep < 5) {
            currentStep++;
            updateWizardUI();
        }
    }
}

// Navigate to previous step
function prevWizardStep() {
    if (currentStep > 1) {
        currentStep--;
        updateWizardUI();
    }
}

// Validate current step
function validateCurrentStep() {
    switch (currentStep) {
        case 1:
            // Step 1: Select mapping type
            if (!mappingData.mapping_type) {
                showAlert('warning', 'Please select a mapping type');
                return false;
            }
            return true;
            
        case 2:
            // Step 2: Configure based on type
            if (mappingData.mapping_type === 'table') {
                if (!mappingData.source_schema || !mappingData.source_table ||
                    !mappingData.destination_schema || !mappingData.destination_table) {
                    showAlert('warning', 'Please fill in all required table fields');
                    return false;
                }
                if (!mappingData.column_mappings || mappingData.column_mappings.length === 0) {
                    showAlert('warning', 'Please add at least one column mapping');
                    return false;
                }
            } else if (mappingData.mapping_type === 'sql') {
                if (!mappingData.source_query || !mappingData.destination_schema || !mappingData.destination_table) {
                    showAlert('warning', 'Please fill in source query, destination schema, and destination table');
                    return false;
                }
            }
            return true;
            
        case 3:
            // Step 3: Sync options (always valid)
            return true;
            
        case 4:
            // Step 4: Assign to worksets (optional)
            return true;
            
        case 5:
            // Step 5: Review (always valid)
            return true;
            
        default:
            return true;
    }
}

// Populate wizard form from mappingData
function populateWizardForm() {
    // Step 1: Mapping type
    if (mappingData.mapping_type) {
        document.getElementById('wizardMappingType').value = mappingData.mapping_type;
        onMappingTypeChange();
    }
    
    // Common fields
    document.getElementById('wizardMappingId').value = mappingData.id || '';
    document.getElementById('wizardMappingName').value = mappingData.name || '';
    document.getElementById('wizardDestSchema').value = mappingData.destination_schema || '';
    document.getElementById('wizardDestTable').value = mappingData.destination_table || '';
    document.getElementById('wizardEnabled').checked = mappingData.enabled !== false;
    
    // TABLE-specific fields
    if (mappingData.mapping_type === 'table') {
        document.getElementById('wizardSrcSchema').value = mappingData.source_schema || '';
        document.getElementById('wizardSrcTable').value = mappingData.source_table || '';
        document.getElementById('wizardSyncDeletes').checked = mappingData.sync_deletes !== false;
        document.getElementById('wizardSyncUpdates').checked = mappingData.sync_updates !== false;
        document.getElementById('wizardSyncInserts').checked = mappingData.sync_inserts !== false;
        document.getElementById('wizardPerformSnapshot').checked = mappingData.perform_initial_snapshot === true;
        document.getElementById('wizardUseDuckDB').checked = mappingData.use_duckdb_transformation === true;
        
        // Load column mappings
        loadColumnMappingsForWizard();
    }
    
    // SQL-specific fields
    if (mappingData.mapping_type === 'sql') {
        document.getElementById('wizardSourceQuery').value = mappingData.source_query || '';
        document.getElementById('wizardSyncMode').value = mappingData.sync_mode || 'full';
        document.getElementById('wizardBatchSize').value = mappingData.batch_size || 1000;
        document.getElementById('wizardTimeout').value = mappingData.timeout_seconds || 300;
        
        if (mappingData.key_columns && mappingData.key_columns.length > 0) {
            document.getElementById('wizardKeyColumns').value = mappingData.key_columns.join(', ');
        }
        
        if (mappingData.insert_query) {
            document.getElementById('wizardInsertQuery').value = mappingData.insert_query;
        }
        if (mappingData.update_query) {
            document.getElementById('wizardUpdateQuery').value = mappingData.update_query;
        }
    }
    
    // Step 3: Sync options
    document.getElementById('wizardSyncMode').value = mappingData.sync_mode || 'full';
    document.getElementById('wizardSyncSchedule').value = mappingData.sync_schedule || '';
    document.getElementById('wizardBatchSize').value = mappingData.batch_size || 1000;
    document.getElementById('wizardTimeout').value = mappingData.timeout_seconds || 300;
    
    // Step 4: Worksets - will be handled when step 4 loads via loadWorksetsForWizard()
    // The function checks mappingData.assigned_worksets and sets checkboxes accordingly
}

// Handle mapping type change
function onMappingTypeChange() {
    const mappingType = document.getElementById('wizardMappingType').value;
    mappingData.mapping_type = mappingType;
    
    // Show/hide type-specific sections
    const tableSection = document.getElementById('wizardTableSection');
    const sqlSection = document.getElementById('wizardSQLSection');
    
    if (mappingType === 'table') {
        if (tableSection) tableSection.style.display = 'block';
        if (sqlSection) sqlSection.style.display = 'none';
    } else if (mappingType === 'sql') {
        if (tableSection) tableSection.style.display = 'none';
        if (sqlSection) sqlSection.style.display = 'block';
    } else {
        if (tableSection) tableSection.style.display = 'none';
        if (sqlSection) sqlSection.style.display = 'none';
    }
}

// Collect data from current step
function collectStepData() {
    switch (currentStep) {
        case 1:
            mappingData.mapping_type = document.getElementById('wizardMappingType').value;
            break;
            
        case 2:
            // Common fields
            mappingData.id = document.getElementById('wizardMappingId').value;
            mappingData.name = document.getElementById('wizardMappingName').value;
            mappingData.destination_schema = document.getElementById('wizardDestSchema').value;
            mappingData.destination_table = document.getElementById('wizardDestTable').value;
            mappingData.enabled = document.getElementById('wizardEnabled').checked;
            
            if (mappingData.mapping_type === 'table') {
                // TABLE-specific
                mappingData.source_schema = document.getElementById('wizardSrcSchema').value;
                mappingData.source_table = document.getElementById('wizardSrcTable').value;
                mappingData.sync_deletes = document.getElementById('wizardSyncDeletes').checked;
                mappingData.sync_updates = document.getElementById('wizardSyncUpdates').checked;
                mappingData.sync_inserts = document.getElementById('wizardSyncInserts').checked;
                mappingData.perform_initial_snapshot = document.getElementById('wizardPerformSnapshot').checked;
                mappingData.use_duckdb_transformation = document.getElementById('wizardUseDuckDB').checked;
                
                // Column mappings are collected separately
            } else if (mappingData.mapping_type === 'sql') {
                // SQL-specific
                mappingData.source_query = document.getElementById('wizardSourceQuery').value;
                const keyCols = document.getElementById('wizardKeyColumns').value;
                mappingData.key_columns = keyCols ? keyCols.split(',').map(s => s.trim()).filter(s => s) : [];
                mappingData.insert_query = document.getElementById('wizardInsertQuery').value || null;
                mappingData.update_query = document.getElementById('wizardUpdateQuery').value || null;
            }
            break;
            
        case 3:
            // Sync options
            mappingData.sync_mode = document.getElementById('wizardSyncMode').value;
            mappingData.sync_schedule = document.getElementById('wizardSyncSchedule').value || null;
            mappingData.batch_size = parseInt(document.getElementById('wizardBatchSize').value) || 1000;
            mappingData.timeout_seconds = parseInt(document.getElementById('wizardTimeout').value) || 300;
            break;
            
        case 4:
            // Worksets
            const checkedWorksets = Array.from(document.querySelectorAll('.wizard-workset-checkbox:checked'))
                .map(cb => cb.value);
            mappingData.assigned_worksets = checkedWorksets;
            break;
            
        case 5:
            // Review - no data to collect
            break;
    }
}

// Save mapping from wizard
async function saveMappingFromWizard() {
    // Collect all step data
    for (let i = 1; i <= 4; i++) {
        currentStep = i;
        collectStepData();
    }
    
    // Final validation
    if (!mappingData.id || !mappingData.name) {
        showAlert('danger', 'Mapping ID and Name are required');
        return;
    }
    
    if (mappingData.mapping_type === 'table' && (!mappingData.column_mappings || mappingData.column_mappings.length === 0)) {
        showAlert('danger', 'Table mappings require at least one column mapping');
        return;
    }
    
    try {
        const url = mappingData.id && document.getElementById('wizardMappingId').hasAttribute('data-edit-id') 
            ? `${API_BASE}/admin/mapping/update`
            : `${API_BASE}/admin/mapping/create`;
        
        const method = mappingData.id && document.getElementById('wizardMappingId').hasAttribute('data-edit-id')
            ? 'PUT'
            : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(mappingData)
        });
        
        const result = await response.json();
        
        if (result.success || response.ok) {
            showAlert('success', result.message || 'Mapping saved successfully');
            bootstrap.Modal.getInstance(document.getElementById('mappingWizardModal')).hide();
            
            // Refresh mappings list
            if (typeof loadMappings === 'function') {
                loadMappings();
            }
        } else {
            showAlert('danger', result.message || 'Failed to save mapping');
        }
    } catch (error) {
        showAlert('danger', `Error saving mapping: ${error.message}`);
    }
}

// Load column mappings for wizard (TABLE type)
function loadColumnMappingsForWizard() {
    // This would integrate with existing column mapping UI
    // For now, we'll use the existing column mapping functions
    if (typeof loadColumnMappings === 'function') {
        // Use existing column mapping functionality
    }
}

// Load worksets for assignment
async function loadWorksetsForWizard() {
    const container = document.getElementById('wizardWorksets');
    
    if (!container) return;
    
    // Show loading state
    container.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div> Loading worksets...';
    
    try {
        const response = await fetch(`${API_BASE}/admin/workset/list`);
        
        if (!response.ok) {
            container.innerHTML = '<div class="alert alert-warning">Could not load worksets. You can still create the mapping and assign it to worksets later.</div>';
            return;
        }
        
        const worksets = await response.json();
        
        if (!worksets || worksets.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> No working sets available yet.
                    <br><small>You can create working sets in the "Working Sets" tab and assign this mapping later.</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        worksets.forEach(workset => {
            const isChecked = mappingData.assigned_worksets && mappingData.assigned_worksets.includes(workset.id);
            const div = document.createElement('div');
            div.className = 'form-check mb-2';
            div.innerHTML = `
                <input class="form-check-input wizard-workset-checkbox" type="checkbox" value="${workset.id}" id="ws_${workset.id}" ${isChecked ? 'checked' : ''}>
                <label class="form-check-label" for="ws_${workset.id}">
                    <strong>${workset.name}</strong>
                    ${workset.is_active ? '<span class="badge bg-success ms-1">Active</span>' : '<span class="badge bg-secondary ms-1">Inactive</span>'}
                    <br><small class="text-muted">ID: ${workset.id}</small>
                </label>
            `;
            container.appendChild(div);
        });
        
        // Add help text
        const helpText = document.createElement('div');
        helpText.className = 'mt-3 text-muted small';
        helpText.innerHTML = '<i class="bi bi-info-circle"></i> Select working sets to include this mapping in their synchronization runs.';
        container.appendChild(helpText);
        
    } catch (error) {
        console.error('Error loading worksets:', error);
        container.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i> Could not load worksets: ${error.message}
                <br><small>You can still create the mapping and assign it to worksets later.</small>
            </div>
        `;
    }
}

// Populate review content for step 5
function populateReviewContent() {
    // First, collect all data from previous steps
    collectStepData();
    
    const container = document.getElementById('wizardReviewContent');
    if (!container) return;
    
    // Collect selected worksets
    const selectedWorksets = [];
    document.querySelectorAll('.wizard-workset-checkbox:checked').forEach(cb => {
        selectedWorksets.push(cb.value);
    });
    mappingData.assigned_worksets = selectedWorksets;
    
    const typeBadge = mappingData.mapping_type === 'table' 
        ? '<span class="badge bg-primary">Table-based</span>' 
        : '<span class="badge bg-info">SQL-based</span>';
    
    let html = `
        <div class="card mb-3">
            <div class="card-header">
                <h6 class="mb-0"><i class="bi bi-info-circle"></i> Basic Information</h6>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <strong>Mapping ID:</strong> ${mappingData.id || '<em class="text-danger">Not set</em>'}<br>
                        <strong>Name:</strong> ${mappingData.name || '<em class="text-muted">Not set</em>'}<br>
                        <strong>Type:</strong> ${typeBadge}
                    </div>
                    <div class="col-md-6">
                        <strong>Destination:</strong> ${mappingData.destination_schema}.${mappingData.destination_table}<br>
                        <strong>Status:</strong> ${mappingData.enabled ? '<span class="badge bg-success">Enabled</span>' : '<span class="badge bg-secondary">Disabled</span>'}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Type-specific details
    if (mappingData.mapping_type === 'table') {
        html += `
            <div class="card mb-3">
                <div class="card-header">
                    <h6 class="mb-0"><i class="bi bi-table"></i> Table Configuration</h6>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <strong>Source:</strong> ${mappingData.source_schema}.${mappingData.source_table}<br>
                            <strong>Column Mappings:</strong> ${mappingData.column_mappings ? mappingData.column_mappings.length : 0} configured
                        </div>
                        <div class="col-md-6">
                            <strong>Sync Operations:</strong><br>
                            ${mappingData.sync_inserts ? '<span class="badge bg-success me-1"><i class="bi bi-plus"></i> Inserts</span>' : ''}
                            ${mappingData.sync_updates ? '<span class="badge bg-warning me-1"><i class="bi bi-pencil"></i> Updates</span>' : ''}
                            ${mappingData.sync_deletes ? '<span class="badge bg-danger me-1"><i class="bi bi-trash"></i> Deletes</span>' : ''}
                        </div>
                    </div>
                    <hr>
                    <div class="row">
                        <div class="col-md-6">
                            <strong>Initial Snapshot:</strong> ${mappingData.perform_initial_snapshot ? '<span class="badge bg-info">Yes</span>' : '<span class="badge bg-secondary">No</span>'}
                        </div>
                        <div class="col-md-6">
                            <strong>DuckDB Transformation:</strong> ${mappingData.use_duckdb_transformation ? '<span class="badge bg-info">Yes</span>' : '<span class="badge bg-secondary">No</span>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (mappingData.mapping_type === 'sql') {
        html += `
            <div class="card mb-3">
                <div class="card-header">
                    <h6 class="mb-0"><i class="bi bi-code-square"></i> SQL Configuration</h6>
                </div>
                <div class="card-body">
                    <div class="mb-2">
                        <strong>Source Query:</strong>
                        <pre class="bg-light p-2 mt-1 small" style="max-height: 150px; overflow-y: auto;">${mappingData.source_query || '<em class="text-danger">Not set</em>'}</pre>
                    </div>
                    ${mappingData.key_columns && mappingData.key_columns.length > 0 ? `
                        <div class="mb-2">
                            <strong>Key Columns:</strong> ${mappingData.key_columns.join(', ')}
                        </div>
                    ` : ''}
                    ${mappingData.insert_query ? `
                        <div class="mb-2">
                            <strong>Custom INSERT:</strong> <span class="badge bg-info">Configured</span>
                        </div>
                    ` : ''}
                    ${mappingData.update_query ? `
                        <div class="mb-2">
                            <strong>Custom UPDATE:</strong> <span class="badge bg-info">Configured</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    // Sync options
    html += `
        <div class="card mb-3">
            <div class="card-header">
                <h6 class="mb-0"><i class="bi bi-gear"></i> Sync Options</h6>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4">
                        <strong>Sync Mode:</strong> <span class="badge bg-secondary">${mappingData.sync_mode || 'full'}</span>
                    </div>
                    <div class="col-md-4">
                        <strong>Batch Size:</strong> ${mappingData.batch_size || 1000}
                    </div>
                    <div class="col-md-4">
                        <strong>Timeout:</strong> ${mappingData.timeout_seconds || 300}s
                    </div>
                </div>
                <div class="mt-2">
                    <strong>Schedule:</strong> ${mappingData.sync_schedule ? `<code>${mappingData.sync_schedule}</code>` : '<span class="text-muted">Manual only</span>'}
                </div>
            </div>
        </div>
    `;
    
    // Working sets
    html += `
        <div class="card mb-3">
            <div class="card-header">
                <h6 class="mb-0"><i class="bi bi-collection"></i> Working Sets</h6>
            </div>
            <div class="card-body">
                ${selectedWorksets.length > 0 
                    ? `<strong>Assigned to ${selectedWorksets.length} working set(s):</strong><br>${selectedWorksets.map(id => `<span class="badge bg-primary me-1">${id}</span>`).join('')}`
                    : '<span class="text-muted">Not assigned to any working sets</span>'
                }
            </div>
        </div>
    `;
    
    // Warning for missing required fields
    let warnings = [];
    if (!mappingData.id) warnings.push('Mapping ID is required');
    if (!mappingData.name) warnings.push('Mapping Name is required');
    if (mappingData.mapping_type === 'table' && (!mappingData.column_mappings || mappingData.column_mappings.length === 0)) {
        warnings.push('At least one column mapping is required for table-based mappings');
    }
    if (mappingData.mapping_type === 'sql' && !mappingData.source_query) {
        warnings.push('Source query is required for SQL-based mappings');
    }
    
    if (warnings.length > 0) {
        html += `
            <div class="alert alert-warning">
                <strong><i class="bi bi-exclamation-triangle"></i> Please address the following before saving:</strong>
                <ul class="mb-0 mt-2">
                    ${warnings.map(w => `<li>${w}</li>`).join('')}
                </ul>
            </div>
        `;
    } else {
        html += `
            <div class="alert alert-success">
                <i class="bi bi-check-circle"></i> Configuration looks good! Click "Save Mapping" to create the mapping.
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// Show cron helper
function showCronHelper() {
    alert(`Cron Expression Examples:
    
Every minute: * * * * *
Every hour: 0 * * * *
Every day at midnight: 0 0 * * *
Every Monday at 9 AM: 0 9 * * 1
Every 15 minutes: */15 * * * *
Every day at 2:30 PM: 30 14 * * *

Format: minute hour day month weekday`);
}

// Test SQL query
async function testSQLQuery() {
    const query = document.getElementById('wizardSourceQuery').value;
    if (!query) {
        showAlert('warning', 'Please enter a SQL query first');
        return;
    }
    
    try {
        // Create a temporary mapping to test
        const testMapping = {
            ...mappingData,
            source_query: query,
            id: 'test_' + Date.now(),
            name: 'Test Query'
        };
        
        const response = await fetch(`${API_BASE}/admin/mapping/test`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(testMapping)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', `Query executed successfully. Returned ${result.row_count || 0} rows.`);
        } else {
            showAlert('danger', `Query failed: ${result.error || result.message}`);
        }
    } catch (error) {
        showAlert('danger', `Error testing query: ${error.message}`);
    }
}

// Helper function to show alerts
function showAlert(type, message) {
    // Use existing alert system or create a simple one
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container-fluid');
    if (container) {
        container.insertBefore(alertDiv, container.firstChild);
        setTimeout(() => alertDiv.remove(), 5000);
    }
}



