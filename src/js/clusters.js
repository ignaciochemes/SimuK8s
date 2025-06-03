if (typeof window.ClusterManager === 'undefined') {

    const ClusterManager = {
        // Crear nuevo cluster
        create() {
            const name = document.getElementById('clusterName').value.trim();
            const region = document.getElementById('clusterRegion').value;
            const version = document.getElementById('k8sVersion').value;
            const type = document.getElementById('clusterType').value;

            // Validaciones
            if (!name) {
                alert('Por favor ingresa un nombre para el cluster');
                return;
            }

            if (!Utils.validateResourceName(name.toLowerCase())) {
                alert('El nombre del cluster solo puede contener letras minúsculas, números y guiones');
                return;
            }

            // Verificar duplicados
            if (appState.clusters.some(c => c.name === name)) {
                alert('Ya existe un cluster con ese nombre');
                return;
            }

            const cluster = {
                name: name,
                region: region,
                version: version,
                type: type,
                status: 'running',
                nodes: 0,
                pods: 0
            };

            StateManager.addCluster(cluster);
            this.updateList();
            UI.updateSelectOptions();
            MonitoringManager.updateMetrics();
            Logger.log(`Cluster '${name}' creado exitosamente en ${region}`, 'SUCCESS');

            // Limpiar formulario
            this.clearForm();
        },

        // Eliminar cluster
        delete(clusterId) {
            const cluster = appState.clusters.find(c => c.id === clusterId);
            if (!cluster) return;

            const confirmMessage = `¿Estás seguro de eliminar el cluster '${cluster.name}'?\n\nEsto eliminará también:\n- Todos los nodos asociados\n- Todos los servicios desplegados\n\nEsta acción no se puede deshacer.`;

            if (confirm(confirmMessage)) {
                StateManager.removeCluster(clusterId);
                this.updateList();
                NodeManager.updateList();
                ServiceManager.updateList();
                UI.updateSelectOptions();
                MonitoringManager.updateMetrics();
                Logger.log(`Cluster '${cluster.name}' eliminado junto con sus recursos`, 'WARNING');
            }
        },

        // Actualizar lista de clusters
        updateList() {
            StateManager.calculateClusterMetrics();
            const container = document.getElementById('clustersList');

            if (appState.clusters.length === 0) {
                container.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;">🏗️</div>
                    <p>No hay clusters creados. ¡Crea tu primer cluster para comenzar!</p>
                </div>
            `;
                return;
            }

            container.innerHTML = appState.clusters.map(cluster => this.renderClusterItem(cluster)).join('');
        },

        // Renderizar elemento de cluster
        renderClusterItem(cluster) {
            const uptime = this.calculateUptime(cluster.created);
            const estimatedCost = this.calculateClusterCost(cluster);

            return `
            <div class="cluster-item">
                <div class="item-header">
                    <div class="item-title">🏗️ ${cluster.name}</div>
                    <span class="item-status status-${cluster.status}">${cluster.status.toUpperCase()}</span>
                </div>
                <p><strong>Región:</strong> ${cluster.region} | <strong>Versión K8s:</strong> ${cluster.version}</p>
                <p><strong>Tipo:</strong> ${cluster.type} | <strong>Tiempo activo:</strong> ${uptime}</p>
                <p><strong>Nodos:</strong> ${cluster.nodes || 0} | <strong>Pods:</strong> ${cluster.pods || 0}</p>
                <p><strong>Costo estimado:</strong> $${estimatedCost.toFixed(2)}/hora</p>
                <div class="load-test-controls">
                    <button class="btn btn-secondary" onclick="ClusterManager.showDetails(${cluster.id})">Detalles</button>
                    <button class="btn btn-secondary" onclick="ClusterManager.exportConfig(${cluster.id})">Exportar YAML</button>
                    <button class="btn btn-danger" onclick="ClusterManager.delete(${cluster.id})">Eliminar</button>
                </div>
            </div>
        `;
        },

        // Calcular tiempo de actividad
        calculateUptime(createdDate) {
            const now = new Date();
            const diffMs = now - new Date(createdDate);
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffDays > 0) {
                return `${diffDays}d ${diffHours % 24}h`;
            } else if (diffHours > 0) {
                return `${diffHours}h ${diffMins % 60}m`;
            } else {
                return `${diffMins}m`;
            }
        },

        // Calcular costo del cluster
        calculateClusterCost(cluster) {
            const clusterNodes = appState.nodes.filter(n => n.clusterId === cluster.id);
            return clusterNodes.reduce((total, node) => {
                return total + Utils.calculateEstimatedCost({ type: 'node', nodeType: node.type });
            }, 0);
        },

        // Mostrar detalles del cluster
        showDetails(clusterId) {
            const cluster = appState.clusters.find(c => c.id === clusterId);
            if (!cluster) return;

            const clusterNodes = appState.nodes.filter(n => n.clusterId === clusterId);
            const clusterServices = appState.services.filter(s => s.clusterId === clusterId);

            const details = `
Detalles del Cluster: ${cluster.name}
${'='.repeat(40)}

Configuración:
- Región: ${cluster.region}
- Versión K8s: ${cluster.version}
- Tipo: ${cluster.type}
- Estado: ${cluster.status}
- Creado: ${new Date(cluster.created).toLocaleString()}

Recursos:
- Nodos: ${clusterNodes.length}
- Servicios: ${clusterServices.length}
- Pods totales: ${cluster.pods}

Nodos:
${clusterNodes.map(node => `- ${node.name} (${node.type}) - CPU: ${node.cpuUsage.toFixed(1)}%, RAM: ${node.memoryUsage.toFixed(1)}%`).join('\n')}

Servicios:
${clusterServices.map(service => `- ${service.name} (${service.tech}) - ${service.currentReplicas} réplicas`).join('\n')}
        `;

            alert(details);
        },

        // Exportar configuración YAML
        exportConfig(clusterId) {
            const cluster = appState.clusters.find(c => c.id === clusterId);
            if (!cluster) return;

            const clusterServices = appState.services.filter(s => s.clusterId === clusterId);

            if (clusterServices.length === 0) {
                alert('No hay servicios en este cluster para exportar.');
                return;
            }

            const yamlConfigs = clusterServices.map(service => {
                return Utils.generateKubernetesYAML(service);
            }).join('\n\n---\n\n');

            const fullConfig = `# Configuración Kubernetes para Cluster: ${cluster.name}
# Generado el: ${new Date().toLocaleString()}
# Región: ${cluster.region}
# Versión K8s: ${cluster.version}

${yamlConfigs}`;

            // Crear y descargar archivo
            const blob = new Blob([fullConfig], { type: 'text/yaml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${cluster.name}-config.yaml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Logger.log(`Configuración YAML exportada para cluster '${cluster.name}'`, 'SUCCESS');
        },

        // Limpiar formulario
        clearForm() {
            document.getElementById('clusterName').value = '';
            document.getElementById('clusterRegion').selectedIndex = 0;
            document.getElementById('k8sVersion').selectedIndex = 0;
            document.getElementById('clusterType').selectedIndex = 0;
        },

        // Cambiar estado del cluster
        changeStatus(clusterId, newStatus) {
            const cluster = appState.clusters.find(c => c.id === clusterId);
            if (!cluster) return;

            cluster.status = newStatus;
            this.updateList();
            Logger.log(`Estado del cluster '${cluster.name}' cambiado a ${newStatus}`, 'INFO');
        },

        // Obtener estadísticas del cluster
        getStats(clusterId) {
            const cluster = appState.clusters.find(c => c.id === clusterId);
            if (!cluster) return null;

            const clusterNodes = appState.nodes.filter(n => n.clusterId === clusterId);
            const clusterServices = appState.services.filter(s => s.clusterId === clusterId);

            const totalCpu = clusterNodes.reduce((sum, node) => sum + node.cpuUsage, 0);
            const totalMemory = clusterNodes.reduce((sum, node) => sum + node.memoryUsage, 0);
            const totalRequests = clusterServices.reduce((sum, service) => sum + service.requests, 0);
            const totalErrors = clusterServices.reduce((sum, service) => sum + service.errors, 0);

            return {
                nodes: clusterNodes.length,
                services: clusterServices.length,
                pods: cluster.pods,
                avgCpuUsage: clusterNodes.length > 0 ? totalCpu / clusterNodes.length : 0,
                avgMemoryUsage: clusterNodes.length > 0 ? totalMemory / clusterNodes.length : 0,
                totalRequests,
                totalErrors,
                errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
                estimatedCost: this.calculateClusterCost(cluster)
            };
        }
    };

    // Exportar para uso global
    window.ClusterManager = ClusterManager;

} // Fin de protección contra múltiples cargas