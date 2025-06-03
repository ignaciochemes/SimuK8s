if (typeof window.NodeManager === 'undefined') {

    const NodeManager = {
        // Crear nuevo nodo
        create() {
            const clusterSelect = document.getElementById('nodeCluster');
            const clusterId = clusterSelect.value;
            const name = document.getElementById('nodeName').value.trim();
            const type = document.getElementById('nodeType').value;
            const az = document.getElementById('nodeAZ').value;

            // Validaciones
            if (!clusterId) {
                alert('Por favor selecciona un cluster de destino');
                return;
            }

            if (!name) {
                alert('Por favor ingresa un nombre para el nodo');
                return;
            }

            if (!Utils.validateResourceName(name.toLowerCase())) {
                alert('El nombre del nodo solo puede contener letras minúsculas, números y guiones');
                return;
            }

            // Verificar duplicados en el cluster
            const existingNode = appState.nodes.find(n =>
                n.clusterId === parseInt(clusterId) && n.name === name
            );

            if (existingNode) {
                alert('Ya existe un nodo con ese nombre en el cluster seleccionado');
                return;
            }

            const node = {
                name: name,
                clusterId: parseInt(clusterId),
                type: type,
                az: az,
                status: 'running'
            };

            StateManager.addNode(node);
            this.updateList();
            ClusterManager.updateList();
            MonitoringManager.updateMetrics();
            Logger.log(`Nodo '${name}' agregado al cluster (${type}, Zona ${az})`, 'SUCCESS');

            // Limpiar formulario
            this.clearForm();
        },

        // Eliminar nodo
        delete(nodeId) {
            const node = appState.nodes.find(n => n.id === nodeId);
            if (!node) return;

            const cluster = appState.clusters.find(c => c.id === node.clusterId);
            const confirmMessage = `¿Estás seguro de eliminar el nodo '${node.name}'?\n\nEsto puede afectar los servicios que se ejecutan en este nodo.`;

            if (confirm(confirmMessage)) {
                StateManager.removeNode(nodeId);
                this.updateList();
                ClusterManager.updateList();
                MonitoringManager.updateMetrics();
                Logger.log(`Nodo '${node.name}' eliminado del cluster '${cluster ? cluster.name : 'desconocido'}'`, 'WARNING');
            }
        },

        // Actualizar lista de nodos
        updateList() {
            const container = document.getElementById('nodesList');

            if (appState.nodes.length === 0) {
                container.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;">🖥️</div>
                    <p>No hay nodos creados. Primero crea un cluster y luego agrega nodos.</p>
                </div>
            `;
                return;
            }

            container.innerHTML = appState.nodes.map(node => this.renderNodeItem(node)).join('');
        },

        // Renderizar elemento de nodo
        renderNodeItem(node) {
            const cluster = appState.clusters.find(c => c.id === node.clusterId);
            const podDistribution = Utils.calculatePodDistribution(node.clusterId);
            const podsInNode = podDistribution[node.id] || 0;
            const healthStatus = this.getNodeHealth(node);
            const estimatedCost = Utils.calculateEstimatedCost({ type: 'node', nodeType: node.type });

            return `
            <div class="node-item">
                <div class="item-header">
                    <div class="item-title">🖥️ ${node.name}</div>
                    <span class="item-status status-${node.status}">${node.status.toUpperCase()}</span>
                </div>
                <p><strong>Cluster:</strong> ${cluster ? cluster.name : 'N/A'} | <strong>Tipo:</strong> ${node.type}</p>
                <p><strong>Zona:</strong> ${node.az} | <strong>Estado de salud:</strong> ${healthStatus}</p>
                <p><strong>Pods ejecutándose:</strong> ${podsInNode} | <strong>Costo:</strong> $${estimatedCost.toFixed(3)}/hora</p>
                
                <div style="margin: 10px 0;">
                    <label>CPU: ${Utils.formatPercentage(node.cpuUsage)}</label>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${node.cpuUsage}%"></div>
                    </div>
                </div>
                
                <div style="margin: 10px 0;">
                    <label>Memoria: ${Utils.formatPercentage(node.memoryUsage)}</label>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${node.memoryUsage}%"></div>
                    </div>
                </div>
                
                <div class="load-test-controls">
                    <button class="btn btn-secondary" onclick="NodeManager.showDetails(${node.id})">Detalles</button>
                    <button class="btn btn-secondary" onclick="NodeManager.drainNode(${node.id})">Drenar</button>
                    <button class="btn btn-danger" onclick="NodeManager.delete(${node.id})">Eliminar</button>
                </div>
            </div>
        `;
        },

        // Obtener estado de salud del nodo
        getNodeHealth(node) {
            if (node.cpuUsage > 90 || node.memoryUsage > 90) {
                return '🔴 Critical';
            } else if (node.cpuUsage > 70 || node.memoryUsage > 70) {
                return '🟡 Warning';
            } else {
                return '🟢 Healthy';
            }
        },

        // Mostrar detalles del nodo
        showDetails(nodeId) {
            const node = appState.nodes.find(n => n.id === nodeId);
            if (!node) return;

            const cluster = appState.clusters.find(c => c.id === node.clusterId);
            const podDistribution = Utils.calculatePodDistribution(node.clusterId);
            const podsInNode = podDistribution[node.id] || 0;
            const estimatedCost = Utils.calculateEstimatedCost({ type: 'node', nodeType: node.type });

            const specs = this.getNodeSpecs(node.type);

            const details = `
Detalles del Nodo: ${node.name}
${'='.repeat(40)}

Configuración:
- Cluster: ${cluster ? cluster.name : 'N/A'}
- Tipo de instancia: ${node.type}
- Zona de disponibilidad: ${node.az}
- Estado: ${node.status}

Especificaciones:
- CPU: ${specs.cpu}
- Memoria: ${specs.memory}
- Almacenamiento: ${specs.storage}
- Red: ${specs.network}

Métricas actuales:
- Uso de CPU: ${Utils.formatPercentage(node.cpuUsage)}
- Uso de Memoria: ${Utils.formatPercentage(node.memoryUsage)}
- Pods ejecutándose: ${podsInNode}
- Estado de salud: ${this.getNodeHealth(node)}

Costos:
- Costo por hora: $${estimatedCost.toFixed(3)}
- Costo estimado diario: $${(estimatedCost * 24).toFixed(2)}
- Costo estimado mensual: $${(estimatedCost * 24 * 30).toFixed(2)}
        `;

            alert(details);
        },

        // Obtener especificaciones del nodo
        getNodeSpecs(nodeType) {
            const specs = {
                't3.medium': { cpu: '2 vCPU', memory: '4 GB', storage: '20 GB EBS', network: 'Hasta 5 Gbps' },
                't3.large': { cpu: '2 vCPU', memory: '8 GB', storage: '20 GB EBS', network: 'Hasta 5 Gbps' },
                'c5.large': { cpu: '2 vCPU', memory: '4 GB', storage: '10 GB EBS', network: 'Hasta 10 Gbps' },
                'm5.large': { cpu: '2 vCPU', memory: '8 GB', storage: '10 GB EBS', network: 'Hasta 10 Gbps' },
                'm5.xlarge': { cpu: '4 vCPU', memory: '16 GB', storage: '20 GB EBS', network: 'Hasta 10 Gbps' }
            };

            return specs[nodeType] || { cpu: 'N/A', memory: 'N/A', storage: 'N/A', network: 'N/A' };
        },

        // Drenar nodo (mover pods a otros nodos)
        drainNode(nodeId) {
            const node = appState.nodes.find(n => n.id === nodeId);
            if (!node) return;

            const cluster = appState.clusters.find(c => c.id === node.clusterId);
            const clusterNodes = appState.nodes.filter(n => n.clusterId === node.clusterId && n.id !== nodeId);

            if (clusterNodes.length === 0) {
                alert('No hay otros nodos disponibles en el cluster para drenar este nodo.');
                return;
            }

            if (confirm(`¿Drenar el nodo '${node.name}'?\n\nEsto moverá todos los pods a otros nodos del cluster.`)) {
                // Simular proceso de drenado
                Logger.log(`Iniciando drenado del nodo '${node.name}'...`, 'INFO');

                setTimeout(() => {
                    node.status = 'draining';
                    this.updateList();
                    Logger.log(`Moviendo pods del nodo '${node.name}' a otros nodos...`, 'INFO');

                    setTimeout(() => {
                        node.status = 'drained';
                        // Simular redistribución de carga
                        clusterNodes.forEach(n => {
                            n.cpuUsage += Math.random() * 10;
                            n.memoryUsage += Math.random() * 10;
                            n.cpuUsage = Math.min(n.cpuUsage, 95);
                            n.memoryUsage = Math.min(n.memoryUsage, 95);
                        });

                        this.updateList();
                        Logger.log(`Nodo '${node.name}' drenado exitosamente`, 'SUCCESS');
                    }, 2000);
                }, 1000);
            }
        },

        // Simular falla en nodo
        simulateFailure(nodeId) {
            const node = appState.nodes.find(n => n.id === nodeId);
            if (!node) return;

            node.status = 'failed';
            node.cpuUsage = 0;
            node.memoryUsage = 0;

            this.updateList();
            Logger.log(`ALERT: Nodo '${node.name}' ha fallado`, 'ERROR');

            // Auto-recuperación después de 30 segundos
            setTimeout(() => {
                if (node.status === 'failed') {
                    node.status = 'running';
                    node.cpuUsage = Math.random() * 30 + 10;
                    node.memoryUsage = Math.random() * 40 + 15;
                    this.updateList();
                    Logger.log(`Nodo '${node.name}' se ha recuperado automáticamente`, 'SUCCESS');
                }
            }, 30000);
        },

        // Limpiar formulario
        clearForm() {
            document.getElementById('nodeName').value = '';
            document.getElementById('nodeType').selectedIndex = 0;
            document.getElementById('nodeAZ').selectedIndex = 0;
        },

        // Actualizar métricas de nodos en tiempo real
        updateMetrics() {
            appState.nodes.forEach(node => {
                if (node.status === 'running' && !appState.isTestRunning) {
                    // Variación natural de métricas
                    node.cpuUsage += (Math.random() - 0.5) * 5;
                    node.memoryUsage += (Math.random() - 0.5) * 3;

                    // Mantener dentro de límites realistas
                    node.cpuUsage = Math.max(5, Math.min(95, node.cpuUsage));
                    node.memoryUsage = Math.max(10, Math.min(90, node.memoryUsage));
                }
            });

            // Actualizar vista si hay cambios significativos
            if (Math.random() < 0.1) { // 10% de probabilidad de actualizar vista
                this.updateList();
            }
        },

        // Obtener nodos por cluster
        getNodesByCluster(clusterId) {
            return appState.nodes.filter(n => n.clusterId === clusterId);
        },

        // Obtener estadísticas agregadas de nodos
        getAggregatedStats() {
            if (appState.nodes.length === 0) {
                return { avgCpu: 0, avgMemory: 0, totalNodes: 0, healthyNodes: 0 };
            }

            const runningNodes = appState.nodes.filter(n => n.status === 'running');
            const totalCpu = runningNodes.reduce((sum, node) => sum + node.cpuUsage, 0);
            const totalMemory = runningNodes.reduce((sum, node) => sum + node.memoryUsage, 0);
            const healthyNodes = runningNodes.filter(n =>
                n.cpuUsage < 70 && n.memoryUsage < 70
            ).length;

            return {
                avgCpu: runningNodes.length > 0 ? totalCpu / runningNodes.length : 0,
                avgMemory: runningNodes.length > 0 ? totalMemory / runningNodes.length : 0,
                totalNodes: appState.nodes.length,
                healthyNodes: healthyNodes
            };
        }
    };

    // Exportar para uso global
    window.NodeManager = NodeManager;

} // Fin de protección contra múltiples cargas