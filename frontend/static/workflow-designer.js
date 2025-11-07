// Visual Workflow Designer
// Node-based graph editor for building data synchronization pipelines

const WorkflowDesigner = (function() {
    'use strict';
    
    // State
    let jsPlumbInstance = null;
    let currentWorkflow = null;
    let nodes = {};
    let edges = [];
    let nodeCounter = 0;
    let selectedNode = null;
    let zoomLevel = 1.0;
    let isDragging = false;
    let draggedNodeType = null;
    
    // Node type definitions
    const NODE_TYPES = {
        // Control Flow
        start: {
            label: 'Start',
            icon: 'bi-play-circle',
            color: 'success',
            category: 'control',
            inputs: 0,
            outputs: 1,
            config: {}
        },
        stop: {
            label: 'Stop',
            icon: 'bi-stop-circle',
            color: 'danger',
            category: 'control',
            inputs: 1,
            outputs: 0,
            config: {}
        },
        
        // Sources
        source_database: {
            label: 'Source Database',
            icon: 'bi-server',
            color: 'primary',
            category: 'source',
            inputs: 0,
            outputs: 1,
            config: {
                server: '',
                database: '',
                port: 1433,
                use_windows_auth: true,
                username: '',
                password: ''
            }
        },
        source_table: {
            label: 'Source Table',
            icon: 'bi-table',
            color: 'primary',
            category: 'source',
            inputs: 1,
            outputs: 1,
            config: {
                schema: '',
                table: '',
                columns: []
            }
        },
        source_columns: {
            label: 'Column Selector',
            icon: 'bi-list-columns',
            color: 'primary',
            category: 'source',
            inputs: 1,
            outputs: 1,
            config: {
                selected_columns: [],
                exclude_columns: []
            }
        },
        
        // Transformations
        transform_json: {
            label: 'JSON Aggregation',
            icon: 'bi-braces',
            color: 'warning',
            category: 'transform',
            inputs: 1,
            outputs: 1,
            config: {
                source_columns: [],
                destination_column: '',
                json_structure: 'object'
            }
        },
        transform_concat: {
            label: 'Concatenation',
            icon: 'bi-link-45deg',
            color: 'warning',
            category: 'transform',
            inputs: 1,
            outputs: 1,
            config: {
                source_columns: [],
                destination_column: '',
                separator: ', '
            }
        },
        transform_sql: {
            label: 'Custom SQL',
            icon: 'bi-code-square',
            color: 'warning',
            category: 'transform',
            inputs: 1,
            outputs: 1,
            config: {
                expression: '',
                source_columns: [],
                destination_column: ''
            }
        },
        transform_duckdb: {
            label: 'DuckDB Transform',
            icon: 'bi-database-gear',
            color: 'warning',
            category: 'transform',
            inputs: 1,
            outputs: 1,
            config: {
                script_name: '',
                script_content: ''
            }
        },
        transform_filter: {
            label: 'Filter',
            icon: 'bi-funnel',
            color: 'warning',
            category: 'transform',
            inputs: 1,
            outputs: 1,
            config: {
                condition: '',
                filter_type: 'where'
            }
        },
        transform_dedupe: {
            label: 'Deduplicate',
            icon: 'bi-card-list',
            color: 'warning',
            category: 'transform',
            inputs: 1,
            outputs: 1,
            config: {
                unique_columns: [],
                keep_strategy: 'first'
            }
        },
        
        // Destinations
        dest_database: {
            label: 'Dest Database',
            icon: 'bi-server',
            color: 'info',
            category: 'destination',
            inputs: 1,
            outputs: 1,
            config: {
                server: '',
                database: '',
                port: 1433,
                use_windows_auth: true,
                username: '',
                password: ''
            }
        },
        dest_table: {
            label: 'Dest Table',
            icon: 'bi-table',
            color: 'info',
            category: 'destination',
            inputs: 1,
            outputs: 1,
            config: {
                schema: '',
                table: ''
            }
        },
        dest_mapper: {
            label: 'Column Mapper',
            icon: 'bi-arrow-left-right',
            color: 'info',
            category: 'destination',
            inputs: 1,
            outputs: 0,
            config: {
                mappings: []
            }
        },
        
        // Operators
        op_logger: {
            label: 'Logger',
            icon: 'bi-journal-text',
            color: 'secondary',
            category: 'operator',
            inputs: 1,
            outputs: 1,
            config: {
                log_level: 'info',
                message: '',
                log_data: true
            }
        },
        op_notifier: {
            label: 'Notifier',
            icon: 'bi-bell',
            color: 'secondary',
            category: 'operator',
            inputs: 1,
            outputs: 1,
            config: {
                notification_type: 'email',
                recipients: '',
                message_template: ''
            }
        },
        op_condition: {
            label: 'Condition',
            icon: 'bi-question-circle',
            color: 'secondary',
            category: 'operator',
            inputs: 1,
            outputs: 2,  // True and False branches
            config: {
                condition: '',
                condition_type: 'sql'
            }
        },
        op_fork: {
            label: 'Fork',
            icon: 'bi-diagram-3',
            color: 'secondary',
            category: 'operator',
            inputs: 1,
            outputs: 3,
            config: {
                fork_type: 'duplicate'
            }
        },
        op_join: {
            label: 'Join',
            icon: 'bi-diagram-2',
            color: 'secondary',
            category: 'operator',
            inputs: 2,
            outputs: 1,
            config: {
                join_type: 'merge',
                join_key: ''
            }
        },
        
        // Events
        event_error: {
            label: 'On Error',
            icon: 'bi-exclamation-triangle',
            color: 'danger',
            category: 'event',
            inputs: 1,
            outputs: 1,
            config: {
                action: 'log',
                retry_count: 0
            }
        },
        event_success: {
            label: 'On Success',
            icon: 'bi-check-circle',
            color: 'success',
            category: 'event',
            inputs: 1,
            outputs: 1,
            config: {
                action: 'continue',
                notification: false
            }
        },
        event_change: {
            label: 'On Change',
            icon: 'bi-arrow-repeat',
            color: 'info',
            category: 'event',
            inputs: 1,
            outputs: 1,
            config: {
                detect_fields: [],
                action: 'sync'
            }
        }
    };
    
    // Initialize jsPlumb
    function initJsPlumb() {
        const { ready, newInstance } = jsPlumbBrowserUI;
        
        ready(() => {
            const container = document.getElementById('workflow-canvas');
            
            jsPlumbInstance = newInstance({
                container: container,
                connector: {
                    type: "Flowchart",
                    options: { gap: 5, cornerRadius: 5, stub: 20 }
                },
                endpoint: {
                    type: "Dot",
                    options: { radius: 6 }
                },
                anchor: ["Left", "Right"],
                connectionOverlays: [
                    {
                        type: "Arrow",
                        options: { location: 1, width: 10, length: 10 }
                    }
                ],
                paintStyle: { stroke: "#6c757d", strokeWidth: 2 },
                hoverPaintStyle: { stroke: "#0d6efd", strokeWidth: 3 },
                endpointStyle: { fill: "#6c757d" },
                endpointHoverStyle: { fill: "#0d6efd" }
            });
            
            // Bind connection events
            jsPlumbInstance.bind("connection", onConnection);
            jsPlumbInstance.bind("connectionDetached", onConnectionDetached);
            jsPlumbInstance.bind("click", onConnectionClick);
            
            console.log('jsPlumb initialized successfully');
        });
    }
    
    // Initialize designer when tab is shown
    function initDesigner() {
        if (!jsPlumbInstance) {
            initJsPlumb();
        }
        setupDragAndDrop();
        setupCanvasEvents();
    }
    
    // Setup drag and drop from palette
    function setupDragAndDrop() {
        const paletteItems = document.querySelectorAll('.node-palette-item');
        const canvas = document.getElementById('workflow-canvas');
        
        paletteItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedNodeType = e.target.getAttribute('data-node-type');
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/plain', draggedNodeType);
            });
            
            item.addEventListener('dragend', () => {
                draggedNodeType = null;
            });
        });
        
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedNodeType) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                addNode(draggedNodeType, x, y);
            }
        });
    }
    
    // Setup canvas events (click, pan, etc.)
    function setupCanvasEvents() {
        const canvas = document.getElementById('workflow-canvas');
        
        // Click on canvas (deselect nodes)
        canvas.addEventListener('click', (e) => {
            if (e.target === canvas) {
                deselectAllNodes();
            }
        });
        
        // Remove welcome message when first node is added
        canvas.addEventListener('DOMNodeInserted', () => {
            const infoDiv = document.getElementById('workflow-info');
            if (Object.keys(nodes).length > 0 && infoDiv) {
                infoDiv.style.display = 'none';
            }
        });
    }
    
    // Add node to canvas
    function addNode(type, x, y) {
        const nodeId = `node_${++nodeCounter}`;
        const nodeType = NODE_TYPES[type];
        
        if (!nodeType) {
            console.error('Unknown node type:', type);
            return;
        }
        
        // Create node element
        const nodeEl = document.createElement('div');
        nodeEl.id = nodeId;
        nodeEl.className = `workflow-node type-${type.replace(/_/g, '-')}`;
        nodeEl.style.left = `${x}px`;
        nodeEl.style.top = `${y}px`;
        
        nodeEl.innerHTML = `
            <div class="node-header">
                <span class="node-icon"><i class="bi ${nodeType.icon}"></i></span>
                <span class="node-title">${nodeType.label}</span>
                <button class="node-delete" onclick="WorkflowDesigner.deleteNode('${nodeId}')">
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>
            <div class="node-body">
                <small class="text-muted">Click to configure</small>
            </div>
        `;
        
        // Add to canvas
        const canvas = document.getElementById('workflow-canvas');
        canvas.appendChild(nodeEl);
        
        // Store node data
        nodes[nodeId] = {
            id: nodeId,
            type: type,
            position: { x, y },
            config: JSON.parse(JSON.stringify(nodeType.config)),  // Deep copy
            label: nodeType.label
        };
        
        // Make node draggable
        jsPlumbInstance.draggable(nodeEl, {
            containment: true,
            grid: [10, 10],
            stop: (params) => {
                nodes[nodeId].position = {
                    x: params.pos[0],
                    y: params.pos[1]
                };
            }
        });
        
        // Add click handler
        nodeEl.addEventListener('click', (e) => {
            e.stopPropagation();
            selectNode(nodeId);
        });
        
        // Add connection endpoints
        addNodeEndpoints(nodeEl, nodeId, nodeType);
        
        console.log('Added node:', nodeId, type);
        return nodeId;
    }
    
    // Add input/output endpoints to node
    function addNodeEndpoints(nodeEl, nodeId, nodeType) {
        // Add input ports
        for (let i = 0; i < nodeType.inputs; i++) {
            jsPlumbInstance.addEndpoint(nodeEl, {
                anchor: "Left",
                source: false,
                target: true,
                maxConnections: -1,
                cssClass: "node-port input"
            });
        }
        
        // Add output ports
        for (let i = 0; i < nodeType.outputs; i++) {
            jsPlumbInstance.addEndpoint(nodeEl, {
                anchor: "Right",
                source: true,
                target: false,
                maxConnections: -1,
                cssClass: "node-port output"
            });
        }
    }
    
    // Select node and show properties
    function selectNode(nodeId) {
        deselectAllNodes();
        
        const nodeEl = document.getElementById(nodeId);
        if (nodeEl) {
            nodeEl.classList.add('selected');
            selectedNode = nodeId;
            showNodeProperties(nodeId);
        }
    }
    
    // Deselect all nodes
    function deselectAllNodes() {
        document.querySelectorAll('.workflow-node').forEach(node => {
            node.classList.remove('selected');
        });
        selectedNode = null;
    }
    
    // Show node properties panel
    function showNodeProperties(nodeId) {
        const node = nodes[nodeId];
        if (!node) return;
        
        const nodeType = NODE_TYPES[node.type];
        const panel = document.getElementById('properties-content');
        
        let html = `
            <div class="node-config-form">
                <div class="property-group">
                    <div class="property-label">Node Type</div>
                    <div class="property-value">
                        <span class="badge bg-${nodeType.color}">${nodeType.label}</span>
                    </div>
                </div>
                
                <div class="property-group">
                    <label class="property-label">Label</label>
                    <input type="text" class="form-control form-control-sm" 
                           value="${node.label}" 
                           onchange="WorkflowDesigner.updateNodeLabel('${nodeId}', this.value)">
                </div>
        `;
        
        // Add type-specific configuration fields
        html += getNodeConfigForm(nodeId, node.type, node.config);
        
        html += '</div>';
        panel.innerHTML = html;
    }
    
    // Generate configuration form for node type
    function getNodeConfigForm(nodeId, nodeType, config) {
        let html = '';
        
        switch(nodeType) {
            case 'source_database':
            case 'dest_database':
                html += `
                    <div class="property-group">
                        <label class="property-label">Server</label>
                        <input type="text" class="form-control form-control-sm" 
                               value="${config.server || ''}" 
                               onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'server', this.value)">
                    </div>
                    <div class="property-group">
                        <label class="property-label">Database</label>
                        <input type="text" class="form-control form-control-sm" 
                               value="${config.database || ''}" 
                               onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'database', this.value)">
                    </div>
                    <div class="property-group">
                        <label class="property-label">Port</label>
                        <input type="number" class="form-control form-control-sm" 
                               value="${config.port || 1433}" 
                               onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'port', parseInt(this.value))">
                    </div>
                    <div class="property-group">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" 
                                   id="ws-auth-${nodeId}" 
                                   ${config.use_windows_auth ? 'checked' : ''}
                                   onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'use_windows_auth', this.checked)">
                            <label class="form-check-label small">Windows Auth</label>
                        </div>
                    </div>
                `;
                break;
                
            case 'source_table':
            case 'dest_table':
                html += `
                    <div class="property-group">
                        <label class="property-label">Schema</label>
                        <input type="text" class="form-control form-control-sm" 
                               value="${config.schema || ''}" 
                               onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'schema', this.value)">
                    </div>
                    <div class="property-group">
                        <label class="property-label">Table</label>
                        <input type="text" class="form-control form-control-sm" 
                               value="${config.table || ''}" 
                               onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'table', this.value)">
                    </div>
                `;
                break;
                
            case 'transform_json':
                html += `
                    <div class="property-group">
                        <label class="property-label">Source Columns</label>
                        <small class="text-muted d-block mb-1">Comma-separated</small>
                        <input type="text" class="form-control form-control-sm" 
                               value="${(config.source_columns || []).join(', ')}" 
                               onchange="WorkflowDesigner.updateNodeConfigArray('${nodeId}', 'source_columns', this.value)">
                    </div>
                    <div class="property-group">
                        <label class="property-label">Destination Column</label>
                        <input type="text" class="form-control form-control-sm" 
                               value="${config.destination_column || ''}" 
                               onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'destination_column', this.value)">
                    </div>
                `;
                break;
                
            case 'transform_concat':
                html += `
                    <div class="property-group">
                        <label class="property-label">Source Columns</label>
                        <small class="text-muted d-block mb-1">Comma-separated</small>
                        <input type="text" class="form-control form-control-sm" 
                               value="${(config.source_columns || []).join(', ')}" 
                               onchange="WorkflowDesigner.updateNodeConfigArray('${nodeId}', 'source_columns', this.value)">
                    </div>
                    <div class="property-group">
                        <label class="property-label">Separator</label>
                        <input type="text" class="form-control form-control-sm" 
                               value="${config.separator || ', '}" 
                               onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'separator', this.value)">
                    </div>
                    <div class="property-group">
                        <label class="property-label">Destination Column</label>
                        <input type="text" class="form-control form-control-sm" 
                               value="${config.destination_column || ''}" 
                               onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'destination_column', this.value)">
                    </div>
                `;
                break;
                
            case 'transform_sql':
                html += `
                    <div class="property-group">
                        <label class="property-label">SQL Expression</label>
                        <textarea class="form-control form-control-sm font-monospace" rows="3"
                                  onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'expression', this.value)">${config.expression || ''}</textarea>
                    </div>
                    <div class="property-group">
                        <label class="property-label">Source Columns</label>
                        <input type="text" class="form-control form-control-sm" 
                               value="${(config.source_columns || []).join(', ')}" 
                               onchange="WorkflowDesigner.updateNodeConfigArray('${nodeId}', 'source_columns', this.value)">
                    </div>
                    <div class="property-group">
                        <label class="property-label">Destination Column</label>
                        <input type="text" class="form-control form-control-sm" 
                               value="${config.destination_column || ''}" 
                               onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'destination_column', this.value)">
                    </div>
                `;
                break;
                
            case 'transform_duckdb':
                html += `
                    <div class="property-group">
                        <label class="property-label">Script</label>
                        <select class="form-select form-select-sm mb-2"
                                onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'script_name', this.value)">
                            <option value="">Select script...</option>
                            <option value="__inline__">Inline Script</option>
                        </select>
                        <textarea class="form-control form-control-sm font-monospace" rows="4"
                                  placeholder="Enter DuckDB SQL..."
                                  onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'script_content', this.value)">${config.script_content || ''}</textarea>
                    </div>
                `;
                break;
                
            case 'transform_filter':
                html += `
                    <div class="property-group">
                        <label class="property-label">Filter Condition</label>
                        <textarea class="form-control form-control-sm font-monospace" rows="2"
                                  placeholder="e.g., status = 'ACTIVE'"
                                  onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'condition', this.value)">${config.condition || ''}</textarea>
                    </div>
                `;
                break;
                
            case 'transform_dedupe':
                html += `
                    <div class="property-group">
                        <label class="property-label">Unique Columns</label>
                        <input type="text" class="form-control form-control-sm" 
                               value="${(config.unique_columns || []).join(', ')}" 
                               placeholder="id, customer_id"
                               onchange="WorkflowDesigner.updateNodeConfigArray('${nodeId}', 'unique_columns', this.value)">
                    </div>
                    <div class="property-group">
                        <label class="property-label">Keep Strategy</label>
                        <select class="form-select form-select-sm"
                                onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'keep_strategy', this.value)">
                            <option value="first" ${config.keep_strategy === 'first' ? 'selected' : ''}>First</option>
                            <option value="last" ${config.keep_strategy === 'last' ? 'selected' : ''}>Last</option>
                        </select>
                    </div>
                `;
                break;
                
            case 'op_logger':
                html += `
                    <div class="property-group">
                        <label class="property-label">Log Level</label>
                        <select class="form-select form-select-sm"
                                onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'log_level', this.value)">
                            <option value="debug" ${config.log_level === 'debug' ? 'selected' : ''}>Debug</option>
                            <option value="info" ${config.log_level === 'info' ? 'selected' : ''}>Info</option>
                            <option value="warning" ${config.log_level === 'warning' ? 'selected' : ''}>Warning</option>
                            <option value="error" ${config.log_level === 'error' ? 'selected' : ''}>Error</option>
                        </select>
                    </div>
                    <div class="property-group">
                        <label class="property-label">Message</label>
                        <input type="text" class="form-control form-control-sm" 
                               value="${config.message || ''}" 
                               placeholder="Log message"
                               onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'message', this.value)">
                    </div>
                `;
                break;
                
            case 'op_notifier':
                html += `
                    <div class="property-group">
                        <label class="property-label">Type</label>
                        <select class="form-select form-select-sm"
                                onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'notification_type', this.value)">
                            <option value="email" ${config.notification_type === 'email' ? 'selected' : ''}>Email</option>
                            <option value="webhook" ${config.notification_type === 'webhook' ? 'selected' : ''}>Webhook</option>
                            <option value="slack" ${config.notification_type === 'slack' ? 'selected' : ''}>Slack</option>
                        </select>
                    </div>
                    <div class="property-group">
                        <label class="property-label">Recipients</label>
                        <input type="text" class="form-control form-control-sm" 
                               value="${config.recipients || ''}" 
                               placeholder="email@example.com"
                               onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'recipients', this.value)">
                    </div>
                `;
                break;
                
            case 'op_condition':
                html += `
                    <div class="property-group">
                        <label class="property-label">Condition</label>
                        <textarea class="form-control form-control-sm font-monospace" rows="2"
                                  placeholder="e.g., amount > 1000"
                                  onchange="WorkflowDesigner.updateNodeConfig('${nodeId}', 'condition', this.value)">${config.condition || ''}</textarea>
                        <small class="text-muted">True path: top output, False path: bottom output</small>
                    </div>
                `;
                break;
        }
        
        return html;
    }
    
    // Connection event handlers
    function onConnection(info) {
        const edgeId = `edge_${edges.length + 1}`;
        edges.push({
            id: edgeId,
            source: info.sourceId,
            target: info.targetId
        });
        console.log('Connection created:', edgeId);
    }
    
    function onConnectionDetached(info) {
        edges = edges.filter(edge => 
            !(edge.source === info.sourceId && edge.target === info.targetId)
        );
        console.log('Connection removed');
    }
    
    function onConnectionClick(connection, e) {
        if (confirm('Delete this connection?')) {
            jsPlumbInstance.deleteConnection(connection);
        }
    }
    
    // Public API
    return {
        init: initDesigner,
        
        // Node operations
        addNode: addNode,
        deleteNode: function(nodeId) {
            if (confirm('Delete this node?')) {
                const nodeEl = document.getElementById(nodeId);
                if (nodeEl) {
                    jsPlumbInstance.remove(nodeEl);
                    delete nodes[nodeId];
                    edges = edges.filter(e => e.source !== nodeId && e.target !== nodeId);
                    deselectAllNodes();
                    document.getElementById('properties-content').innerHTML = `
                        <i class="bi bi-gear fs-3"></i>
                        <p class="small mt-3 text-muted">Select a node to edit its properties</p>
                    `;
                }
            }
        },
        
        selectNode: selectNode,
        
        updateNodeLabel: function(nodeId, label) {
            if (nodes[nodeId]) {
                nodes[nodeId].label = label;
                const nodeEl = document.getElementById(nodeId);
                if (nodeEl) {
                    nodeEl.querySelector('.node-title').textContent = label;
                }
            }
        },
        
        updateNodeConfig: function(nodeId, key, value) {
            if (nodes[nodeId]) {
                nodes[nodeId].config[key] = value;
                updateNodeDisplay(nodeId);
            }
        },
        
        updateNodeConfigArray: function(nodeId, key, value) {
            if (nodes[nodeId]) {
                const array = value.split(',').map(s => s.trim()).filter(s => s);
                nodes[nodeId].config[key] = array;
                updateNodeDisplay(nodeId);
            }
        },
        
        // Workflow operations
        getWorkflowData: function() {
            return {
                nodes: Object.values(nodes),
                edges: edges
            };
        },
        
        loadWorkflowData: function(data) {
            clearWorkflow();
            if (data.nodes) {
                data.nodes.forEach(node => {
                    addNode(node.type, node.position.x, node.position.y);
                    const nodeId = Object.keys(nodes)[Object.keys(nodes).length - 1];
                    nodes[nodeId] = node;
                });
            }
            if (data.edges) {
                data.edges.forEach(edge => {
                    connectNodes(edge.source, edge.target);
                });
            }
        },
        
        clearAll: function() {
            if (confirm('Clear entire workflow? This cannot be undone.')) {
                clearWorkflow();
            }
        }
    };
    
    // Helper: Update node display based on config
    function updateNodeDisplay(nodeId) {
        const node = nodes[nodeId];
        if (!node) return;
        
        const nodeEl = document.getElementById(nodeId);
        if (!nodeEl) return;
        
        const bodyEl = nodeEl.querySelector('.node-body');
        let summary = '';
        
        switch(node.type) {
            case 'source_database':
            case 'dest_database':
                summary = node.config.server ? 
                    `<small>${node.config.server}/${node.config.database || '?'}</small>` :
                    '<small class="text-muted">Not configured</small>';
                break;
                
            case 'source_table':
            case 'dest_table':
                summary = node.config.table ? 
                    `<small>${node.config.schema || 'dbo'}.${node.config.table}</small>` :
                    '<small class="text-muted">Not configured</small>';
                break;
                
            case 'transform_json':
            case 'transform_concat':
                const cols = node.config.source_columns || [];
                summary = cols.length > 0 ?
                    `<small>${cols.length} column(s) → ${node.config.destination_column || '?'}</small>` :
                    '<small class="text-muted">No columns selected</small>';
                break;
                
            case 'transform_filter':
                summary = node.config.condition ?
                    `<small class="text-truncate">WHERE ${node.config.condition}</small>` :
                    '<small class="text-muted">No condition</small>';
                break;
                
            default:
                summary = '<small class="text-muted">Configured</small>';
        }
        
        bodyEl.innerHTML = summary;
    }
    
    // Helper: Connect two nodes
    function connectNodes(sourceId, targetId) {
        const sourceEl = document.getElementById(sourceId);
        const targetEl = document.getElementById(targetId);
        
        if (sourceEl && targetEl && jsPlumbInstance) {
            jsPlumbInstance.connect({
                source: sourceEl,
                target: targetEl
            });
        }
    }
    
    // Helper: Clear workflow
    function clearWorkflow() {
        if (jsPlumbInstance) {
            jsPlumbInstance.deleteEveryConnection();
            jsPlumbInstance.deleteEveryEndpoint();
        }
        
        Object.keys(nodes).forEach(nodeId => {
            const nodeEl = document.getElementById(nodeId);
            if (nodeEl) {
                nodeEl.remove();
            }
        });
        
        nodes = {};
        edges = [];
        nodeCounter = 0;
        selectedNode = null;
        currentWorkflow = null;
        
        document.getElementById('properties-content').innerHTML = `
            <i class="bi bi-gear fs-3"></i>
            <p class="small mt-3 text-muted">Select a node to edit its properties</p>
        `;
        
        const infoDiv = document.getElementById('workflow-info');
        if (infoDiv) {
            infoDiv.style.display = 'block';
        }
    }
    
    return WorkflowDesigner;
})();

// Initialize when designer tab is shown
document.addEventListener('DOMContentLoaded', () => {
    const designerTab = document.getElementById('designer-tab');
    if (designerTab) {
        designerTab.addEventListener('shown.bs.tab', () => {
            WorkflowDesigner.init();
        });
    }
});

// Global functions for toolbar buttons
function createNewWorkflow() {
    if (Object.keys(WorkflowDesigner.getWorkflowData().nodes).length > 0) {
        if (!confirm('Create new workflow? Current workflow will be cleared.')) {
            return;
        }
    }
    WorkflowDesigner.clearAll();
    currentWorkflowId = null;
    currentWorkflowName = null;
    showAlert('success', 'New workflow created. Start by dragging nodes from the toolbox.');
}

async function saveWorkflow() {
    const workflowData = WorkflowDesigner.getWorkflowData();
    
    if (workflowData.nodes.length === 0) {
        showAlert('warning', 'Cannot save empty workflow');
        return;
    }
    
    // Prompt for name if new workflow
    let workflowId = currentWorkflowId;
    let workflowName = currentWorkflowName;
    
    if (!workflowId) {
        workflowName = prompt('Enter workflow name:');
        if (!workflowName) return;
        
        workflowId = 'workflow_' + workflowName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    }
    
    const workflow = {
        id: workflowId,
        name: workflowName || workflowId,
        description: '',
        nodes: workflowData.nodes,
        edges: workflowData.edges
    };
    
    try {
        const response = await fetch('/api/admin/workflow/visual/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(workflow)
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentWorkflowId = workflowId;
            currentWorkflowName = workflowName;
            showAlert('success', `Workflow '${workflowName}' saved successfully!`);
        } else {
            showAlert('danger', result.message || 'Failed to save workflow');
        }
    } catch (error) {
        showAlert('danger', `Error saving workflow: ${error.message}`);
    }
}

async function loadWorkflowList() {
    try {
        const response = await fetch('/api/admin/workflow/visual/list');
        const workflows = await response.json();
        
        if (workflows.length === 0) {
            showAlert('info', 'No saved workflows found');
            return;
        }
        
        // Show selection modal (simplified version)
        const selection = prompt('Available workflows:\n' + 
            workflows.map((w, i) => `${i+1}. ${w.name} (${w.nodes.length} nodes)`).join('\n') +
            '\n\nEnter number to load:');
        
        if (selection) {
            const index = parseInt(selection) - 1;
            if (index >= 0 && index < workflows.length) {
                await loadWorkflow(workflows[index].id);
            }
        }
    } catch (error) {
        showAlert('danger', `Error loading workflows: ${error.message}`);
    }
}

async function loadWorkflow(workflowId) {
    try {
        const response = await fetch(`/api/admin/workflow/visual/${workflowId}`);
        const workflow = await response.json();
        
        WorkflowDesigner.loadWorkflowData(workflow);
        currentWorkflowId = workflow.id;
        currentWorkflowName = workflow.name;
        
        showAlert('success', `Workflow '${workflow.name}' loaded successfully!`);
    } catch (error) {
        showAlert('danger', `Error loading workflow: ${error.message}`);
    }
}

async function validateWorkflow() {
    const workflowData = WorkflowDesigner.getWorkflowData();
    
    if (workflowData.nodes.length === 0) {
        showAlert('warning', 'Workflow is empty');
        return;
    }
    
    // Basic validation
    const hasStart = workflowData.nodes.some(n => n.type === 'start');
    const hasEnd = workflowData.nodes.some(n => n.type === 'stop' || n.type.startsWith('dest_'));
    
    if (!hasStart) {
        showAlert('warning', 'Workflow must have a Start node');
        return;
    }
    
    if (!hasEnd) {
        showAlert('warning', 'Workflow must have a Stop node or Destination');
        return;
    }
    
    // Check for disconnected nodes
    const connectedNodes = new Set();
    workflowData.edges.forEach(edge => {
        connectedNodes.add(edge.source);
        connectedNodes.add(edge.target);
    });
    
    const disconnectedNodes = workflowData.nodes.filter(n => 
        !connectedNodes.has(n.id) && n.type !== 'start'
    );
    
    if (disconnectedNodes.length > 0) {
        showAlert('warning', `Found ${disconnectedNodes.length} disconnected node(s)`);
        return;
    }
    
    showAlert('success', 'Workflow validation passed!');
}

async function compileWorkflow() {
    const workflowData = WorkflowDesigner.getWorkflowData();
    
    if (workflowData.nodes.length === 0) {
        showAlert('warning', 'Cannot compile empty workflow');
        return;
    }
    
    if (!currentWorkflowId) {
        showAlert('warning', 'Please save the workflow first');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/workflow/compile/${currentWorkflowId}`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('success', `Workflow compiled to mapping: ${result.mapping_id}`);
        } else {
            showAlert('danger', result.message || 'Failed to compile workflow');
        }
    } catch (error) {
        showAlert('danger', `Error compiling workflow: ${error.message}`);
    }
}

function zoomIn() {
    zoomLevel = Math.min(zoomLevel + 0.1, 2.0);
    applyZoom();
}

function zoomOut() {
    zoomLevel = Math.max(zoomLevel - 0.1, 0.5);
    applyZoom();
}

function fitToScreen() {
    zoomLevel = 1.0;
    applyZoom();
}

function applyZoom() {
    const canvas = document.getElementById('workflow-canvas');
    if (canvas) {
        canvas.style.transform = `scale(${zoomLevel})`;
        canvas.style.transformOrigin = '0 0';
    }
}

function clearWorkflow() {
    WorkflowDesigner.clearAll();
}

// Global state
let currentWorkflowId = null;
let currentWorkflowName = null;

