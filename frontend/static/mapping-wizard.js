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
    
    // Step 4: Worksets
    if (mappingData.assigned_worksets && mappingData.assigned_worksets.length > 0) {
        mappingData.assigned_worksets.forEach(wsId => {
            const checkbox = document.querySelector(`#wizardWorksets input[value="${wsId}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }
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
            const checkedWorksets = Array.from(document.querySelectorAll('#wizardWorksets input:checked'))
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
    try {
        const response = await fetch(`${API_BASE}/admin/workset/list`);
        if (!response.ok) return;
        
        const worksets = await response.json();
        const container = document.getElementById('wizardWorksets');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        worksets.forEach(workset => {
            const div = document.createElement('div');
            div.className = 'form-check';
            div.innerHTML = `
                <input class="form-check-input" type="checkbox" value="${workset.id}" id="ws_${workset.id}">
                <label class="form-check-label" for="ws_${workset.id}">
                    ${workset.name} ${workset.is_active ? '<span class="badge bg-success">Active</span>' : ''}
                </label>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading worksets:', error);
    }
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

