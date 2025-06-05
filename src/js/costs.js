if (typeof window.CostManager === 'undefined') {

    const CostManager = {
        // Precios por hora de instancias (basados en AWS)
        instancePricing: {
            't3.medium': { hourly: 0.0416, vcpu: 2, memory: 4096 },
            't3.large': { hourly: 0.0832, vcpu: 2, memory: 8192 },
            'c5.large': { hourly: 0.085, vcpu: 2, memory: 4096 },
            'm5.large': { hourly: 0.096, vcpu: 2, memory: 8192 },
            'm5.xlarge': { hourly: 0.192, vcpu: 4, memory: 16384 }
        },

        // Costos adicionales por región
        regionMultiplier: {
            'us-east-1': 1.0,     // Norte de Virginia (baseline)
            'us-west-2': 1.05,    // Oregon
            'eu-west-1': 1.15,    // Irlanda
            'ap-southeast-1': 1.2  // Singapur
        },

        // Costos de servicios gestionados
        managedServicesCosts: {
            'managed': {
                clusterHourly: 0.10,  // EKS/GKE control plane
                loadBalancerHourly: 0.0225,
                networkServiceHourly: 0.005
            },
            'self-managed': {
                clusterHourly: 0.0,   // Sin costo adicional del control plane
                loadBalancerHourly: 0.0225,
                networkServiceHourly: 0.005
            }
        },

        // Inicializar el sistema de costos
        initialize() {
            this.createCostInterface();
            this.startRealTimeUpdates();
            Logger.log('Sistema de costos inicializado exitosamente 💰', 'SUCCESS');
        },

        // Crear interfaz de costos en el HTML
        createCostInterface() {
            // Agregar tab de costos si no existe
            const tabsContainer = document.querySelector('.tabs');
            if (tabsContainer && !document.querySelector('.tab[onclick*="costs"]')) {
                const costTab = document.createElement('button');
                costTab.className = 'tab';
                costTab.onclick = () => showTab('costs');
                costTab.innerHTML = '💰 Costos';
                tabsContainer.appendChild(costTab);
            }

            // Crear contenido de la tab de costos
            const tabContent = document.querySelector('.tab-content');
            if (tabContent && !document.getElementById('costs')) {
                const costPanel = document.createElement('div');
                costPanel.id = 'costs';
                costPanel.className = 'tab-panel';
                costPanel.innerHTML = this.getCostInterfaceHTML();
                tabContent.appendChild(costPanel);
            }
        },

        // HTML de la interfaz de costos
        getCostInterfaceHTML() {
            return `
                <div class="section">
                    <h3>💰 Sistema de Costos en Tiempo Real</h3>
                    <p>Monitoreo automático de costos de tu infraestructura Kubernetes. Los costos se actualizan automáticamente cuando crecen los nodos o clusters.</p>

                    <div class="metrics-grid">
                        <div class="metric-card">
                            <div class="metric-value" id="currentHourlyCost">$0.00</div>
                            <div class="metric-label">Costo por Hora</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value" id="currentDailyCost">$0.00</div>
                            <div class="metric-label">Costo Diario</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value" id="currentMonthlyCost">$0.00</div>
                            <div class="metric-label">Costo Mensual</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value" id="costTrend">+0%</div>
                            <div class="metric-label">Tendencia</div>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h3>📊 Proyecciones de Costos</h3>
                    <div class="load-test-controls">
                        <button class="btn" onclick="CostManager.showProjection('week')">1 Semana</button>
                        <button class="btn" onclick="CostManager.showProjection('month')">1 Mes</button>
                        <button class="btn" onclick="CostManager.showProjection('sixmonths')">6 Meses</button>
                        <button class="btn" onclick="CostManager.showProjection('year')">1 Año</button>
                    </div>

                    <div id="projectionContent">
                        <div class="metrics-grid">
                            <div class="metric-card">
                                <div class="metric-value" id="currentScenario">$0.00</div>
                                <div class="metric-label">Escenario Actual</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-value" id="conservativeScenario">$0.00</div>
                                <div class="metric-label">Conservador (+10%)</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-value" id="moderateScenario">$0.00</div>
                                <div class="metric-label">Moderado (+25%)</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-value" id="aggressiveScenario">$0.00</div>
                                <div class="metric-label">Agresivo (+50%)</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h3>🏗️ Desglose por Clusters</h3>
                    <div id="clusterCostBreakdown">
                        <div class="empty-state">
                            <div style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;">💰</div>
                            <p>No hay clusters para mostrar costos. Crea clusters para ver el desglose de costos.</p>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h3>📈 Optimizaciones Recomendadas</h3>
                    <div id="costOptimizations">
                        <div class="empty-state">
                            <p>Analizando optimizaciones...</p>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <h3>📋 Historial de Costos</h3>
                    <div class="load-test-controls">
                        <button class="btn btn-secondary" onclick="CostManager.exportCostReport()">📤 Exportar Reporte</button>
                        <button class="btn btn-secondary" onclick="CostManager.resetCostHistory()">🔄 Reiniciar Historial</button>
                    </div>
                    <div id="costHistory">
                        <div class="logs-container" id="costHistoryLog">
                            <div>Esperando datos de costos...</div>
                        </div>
                    </div>
                </div>
            `;
        },

        // Calcular costos en tiempo real
        calculateRealTimeCosts() {
            let totalHourlyCost = 0;
            const costBreakdown = {
                clusters: {},
                totalNodes: 0,
                totalClusters: appState.clusters.length,
                regions: {}
            };

            // Calcular costos por cluster
            appState.clusters.forEach(cluster => {
                const clusterCost = this.calculateClusterCost(cluster);
                costBreakdown.clusters[cluster.id] = clusterCost;
                totalHourlyCost += clusterCost.total;

                // Acumular por región
                if (!costBreakdown.regions[cluster.region]) {
                    costBreakdown.regions[cluster.region] = 0;
                }
                costBreakdown.regions[cluster.region] += clusterCost.total;
            });

            // Calcular costos de networking
            const networkingCosts = this.calculateNetworkingCosts();
            totalHourlyCost += networkingCosts.total;

            costBreakdown.totalNodes = appState.nodes.length;
            costBreakdown.networking = networkingCosts;
            costBreakdown.totalHourly = totalHourlyCost;
            costBreakdown.totalDaily = totalHourlyCost * 24;
            costBreakdown.totalMonthly = totalHourlyCost * 24 * 30;

            return costBreakdown;
        },

        // Calcular costo de un cluster específico
        calculateClusterCost(cluster) {
            const clusterNodes = appState.nodes.filter(n => n.clusterId === cluster.id);
            const clusterServices = appState.services.filter(s => s.clusterId === cluster.id);
            const regionMultiplier = this.regionMultiplier[cluster.region] || 1.0;
            const managedServices = this.managedServicesCosts[cluster.type] || this.managedServicesCosts['managed'];

            let nodesCost = 0;
            const nodeBreakdown = {};

            // Calcular costo de nodos
            clusterNodes.forEach(node => {
                const instancePrice = this.instancePricing[node.type];
                if (instancePrice) {
                    const nodeCost = instancePrice.hourly * regionMultiplier;
                    nodesCost += nodeCost;
                    
                    if (!nodeBreakdown[node.type]) {
                        nodeBreakdown[node.type] = { count: 0, cost: 0 };
                    }
                    nodeBreakdown[node.type].count++;
                    nodeBreakdown[node.type].cost += nodeCost;
                }
            });

            // Costo del control plane
            const controlPlaneCost = managedServices.clusterHourly * regionMultiplier;

            // Costo de almacenamiento estimado (por pods)
            const totalPods = clusterServices.reduce((sum, service) => sum + service.currentReplicas, 0);
            const storageCost = totalPods * 0.002; // ~$0.002/hora por pod

            return {
                cluster: cluster,
                nodes: nodesCost,
                controlPlane: controlPlaneCost,
                storage: storageCost,
                nodeBreakdown: nodeBreakdown,
                total: nodesCost + controlPlaneCost + storageCost,
                regionMultiplier: regionMultiplier
            };
        },

        // Calcular costos de networking
        calculateNetworkingCosts() {
            const managedServices = this.managedServicesCosts['managed'];
            let loadBalancerCost = 0;
            let networkServiceCost = 0;

            // Calcular costo de load balancers si está disponible NetworkingManager
            if (typeof NetworkingManager !== 'undefined') {
                loadBalancerCost = NetworkingManager.loadBalancers.length * managedServices.loadBalancerHourly;
                networkServiceCost = NetworkingManager.services.length * managedServices.networkServiceHourly;
            }

            return {
                loadBalancers: loadBalancerCost,
                services: networkServiceCost,
                total: loadBalancerCost + networkServiceCost
            };
        },

        // Actualizar interfaz con costos actuales
        updateCostInterface() {
            const costs = this.calculateRealTimeCosts();

            // Actualizar resumen principal
            if (document.getElementById('currentHourlyCost')) {
                document.getElementById('currentHourlyCost').textContent = `$${costs.totalHourly.toFixed(3)}`;
                document.getElementById('currentDailyCost').textContent = `$${costs.totalDaily.toFixed(2)}`;
                document.getElementById('currentMonthlyCost').textContent = `$${costs.totalMonthly.toFixed(2)}`;

                // Actualizar tendencia
                const trend = this.calculateCostTrend();
                document.getElementById('costTrend').textContent = trend.percentage;
            }

            // Actualizar desglose por clusters
            this.updateClusterBreakdown(costs);
            // Actualizar optimizaciones
            this.updateOptimizations(costs);
            // Guardar en historial
            this.saveToHistory(costs);
        },

        // Actualizar desglose por clusters
        updateClusterBreakdown(costs) {
            const container = document.getElementById('clusterCostBreakdown');
            if (!container) return;

            if (Object.keys(costs.clusters).length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;">💰</div>
                        <p>No hay clusters para mostrar costos. Crea clusters para ver el desglose de costos.</p>
                    </div>
                `;
                return;
            }

            const clustersHTML = Object.values(costs.clusters).map(clusterCost => {
                return `
                    <div class="cluster-item">
                        <div class="item-header">
                            <div class="item-title">🏗️ ${clusterCost.cluster.name}</div>
                            <span class="item-status">$${clusterCost.total.toFixed(3)}/hora</span>
                        </div>
                        <p><strong>Nodos:</strong> ${Object.values(clusterCost.nodeBreakdown).reduce((sum, nb) => sum + nb.count, 0)} | <strong>Control Plane:</strong> $${clusterCost.controlPlane.toFixed(3)}/h</p>
                        <p><strong>Almacenamiento:</strong> $${clusterCost.storage.toFixed(3)}/h | <strong>Región:</strong> ${clusterCost.cluster.region} (${(clusterCost.regionMultiplier * 100).toFixed(0)}%)</p>
                        <div style="margin: 10px 0;">
                            ${Object.entries(clusterCost.nodeBreakdown).map(([type, info]) => 
                                `<small>${info.count}x ${type}: $${info.cost.toFixed(3)}/h</small>`
                            ).join(' | ')}
                        </div>
                        <p><strong>Proyecciones:</strong> Diario: $${(clusterCost.total * 24).toFixed(2)} | Mensual: $${(clusterCost.total * 24 * 30).toFixed(2)}</p>
                    </div>
                `;
            }).join('');

            container.innerHTML = clustersHTML;
        },

        // Mostrar proyección específica
        showProjection(period) {
            const costs = this.calculateRealTimeCosts();
            const projections = this.calculateProjections(costs, period);

            // Actualizar valores de proyección
            document.getElementById('currentScenario').textContent = `$${projections.current.toFixed(2)}`;
            document.getElementById('conservativeScenario').textContent = `$${projections.conservative.toFixed(2)}`;
            document.getElementById('moderateScenario').textContent = `$${projections.moderate.toFixed(2)}`;
            document.getElementById('aggressiveScenario').textContent = `$${projections.aggressive.toFixed(2)}`;
            
            Logger.log(`Proyección para ${period} calculada: $${projections.current.toFixed(2)} - $${projections.aggressive.toFixed(2)}`, 'INFO');
        },

        // Calcular proyecciones para un período
        calculateProjections(costs, period) {
            const multipliers = {
                'week': 24 * 7,
                'month': 24 * 30,
                'sixmonths': 24 * 30 * 6,
                'year': 24 * 365
            };

            const baseCost = costs.totalHourly * multipliers[period];

            return {
                current: baseCost,
                conservative: baseCost * 1.1, // +10%
                moderate: baseCost * 1.25,    // +25%
                aggressive: baseCost * 1.5    // +50%
            };
        },

        // Calcular tendencia de costos
        calculateCostTrend() {
            const change = (Math.random() - 0.5) * 20; // ±10%
            return {
                value: change,
                percentage: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
            };
        },

        // Actualizar optimizaciones recomendadas
        updateOptimizations(costs) {
            const container = document.getElementById('costOptimizations');
            if (!container) return;

            const optimizations = this.generateOptimizations(costs);
            
            const optimizationsHTML = optimizations.map(opt => `
                <div class="cluster-item">
                    <div class="item-header">
                        <div class="item-title">${opt.icon} ${opt.title}</div>
                        <span class="item-status">${opt.priority}</span>
                    </div>
                    <p>${opt.description}</p>
                    <p><strong>Ahorro potencial:</strong> ${opt.savings}</p>
                </div>
            `).join('');

            container.innerHTML = optimizationsHTML || `
                <div class="empty-state">
                    <p>✅ Tu infraestructura está optimizada</p>
                </div>
            `;
        },

        // Generar recomendaciones de optimización
        generateOptimizations(costs) {
            const optimizations = [];

            // Verificar nodos subutilizados
            const underutilizedNodes = appState.nodes.filter(node => 
                node.cpuUsage < 20 && node.memoryUsage < 30
            );

            if (underutilizedNodes.length > 0) {
                const savings = underutilizedNodes.reduce((total, node) => {
                    const price = this.instancePricing[node.type];
                    return total + (price ? price.hourly * 24 * 30 : 0);
                }, 0);

                optimizations.push({
                    priority: 'high',
                    icon: '🔍',
                    title: 'Nodos Subutilizados',
                    description: `${underutilizedNodes.length} nodos con baja utilización. Considera consolidar o terminar.`,
                    savings: `$${savings.toFixed(2)}/mes`
                });
            }

            // Verificar instancias oversized
            const oversizedNodes = appState.nodes.filter(node => 
                node.type.includes('xlarge') && node.cpuUsage < 50
            );

            if (oversizedNodes.length > 0) {
                optimizations.push({
                    priority: 'medium',
                    icon: '📉',
                    title: 'Instancias Sobredimensionadas',
                    description: `${oversizedNodes.length} instancias grandes con baja utilización.`,
                    savings: '$200-500/mes'
                });
            }

            // Verificar clusters en regiones caras
            const expensiveRegions = appState.clusters.filter(cluster => 
                this.regionMultiplier[cluster.region] > 1.1
            );

            if (expensiveRegions.length > 0) {
                optimizations.push({
                    priority: 'low',
                    icon: '🌍',
                    title: 'Optimización de Regiones',
                    description: `${expensiveRegions.length} clusters en regiones con sobrecosto.`,
                    savings: '5-20% del costo total'
                });
            }

            return optimizations;
        },

        // Guardar datos en historial
        saveToHistory(costs) {
            if (!this.costHistory) {
                this.costHistory = [];
            }

            const historyEntry = {
                timestamp: new Date(),
                clusters: costs.totalClusters,
                nodes: costs.totalNodes,
                hourlyCost: costs.totalHourly,
                dailyCost: costs.totalDaily,
                monthlyCost: costs.totalMonthly
            };

            this.costHistory.push(historyEntry);

            // Mantener solo las últimas 50 entradas
            if (this.costHistory.length > 50) {
                this.costHistory.shift();
            }

            this.updateHistoryDisplay();
        },

        // Actualizar visualización del historial
        updateHistoryDisplay() {
            const container = document.getElementById('costHistoryLog');
            if (!container || !this.costHistory) return;

            const historyHTML = this.costHistory.slice(-5).reverse().map(entry => 
                `<div>[${entry.timestamp.toLocaleTimeString()}] Clusters: ${entry.clusters}, Nodos: ${entry.nodes}, Costo/hora: $${entry.hourlyCost.toFixed(3)}</div>`
            ).join('');

            container.innerHTML = historyHTML || '<div>No hay datos de historial</div>';
        },

        // Exportar reporte de costos
        exportCostReport() {
            const costs = this.calculateRealTimeCosts();
            const report = {
                timestamp: new Date().toISOString(),
                summary: {
                    hourlyCost: costs.totalHourly,
                    dailyCost: costs.totalDaily,
                    monthlyCost: costs.totalMonthly,
                    clusters: costs.totalClusters,
                    nodes: costs.totalNodes
                },
                clusterBreakdown: costs.clusters,
                networking: costs.networking,
                projections: {
                    week: this.calculateProjections(costs, 'week'),
                    month: this.calculateProjections(costs, 'month'),
                    sixMonths: this.calculateProjections(costs, 'sixmonths'),
                    year: this.calculateProjections(costs, 'year')
                },
                optimizations: this.generateOptimizations(costs),
                history: this.costHistory
            };

            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cost-report-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Logger.log('Reporte de costos exportado exitosamente', 'SUCCESS');
        },

        // Reiniciar historial de costos
        resetCostHistory() {
            if (confirm('¿Estás seguro de reiniciar el historial de costos?\n\nEsta acción no se puede deshacer.')) {
                this.costHistory = [];
                this.updateHistoryDisplay();
                Logger.log('Historial de costos reiniciado', 'WARNING');
            }
        },

        // Iniciar actualizaciones en tiempo real
        startRealTimeUpdates() {
            // Actualización inmediata
            this.updateCostInterface();

            // Actualizar cada 10 segundos
            this.costUpdateInterval = setInterval(() => {
                this.updateCostInterface();
            }, 10000);

            // Actualizar cuando cambien los recursos
            this.setupResourceWatchers();
        },

        // Configurar observadores de recursos
        setupResourceWatchers() {
            // Extender funciones existentes para actualizar costos
            if (typeof StateManager !== 'undefined') {
                const originalAddCluster = StateManager.addCluster;
                const originalRemoveCluster = StateManager.removeCluster;
                const originalAddNode = StateManager.addNode;
                const originalRemoveNode = StateManager.removeNode;
                const originalAddService = StateManager.addService;
                const originalRemoveService = StateManager.removeService;

                StateManager.addCluster = function(cluster) {
                    const result = originalAddCluster.call(this, cluster);
                    setTimeout(() => CostManager.updateCostInterface(), 500);
                    return result;
                };

                StateManager.removeCluster = function(clusterId) {
                    originalRemoveCluster.call(this, clusterId);
                    setTimeout(() => CostManager.updateCostInterface(), 500);
                };

                StateManager.addNode = function(node) {
                    const result = originalAddNode.call(this, node);
                    setTimeout(() => CostManager.updateCostInterface(), 500);
                    return result;
                };

                StateManager.removeNode = function(nodeId) {
                    originalRemoveNode.call(this, nodeId);
                    setTimeout(() => CostManager.updateCostInterface(), 500);
                };

                StateManager.addService = function(service) {
                    const result = originalAddService.call(this, service);
                    setTimeout(() => CostManager.updateCostInterface(), 500);
                    return result;
                };

                StateManager.removeService = function(serviceId) {
                    originalRemoveService.call(this, serviceId);
                    setTimeout(() => CostManager.updateCostInterface(), 500);
                };
            }
        },

        // Obtener resumen de costos para otros módulos
        getCostSummary() {
            const costs = this.calculateRealTimeCosts();
            return {
                hourly: costs.totalHourly,
                daily: costs.totalDaily,
                monthly: costs.totalMonthly,
                clusters: costs.totalClusters,
                nodes: costs.totalNodes,
                lastUpdated: new Date()
            };
        },

        // Simular escalado y calcular impacto en costos
        simulateScalingCost(clusterId, additionalNodes, nodeType = 't3.medium') {
            const cluster = appState.clusters.find(c => c.id === clusterId);
            if (!cluster) return null;

            const regionMultiplier = this.regionMultiplier[cluster.region] || 1.0;
            const instancePrice = this.instancePricing[nodeType];
            
            if (!instancePrice) return null;

            const additionalHourlyCost = instancePrice.hourly * regionMultiplier * additionalNodes;
            const currentCosts = this.calculateRealTimeCosts();

            return {
                current: {
                    hourly: currentCosts.totalHourly,
                    daily: currentCosts.totalDaily,
                    monthly: currentCosts.totalMonthly
                },
                withScaling: {
                    hourly: currentCosts.totalHourly + additionalHourlyCost,
                    daily: (currentCosts.totalHourly + additionalHourlyCost) * 24,
                    monthly: (currentCosts.totalHourly + additionalHourlyCost) * 24 * 30
                },
                increase: {
                    hourly: additionalHourlyCost,
                    daily: additionalHourlyCost * 24,
                    monthly: additionalHourlyCost * 24 * 30,
                    percentage: (additionalHourlyCost / currentCosts.totalHourly) * 100
                }
            };
        },

        // Calcular costo de un recurso específico
        calculateResourceCost(resourceType, resourceId) {
            switch (resourceType) {
                case 'cluster':
                    const cluster = appState.clusters.find(c => c.id === resourceId);
                    return cluster ? this.calculateClusterCost(cluster) : null;
                
                case 'node':
                    const node = appState.nodes.find(n => n.id === resourceId);
                    if (!node) return null;
                    
                    const cluster2 = appState.clusters.find(c => c.id === node.clusterId);
                    const regionMultiplier = this.regionMultiplier[cluster2?.region] || 1.0;
                    const instancePrice = this.instancePricing[node.type];
                    
                    return {
                        hourly: instancePrice ? instancePrice.hourly * regionMultiplier : 0,
                        daily: instancePrice ? instancePrice.hourly * regionMultiplier * 24 : 0,
                        monthly: instancePrice ? instancePrice.hourly * regionMultiplier * 24 * 30 : 0
                    };
                
                default:
                    return null;
            }
        }
    };

    // Inicializar automáticamente cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => CostManager.initialize(), 1000);
        });
    } else {
        setTimeout(() => CostManager.initialize(), 1000);
    }

    // Exportar para uso global
    window.CostManager = CostManager;

} // Fin de protección contra múltiples cargas