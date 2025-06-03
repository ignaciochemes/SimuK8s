if (typeof window.ServiceManager === 'undefined') {

    const ServiceManager = {
        // Desplegar nuevo servicio
        deploy() {
            const clusterSelect = document.getElementById('serviceCluster');
            const clusterId = clusterSelect.value;
            const name = document.getElementById('serviceName').value.trim();
            const tech = document.getElementById('serviceTech').value;
            const type = document.getElementById('serviceType').value;
            const minReplicas = parseInt(document.getElementById('minReplicas').value);
            const maxReplicas = parseInt(document.getElementById('maxReplicas').value);
            const cpuLimit = parseInt(document.getElementById('cpuLimit').value);
            const ramLimit = parseInt(document.getElementById('ramLimit').value);
            const responseTime = parseInt(document.getElementById('responseTime').value);
            const throughput = parseInt(document.getElementById('throughput').value);
            const podStartupTime = parseInt(document.getElementById('podStartupTime').value); // 🆕 NUEVO

            // Validaciones
            if (!clusterId) {
                alert('Por favor selecciona un cluster de destino');
                return;
            }

            if (!name) {
                alert('Por favor ingresa un nombre para el servicio');
                return;
            }

            if (!Utils.validateResourceName(name.toLowerCase())) {
                alert('El nombre del servicio solo puede contener letras minúsculas, números y guiones');
                return;
            }

            if (minReplicas > maxReplicas) {
                alert('Las réplicas mínimas no pueden ser mayores que las máximas');
                return;
            }

            // Verificar duplicados en el cluster
            const existingService = appState.services.find(s =>
                s.clusterId === parseInt(clusterId) && s.name === name
            );

            if (existingService) {
                alert('Ya existe un servicio con ese nombre en el cluster seleccionado');
                return;
            }

            // Verificar capacidad del cluster
            const cluster = appState.clusters.find(c => c.id === parseInt(clusterId));
            const clusterNodes = appState.nodes.filter(n => n.clusterId === parseInt(clusterId));

            if (clusterNodes.length === 0) {
                alert('El cluster seleccionado no tiene nodos disponibles. Agrega nodos primero.');
                return;
            }

            const service = {
                name: name,
                clusterId: parseInt(clusterId),
                tech: tech,
                type: type,
                minReplicas: minReplicas,
                maxReplicas: maxReplicas,
                cpuLimit: cpuLimit,
                ramLimit: ramLimit,
                responseTime: responseTime,
                throughput: throughput,
                podStartupTime: podStartupTime, // 🆕 NUEVO: Tiempo de arranque
                status: 'running',
                pendingPods: 0, // 🆕 NUEVO: Pods pendientes de arranque
                startingPods: [] // 🆕 NUEVO: Array de pods iniciando
            };

            StateManager.addService(service);
            this.updateList();
            ClusterManager.updateList();
            NodeManager.updateList();
            UI.updateSelectOptions();
            MonitoringManager.updateMetrics();
            Logger.log(`Servicio '${name}' desplegado con ${minReplicas} réplicas (${tech})`, 'SUCCESS');

            // Limpiar formulario
            this.clearForm();
        },

        // Eliminar servicio
        delete(serviceId) {
            const service = appState.services.find(s => s.id === serviceId);
            if (!service) return;

            const cluster = appState.clusters.find(c => c.id === service.clusterId);
            const confirmMessage = `¿Estás seguro de eliminar el servicio '${service.name}'?\n\nEsto detendrá todas las réplicas del servicio.`;

            if (confirm(confirmMessage)) {
                StateManager.removeService(serviceId);
                this.updateList();
                ClusterManager.updateList();
                NodeManager.updateList();
                UI.updateSelectOptions();
                MonitoringManager.updateMetrics();
                Logger.log(`Servicio '${service.name}' eliminado del cluster '${cluster ? cluster.name : 'desconocido'}'`, 'WARNING');
            }
        },

        // Escalar servicio
        scale(serviceId, direction) {
            const service = appState.services.find(s => s.id === serviceId);
            if (!service) return;

            const success = StateManager.scaleService(serviceId, direction);

            if (success) {
                this.updateList();
                ClusterManager.updateList();
                NodeManager.updateList();
                MonitoringManager.updateMetrics();

                const action = direction > 0 ? 'escalado' : 'reducido';
                Logger.log(`Servicio '${service.name}' ${action} a ${service.currentReplicas} réplicas`, 'INFO');
            } else {
                const limit = direction > 0 ? 'máximo' : 'mínimo';
                alert(`No se puede escalar: se ha alcanzado el límite ${limit} de réplicas`);
            }
        },

        // Actualizar lista de servicios
        updateList() {
            const container = document.getElementById('servicesList');

            if (appState.services.length === 0) {
                container.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;">⚙️</div>
                    <p>No hay servicios desplegados. Despliega tu primera aplicación.</p>
                </div>
            `;
                return;
            }

            container.innerHTML = appState.services.map(service => this.renderServiceItem(service)).join('');
        },

        // Renderizar elemento de servicio
        renderServiceItem(service) {
            const cluster = appState.clusters.find(c => c.id === service.clusterId);
            const techIcon = config.technologies.find(t => t.value === service.tech)?.icon || '⚙️';
            const healthStatus = this.getServiceHealth(service);
            const uptime = this.calculateUptime(service);

            return `
            <div class="service-item">
                <div class="item-header">
                    <div class="item-title">${techIcon} ${service.name}</div>
                    <span class="item-status status-${service.status}">${service.status.toUpperCase()}</span>
                </div>
                <p><strong>Cluster:</strong> ${cluster ? cluster.name : 'N/A'} | <strong>Tecnología:</strong> ${service.tech}</p>
                <p><strong>Tipo:</strong> ${service.type} | <strong>Estado de salud:</strong> ${healthStatus}</p>
                <p><strong>Réplicas:</strong> ${this.getPodStatus(service)} | <strong>CPU Límite:</strong> ${service.cpuLimit}%</p>
                <p><strong>RAM Límite:</strong> ${service.ramLimit}MB | <strong>Throughput:</strong> ${service.throughput} req/s</p>
                <p><strong>Tiempo Respuesta:</strong> ${service.responseTime}ms | <strong>Uptime:</strong> ${uptime}</p>
                <p><strong>Requests:</strong> ${service.requests.toLocaleString()} | <strong>Errores:</strong> ${service.errors.toLocaleString()}</p>
                
                ${this.renderServiceMetrics(service)}
                
                <div class="load-test-controls">
                    <button class="btn" onclick="ServiceManager.scale(${service.id}, 1)" 
                            ${service.currentReplicas >= service.maxReplicas ? 'disabled' : ''}>
                        Escalar +
                    </button>
                    <button class="btn btn-secondary" onclick="ServiceManager.scale(${service.id}, -1)"
                            ${service.currentReplicas <= service.minReplicas ? 'disabled' : ''}>
                        Escalar -
                    </button>
                    <button class="btn btn-secondary" onclick="ServiceManager.showDetails(${service.id})">Detalles</button>
                    <button class="btn btn-secondary" onclick="ServiceManager.restart(${service.id})">Reiniciar</button>
                    <button class="btn btn-danger" onclick="ServiceManager.delete(${service.id})">Eliminar</button>
                </div>
            </div>
        `;
        },

        // Renderizar métricas del servicio
        renderServiceMetrics(service) {
            // 🆕 ARREGLO: Calcular tasa de error de forma más simple y efectiva
            let currentErrorRate = 0;
            if (appState.isTestRunning && service.requests > 0) {
                // Durante el test: errores por segundo vs requests por segundo
                currentErrorRate = Math.min(100, (service.errors / Math.max(service.requests * 60, 1)) * 100);
            } else if (!appState.isTestRunning && service.errors > 0) {
                // Después del test: rate based en requests acumulados
                const totalRequests = Math.max(service.requests * 1000, 1); // Estimación
                currentErrorRate = Math.min(100, (service.errors / totalRequests) * 100);
            }
            
            const currentLoad = service.requests > 0 ? Math.min(100, (service.requests / service.throughput) * 100) : 0;

            return `
            <div style="margin: 10px 0;">
                <label>Carga actual: ${Utils.formatPercentage(currentLoad)}</label>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${currentLoad}%; background: ${currentLoad > 80 ? '#dc3545' : '#667eea'}"></div>
                </div>
            </div>
            
            <div style="margin: 10px 0;">
                <label>Tasa de error: ${Utils.formatPercentage(currentErrorRate)}</label>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(currentErrorRate, 100)}%; background: ${currentErrorRate > 5 ? '#dc3545' : '#28a745'}"></div>
                </div>
            </div>
        `;
        },

        // Obtener estado de salud del servicio
        getServiceHealth(service) {
            const errorRate = service.requests > 0 ? ((service.errors / service.requests) * 100) : 0;
            const currentLoad = service.requests > 0 ? (service.requests / service.throughput) * 100 : 0;

            if (errorRate > 10 || currentLoad > 90) {
                return '🔴 Critical';
            } else if (errorRate > 5 || currentLoad > 70) {
                return '🟡 Warning';
            } else {
                return '🟢 Healthy';
            }
        },

        // Calcular uptime del servicio
        calculateUptime(service) {
            // Simular uptime basado en el tiempo transcurrido y estado del servicio
            const uptimeHours = Math.floor(Math.random() * 720); // Hasta 30 días
            const uptimeMinutes = Math.floor(Math.random() * 60);

            if (uptimeHours > 24) {
                return `${Math.floor(uptimeHours / 24)}d ${uptimeHours % 24}h`;
            } else if (uptimeHours > 0) {
                return `${uptimeHours}h ${uptimeMinutes}m`;
            } else {
                return `${uptimeMinutes}m`;
            }
        },

        // Mostrar detalles del servicio
        showDetails(serviceId) {
            const service = appState.services.find(s => s.id === serviceId);
            if (!service) return;

            const cluster = appState.clusters.find(c => c.id === service.clusterId);
            const errorRate = service.requests > 0 ? ((service.errors / service.requests) * 100) : 0;
            const avgResponseTime = service.responseTime + (Math.random() * 50 - 25); // Variación

            const details = `
Detalles del Servicio: ${service.name}
${'='.repeat(40)}

Configuración:
- Cluster: ${cluster ? cluster.name : 'N/A'}
- Tecnología: ${service.tech}
- Tipo: ${service.type}
- Estado: ${service.status}

Escalado:
- Réplicas actuales: ${service.currentReplicas}
- Réplicas mínimas: ${service.minReplicas}
- Réplicas máximas: ${service.maxReplicas}

Recursos:
- Límite CPU: ${service.cpuLimit}%
- Límite RAM: ${service.ramLimit}MB
- Throughput: ${service.throughput} req/s
- Tiempo de respuesta objetivo: ${service.responseTime}ms

Métricas de rendimiento:
- Total de requests: ${service.requests.toLocaleString()}
- Total de errores: ${service.errors.toLocaleString()}
- Tasa de error: ${Utils.formatPercentage(errorRate)}
- Tiempo de respuesta promedio: ${avgResponseTime.toFixed(0)}ms
- Estado de salud: ${this.getServiceHealth(service)}
- Uptime: ${this.calculateUptime(service)}

Auto-escalado:
- Escalado basado en CPU: ${service.cpuLimit}%
- Escalado basado en memoria: 70%
- Escalado basado en requests: ${service.throughput} req/s por réplica
        `;

            alert(details);
        },

        // Reiniciar servicio
        restart(serviceId) {
            const service = appState.services.find(s => s.id === serviceId);
            if (!service) return;

            if (confirm(`¿Reiniciar el servicio '${service.name}'?\n\nEsto causará una breve interrupción del servicio.`)) {
                Logger.log(`Reiniciando servicio '${service.name}'...`, 'INFO');

                service.status = 'restarting';
                this.updateList();

                setTimeout(() => {
                    service.status = 'running';
                    // Resetear algunas métricas
                    service.errors = Math.floor(service.errors * 0.1); // Reducir errores
                    this.updateList();
                    Logger.log(`Servicio '${service.name}' reiniciado exitosamente`, 'SUCCESS');
                }, 3000);
            }
        },

        // 🆕 NUEVO: Simular auto-escalado con tiempo de arranque realista
        simulateAutoScaling(service, requestsPerSecond) {
            const loadPerReplica = requestsPerSecond / (service.currentReplicas + service.pendingPods);
            const shouldScaleUp = loadPerReplica > service.throughput * 0.8;
            const shouldScaleDown = loadPerReplica < service.throughput * 0.3 && 
                                  (service.currentReplicas + service.pendingPods) > service.minReplicas;

            if (shouldScaleUp && (service.currentReplicas + service.pendingPods) < service.maxReplicas) {
                // Iniciar proceso de arranque de nuevo pod
                this.startNewPod(service);
                Logger.testLog(`[AUTO-SCALE] Iniciando nuevo pod para ${service.name} (startup: ${service.podStartupTime}s)`, 'INFO');
                return true;
            } else if (shouldScaleDown && service.currentReplicas > service.minReplicas) {
                // Solo reducir pods que ya están corriendo (no los que están iniciando)
                service.currentReplicas--;
                Logger.testLog(`[AUTO-SCALE] Reduciendo ${service.name} a ${service.currentReplicas} réplicas`, 'INFO');
                return true;
            }

            return false;
        },

        // 🆕 NUEVO: Iniciar proceso de arranque de un nuevo pod
        startNewPod(service) {
            const podId = `${service.name}-${Date.now()}`;
            const startTime = Date.now();
            
            // Agregar a pods pendientes
            service.pendingPods++;
            service.startingPods.push({
                id: podId,
                startTime: startTime,
                expectedReady: startTime + (service.podStartupTime * 1000)
            });

            Logger.testLog(`[POD-START] Pod ${podId} iniciando... (${service.podStartupTime}s para estar listo)`, 'INFO');

            // Programar finalización del arranque
            setTimeout(() => {
                this.completePodStartup(service, podId);
            }, service.podStartupTime * 1000);
        },

        // 🆕 NUEVO: Completar arranque de pod
        completePodStartup(service, podId) {
            // Encontrar y remover el pod de la lista de iniciando
            const podIndex = service.startingPods.findIndex(p => p.id === podId);
            if (podIndex !== -1) {
                service.startingPods.splice(podIndex, 1);
                service.pendingPods = Math.max(0, service.pendingPods - 1);
                service.currentReplicas++;
                
                Logger.testLog(`[POD-READY] Pod ${podId} listo y disponible para tráfico`, 'SUCCESS');
                
                // Actualizar visualizaciones
                this.updateList();
                ClusterManager.updateList();
                MonitoringManager.updateMetrics();
                
                // 🆕 NUEVO: Actualizar topología en tiempo real
                if (typeof TopologyManager !== 'undefined' && TopologyManager.updateTopologyRealTime) {
                    TopologyManager.updateTopologyRealTime();
                }
            }
        },

        // 🆕 NUEVO: Obtener estado detallado de pods
        getPodStatus(service) {
            const runningPods = service.currentReplicas;
            const pendingPods = service.pendingPods;
            const totalTargetPods = runningPods + pendingPods;
            
            if (pendingPods > 0) {
                const oldestStarting = service.startingPods.reduce((oldest, pod) => {
                    return pod.startTime < oldest.startTime ? pod : oldest;
                }, service.startingPods[0]);
                
                if (oldestStarting) {
                    const elapsed = Math.floor((Date.now() - oldestStarting.startTime) / 1000);
                    const remaining = Math.max(0, service.podStartupTime - elapsed);
                    return `${runningPods}/${totalTargetPods} (${pendingPods} iniciando, ~${remaining}s)`;
                }
            }
            
            return `${runningPods}/${service.maxReplicas}`;
        },

        // Simular errores bajo carga
        simulateErrors(service, requestsPerSecond) {
            const loadPerReplica = requestsPerSecond / service.currentReplicas;

            if (loadPerReplica > service.throughput) {
                const overloadFactor = loadPerReplica / service.throughput;
                const errorRate = Math.min((overloadFactor - 1) * 20, 50); // Hasta 50% de errores
                const errors = Math.floor(requestsPerSecond * errorRate / 100);

                service.errors += errors;

                if (errors > 0) {
                    Logger.testLog(`[WARNING] ${errors} errores en ${service.name} - Sobrecarga detectada`, 'WARNING');
                }

                return errors;
            }

            // Errores base aleatorios (muy pocos)
            const baseErrors = Math.random() < 0.01 ? 1 : 0;
            service.errors += baseErrors;
            return baseErrors;
        },

        // Limpiar formulario
        clearForm() {
            document.getElementById('serviceName').value = '';
            document.getElementById('serviceTech').selectedIndex = 0;
            document.getElementById('serviceType').selectedIndex = 0;
            document.getElementById('minReplicas').value = '1';
            document.getElementById('maxReplicas').value = '10';
            document.getElementById('cpuLimit').value = '80';
            document.getElementById('ramLimit').value = '512';
            document.getElementById('responseTime').value = '100';
            document.getElementById('throughput').value = '100';
            document.getElementById('podStartupTime').value = '30'; // 🆕 NUEVO
        }
    };

    // Exportar para uso global
    window.ServiceManager = ServiceManager;

} // Fin de protección contra múltiples cargas