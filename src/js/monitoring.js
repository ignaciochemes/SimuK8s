if (typeof window.MonitoringManager === 'undefined') {

    const MonitoringManager = {
        // Actualizar todas las métricas
        updateMetrics() {
            this.updateBasicMetrics();
            this.updateResourceUsage();
        },

        // Actualizar métricas básicas
        updateBasicMetrics() {
            const totals = StateManager.getTotals();

            document.getElementById('totalClusters').textContent = totals.clusters;
            document.getElementById('totalNodes').textContent = totals.nodes;
            document.getElementById('totalPods').textContent = totals.pods;
            document.getElementById('totalRequests').textContent = totals.requests;
        },

        // Actualizar uso de recursos
        updateResourceUsage() {
            const usage = StateManager.getResourceUsage();

            document.getElementById('cpuUsage').style.width = usage.cpu + '%';
            document.getElementById('cpuText').textContent = Utils.formatPercentage(usage.cpu);

            document.getElementById('memoryUsage').style.width = usage.memory + '%';
            document.getElementById('memoryText').textContent = Utils.formatPercentage(usage.memory);
        },

        // Inicializar monitoreo en tiempo real
        startRealTimeMonitoring() {
            // Actualizar métricas cada 2 segundos
            setInterval(() => {
                if (!appState.isTestRunning) {
                    NodeManager.updateMetrics();
                    this.updateMetrics();
                }
            }, 2000);
        }
    };

    const TestingManager = {
        currentTest: null,
        testMetrics: {},

        // Iniciar prueba de carga
        start() {
            const serviceSelect = document.getElementById('testService');
            const serviceId = serviceSelect.value;
            const rps = parseInt(document.getElementById('requestsPerSecond').value);
            const duration = parseInt(document.getElementById('testDuration').value);
            const pattern = document.getElementById('loadPattern').value;

            // Validaciones
            if (!serviceId) {
                alert('Por favor selecciona un servicio para testear');
                return;
            }

            if (appState.isTestRunning) {
                alert('Ya hay una prueba en ejecución');
                return;
            }

            const service = appState.services.find(s => s.id === parseInt(serviceId));
            if (!service) {
                alert('Servicio no encontrado');
                return;
            }

            // 🆕 NUEVA: Detectar configuración de networking
            const networkingConfig = this.analyzeNetworkingConfiguration(service);

            // Configurar prueba
            this.currentTest = {
                service: service,
                targetRPS: rps,
                duration: duration,
                pattern: pattern,
                startTime: Date.now(),
                elapsed: 0,
                networkingConfig: networkingConfig  // 🆕 NUEVA: Añadir configuración de networking
            };

            this.testMetrics = {
                totalRequests: 0,
                totalErrors: 0,
                maxReplicas: service.currentReplicas,
                avgResponseTime: service.responseTime,
                loadBalancerRequests: 0,  // 🆕 NUEVA
                networkServiceRequests: 0,  // 🆕 NUEVA
                ingressRequests: 0,  // 🆕 NUEVA
                networkPolicyViolations: 0  // 🆕 NUEVA
            };

            appState.isTestRunning = true;
            appState.currentRequests = 0;

            Logger.testLog(`Iniciando prueba de carga: ${rps} RPS por ${duration} segundos`, 'INFO');
            Logger.testLog(`Servicio objetivo: ${service.name} (${service.tech})`, 'INFO');
            Logger.testLog(`Patrón de carga: ${pattern}`, 'INFO');

            // 🆕 NUEVA: Reportar configuración de networking
            this.logNetworkingConfiguration(networkingConfig);

            // Iniciar ciclo de testing
            this.runTestCycle();
        },

        // 🆕 NUEVA: Analizar configuración de networking para el servicio
        analyzeNetworkingConfiguration(service) {
            const config = {
                loadBalancers: NetworkingManager.loadBalancers.filter(lb => lb.serviceId === service.id),
                networkServices: NetworkingManager.services.filter(ns => ns.targetServiceId === service.id),
                networkPolicies: NetworkingManager.networkPolicies.filter(np => np.targetServiceId === service.id),
                ingresses: NetworkingManager.ingresses.filter(ing => ing.serviceId === service.id),
                hasLoadBalancer: false,
                hasNetworkService: false,
                hasNetworkPolicies: false,
                hasIngress: false,
                expectedLatencyIncrease: 0,
                trafficDistribution: 'direct'
            };

            config.hasLoadBalancer = config.loadBalancers.length > 0;
            config.hasNetworkService = config.networkServices.length > 0;
            config.hasNetworkPolicies = config.networkPolicies.length > 0;
            config.hasIngress = config.ingresses.length > 0;

            // Calcular latencia esperada por configuración de red
            if (config.hasLoadBalancer) {
                config.expectedLatencyIncrease += 5; // Load Balancer añade ~5ms
                config.trafficDistribution = 'load-balanced';
            }
            if (config.hasNetworkService) {
                config.expectedLatencyIncrease += 2; // Network Service añade ~2ms
            }
            if (config.hasIngress) {
                config.expectedLatencyIncrease += 8; // Ingress añade ~8ms (más procesamiento)
            }
            if (config.hasNetworkPolicies) {
                config.expectedLatencyIncrease += 3; // Network Policies añaden ~3ms
            }

            return config;
        },

        // 🆕 NUEVA: Reportar configuración de networking
        logNetworkingConfiguration(config) {
            Logger.testLog('=== CONFIGURACIÓN DE NETWORKING DETECTADA ===', 'INFO');

            if (config.hasLoadBalancer) {
                config.loadBalancers.forEach(lb => {
                    Logger.testLog(`⚖️ Load Balancer: ${lb.name} (${lb.type}) - Puerto ${lb.port}→${lb.targetPort}`, 'INFO');
                });
            }

            if (config.hasNetworkService) {
                config.networkServices.forEach(ns => {
                    Logger.testLog(`🌐 Network Service: ${ns.name} (${ns.type}) - IP ${ns.clusterIP}:${ns.port}`, 'INFO');
                });
            }

            if (config.hasIngress) {
                config.ingresses.forEach(ing => {
                    const protocol = ing.tlsEnabled ? 'https' : 'http';
                    Logger.testLog(`🌍 Ingress: ${ing.name} - ${protocol}://${ing.host}${ing.path}`, 'INFO');
                });
            }

            if (config.hasNetworkPolicies) {
                config.networkPolicies.forEach(np => {
                    Logger.testLog(`🔒 Network Policy: ${np.name} (${np.action}/${np.direction})`, 'INFO');
                });
            }

            Logger.testLog(`Latencia adicional esperada: +${config.expectedLatencyIncrease}ms`, 'INFO');
            Logger.testLog(`Modo de distribución: ${config.trafficDistribution}`, 'INFO');
        },

        // Ejecutar ciclo de testing
        runTestCycle() {
            if (!appState.isTestRunning || !this.currentTest) return;

            appState.testInterval = setInterval(() => {
                const test = this.currentTest;
                test.elapsed++;

                // Verificar si terminó la prueba
                if (test.elapsed >= test.duration) {
                    this.stop();
                    return;
                }

                // Calcular RPS actual según el patrón
                const currentRPS = this.calculateCurrentRPS(test);
                appState.currentRequests = currentRPS;

                // 🆕 NUEVA: Simular tráfico a través de networking
                this.simulateNetworkingTraffic(test, currentRPS);

                // Actualizar métricas del servicio
                test.service.requests = currentRPS; // 🆕 ARREGLO: Asignar directamente, no acumular
                this.testMetrics.totalRequests += currentRPS;

                // Simular auto-escalado
                const scaled = ServiceManager.simulateAutoScaling(test.service, currentRPS);
                if (scaled && test.service.currentReplicas > this.testMetrics.maxReplicas) {
                    this.testMetrics.maxReplicas = test.service.currentReplicas;
                }

                // 🆕 MEJORADA: Simular errores considerando networking
                const errors = this.simulateNetworkingAwareErrors(test.service, currentRPS, test.networkingConfig);
                this.testMetrics.totalErrors += errors;

                // Actualizar métricas de nodos bajo carga
                this.updateNodesUnderLoad(test.service, currentRPS);

                // 🆕 NUEVA: Actualizar componentes de networking
                this.updateNetworkingComponentsUnderLoad(test.networkingConfig, currentRPS);

                // Actualizar interfaz
                this.updateTestMetrics(test.service, currentRPS);
                ServiceManager.updateList();
                NodeManager.updateList();
                ClusterManager.updateList();
                MonitoringManager.updateMetrics();

                // 🆕 NUEVA: Actualizar listas de networking
                NetworkingManager.updateLoadBalancersList();
                NetworkingManager.updateNetworkServicesList();
                NetworkingManager.updateIngressesList();

            }, 1000);
        },

        // 🆕 NUEVA: Simular tráfico a través de componentes de networking
        simulateNetworkingTraffic(test, currentRPS) {
            const config = test.networkingConfig;

            // Simular tráfico a través de Load Balancers
            if (config.hasLoadBalancer) {
                this.testMetrics.loadBalancerRequests += currentRPS;
                config.loadBalancers.forEach(lb => {
                    // Simular distribución de carga
                    const distribution = this.calculateLoadBalancerDistribution(currentRPS, test.service.currentReplicas);
                    Logger.testLog(`[LB] ${lb.name}: Distribuyendo ${currentRPS} RPS entre ${test.service.currentReplicas} réplicas`, 'INFO');
                });
            }

            // Simular tráfico a través de Network Services
            if (config.hasNetworkService) {
                this.testMetrics.networkServiceRequests += currentRPS;
                config.networkServices.forEach(ns => {
                    Logger.testLog(`[NS] ${ns.name}: ${currentRPS} requests → ${ns.clusterIP}:${ns.port}`, 'INFO');
                });
            }

            // Simular tráfico a través de Ingress
            if (config.hasIngress) {
                this.testMetrics.ingressRequests += currentRPS;
                config.ingresses.forEach(ing => {
                    const protocol = ing.tlsEnabled ? 'HTTPS' : 'HTTP';
                    Logger.testLog(`[INGRESS] ${ing.name}: ${currentRPS} ${protocol} requests → ${ing.host}${ing.path}`, 'INFO');
                });
            }

            // Simular verificación de Network Policies
            if (config.hasNetworkPolicies) {
                config.networkPolicies.forEach(np => {
                    const violations = Math.floor(currentRPS * (np.action === 'deny' ? 0.05 : 0.001)); // 5% violaciones si es deny, 0.1% si es allow
                    this.testMetrics.networkPolicyViolations += violations;
                    if (violations > 0) {
                        Logger.testLog(`[POLICY] ${np.name}: ${violations} violaciones detectadas`, 'WARNING');
                    }
                });
            }
        },

        // 🆕 NUEVA: Calcular distribución de Load Balancer
        calculateLoadBalancerDistribution(totalRPS, replicas) {
            if (replicas === 0) return [];

            const baseRPS = Math.floor(totalRPS / replicas);
            const remainder = totalRPS % replicas;
            const distribution = [];

            for (let i = 0; i < replicas; i++) {
                distribution.push(baseRPS + (i < remainder ? 1 : 0));
            }

            return distribution;
        },

        // 🆕 MEJORADA: Simular errores considerando configuración de networking
        simulateNetworkingAwareErrors(service, requestsPerSecond, networkingConfig) {
            const loadPerReplica = requestsPerSecond / service.currentReplicas;
            let baseErrorRate = 0;

            // Errores base por sobrecarga
            if (loadPerReplica > service.throughput) {
                const overloadFactor = loadPerReplica / service.throughput;
                baseErrorRate = Math.min((overloadFactor - 1) * 20, 50); // Hasta 50% de errores
            }

            // Añadir errores por configuración de networking
            let networkingErrorRate = 0;

            if (networkingConfig.hasLoadBalancer) {
                networkingErrorRate += 0.1; // 0.1% adicional por Load Balancer
            }

            if (networkingConfig.hasNetworkPolicies) {
                // Network policies pueden causar más errores si están mal configuradas
                const denyPolicies = networkingConfig.networkPolicies.filter(np => np.action === 'deny');
                networkingErrorRate += denyPolicies.length * 0.5; // 0.5% por cada policy de deny
            }

            if (networkingConfig.hasIngress && networkingConfig.ingresses.some(ing => ing.tlsEnabled)) {
                networkingErrorRate += 0.2; // 0.2% adicional por TLS processing
            }

            const totalErrorRate = baseErrorRate + networkingErrorRate;
            const errors = Math.floor(requestsPerSecond * totalErrorRate / 100);

            service.errors += errors;

            if (errors > 0) {
                Logger.testLog(`[ERROR] ${errors} errores en ${service.name} (Carga: ${baseErrorRate.toFixed(1)}%, Network: ${networkingErrorRate.toFixed(1)}%)`, 'WARNING');
            }

            return errors;
        },

        // 🆕 NUEVA: Actualizar componentes de networking bajo carga
        updateNetworkingComponentsUnderLoad(networkingConfig, currentRPS) {
            // Actualizar Load Balancers
            networkingConfig.loadBalancers.forEach(lb => {
                lb.currentTraffic = currentRPS;
                lb.healthCheck = currentRPS < 1000; // Health check falla con mucho tráfico
            });

            // Actualizar Network Services
            networkingConfig.networkServices.forEach(ns => {
                ns.currentConnections = currentRPS;
                // Simular endpoints bajo carga
                ns.endpoints.forEach(endpoint => {
                    endpoint.ready = Math.random() > (currentRPS / 2000); // Más carga = menos endpoints ready
                });
            });

            // Actualizar Ingresses
            networkingConfig.ingresses.forEach(ing => {
                ing.currentRequests = currentRPS;
                ing.responseTime = ing.tlsEnabled ? currentRPS * 0.1 : currentRPS * 0.05; // TLS añade latencia
            });

            // Actualizar Network Policies
            networkingConfig.networkPolicies.forEach(np => {
                np.rulesApplied += currentRPS; // Incrementar contador de reglas aplicadas
            });
        },

        // Calcular RPS actual según el patrón
        calculateCurrentRPS(test) {
            const progress = test.elapsed / test.duration;

            switch (test.pattern) {
                case 'constant':
                    return test.targetRPS;

                case 'ramp':
                    return Math.floor(test.targetRPS * progress);

                case 'spike':
                    // Picos cada 20% del tiempo
                    const spikePosition = (test.elapsed % Math.floor(test.duration / 5)) / Math.floor(test.duration / 5);
                    if (spikePosition < 0.1) { // 10% del tiempo en pico
                        return test.targetRPS * 2;
                    } else {
                        return Math.floor(test.targetRPS * 0.3);
                    }

                default:
                    return test.targetRPS;
            }
        },

        // Actualizar nodos bajo carga
        updateNodesUnderLoad(service, currentRPS) {
            const clusterNodes = appState.nodes.filter(n => n.clusterId === service.clusterId);

            clusterNodes.forEach(node => {
                const baseLoad = currentRPS / (service.currentReplicas * service.throughput);

                // Simular carga más realista
                node.cpuUsage = Math.min(95, Math.max(10, baseLoad * 80 + Math.random() * 20));
                node.memoryUsage = Math.min(90, Math.max(15, (service.currentReplicas * 15) + Math.random() * 20));
            });
        },

        // Actualizar métricas de testing en UI
        updateTestMetrics(service, currentRPS) {
            document.getElementById('currentRPS').textContent = currentRPS;

            // 🆕 MEJORADA: Tiempo de respuesta considerando configuración de networking
            const baseResponseTime = service.responseTime + (Math.random() * 100 - 50);
            const networkingLatency = this.currentTest.networkingConfig.expectedLatencyIncrease;
            const totalResponseTime = Math.max(10, baseResponseTime + networkingLatency);

            document.getElementById('avgResponseTime').textContent = totalResponseTime.toFixed(0) + 'ms';

            document.getElementById('activeReplicas').textContent = service.currentReplicas;

            // Tasa de error
            const errorRate = this.testMetrics.totalRequests > 0 ?
                (this.testMetrics.totalErrors / this.testMetrics.totalRequests * 100) : 0;
            document.getElementById('errorRate').textContent = errorRate.toFixed(1) + '%';
        },

        // Pausar prueba
        pause() {
            if (appState.testInterval) {
                clearInterval(appState.testInterval);
                appState.testInterval = null;
                Logger.testLog('Prueba pausada', 'INFO');
            }
        },

        // Reanudar prueba
        resume() {
            if (appState.isTestRunning && !appState.testInterval) {
                this.runTestCycle();
                Logger.testLog('Prueba reanudada', 'INFO');
            }
        },

        // Detener prueba
        stop() {
            if (appState.testInterval) {
                clearInterval(appState.testInterval);
                appState.testInterval = null;
            }

            if (appState.isTestRunning) {
                // 🆕 NUEVO: Iniciar proceso de scale-down
                const testedService = this.currentTest ? this.currentTest.service : null;
                if (testedService) {
                    this.startScaleDown(testedService);
                }

                // Generar reporte final
                this.generateTestReport();

                appState.isTestRunning = false;
                appState.currentRequests = 0;
                this.currentTest = null;

                // Resetear métricas de testing
                document.getElementById('currentRPS').textContent = '0';
                document.getElementById('avgResponseTime').textContent = '0ms';
                document.getElementById('activeReplicas').textContent = '0';
                document.getElementById('errorRate').textContent = '0%';

                MonitoringManager.updateMetrics();
                Logger.testLog('Prueba de carga finalizada', 'SUCCESS');
            }
        },

        // 🆕 NUEVO: Iniciar proceso de scale-down gradual
        startScaleDown(service) {
            if (service.currentReplicas <= service.minReplicas) {
                Logger.testLog(`[SCALE-DOWN] Servicio ${service.name} ya está en réplicas mínimas`, 'INFO');
                // 🆕 NUEVO: Resetear métricas incluso si no hay scale-down
                this.normalizeServiceMetrics(service);
                return;
            }

            const initialReplicas = service.currentReplicas;
            const targetReplicas = service.minReplicas;
            const replicasToRemove = initialReplicas - targetReplicas;

            Logger.testLog(`[SCALE-DOWN] Iniciando reducción de ${service.name}: ${initialReplicas} -> ${targetReplicas} réplicas`, 'INFO');

            // 🆕 NUEVO: Iniciar normalización de métricas inmediatamente
            this.normalizeServiceMetrics(service);

            // Reducir gradualmente cada 5 segundos
            let currentStep = 0;
            const scaleDownInterval = setInterval(() => {
                if (currentStep >= replicasToRemove || service.currentReplicas <= service.minReplicas) {
                    clearInterval(scaleDownInterval);
                    Logger.testLog(`[SCALE-DOWN] Completado: ${service.name} tiene ${service.currentReplicas} réplicas`, 'SUCCESS');
                    
                    // Actualizar visualizaciones
                    ServiceManager.updateList();
                    NodeManager.updateList();
                    ClusterManager.updateList();
                    MonitoringManager.updateMetrics();
                    
                    // 🆕 NUEVO: Actualizar topología
                    if (typeof TopologyManager !== 'undefined' && TopologyManager.updateTopologyRealTime) {
                        TopologyManager.updateTopologyRealTime();
                    }
                    return;
                }

                // Reducir una réplica
                service.currentReplicas--;
                currentStep++;

                Logger.testLog(`[SCALE-DOWN] Pod terminado: ${service.name} ahora tiene ${service.currentReplicas} réplicas`, 'INFO');

                // Actualizar visualizaciones
                ServiceManager.updateList();
                NodeManager.updateList();
                
                // Recalcular métricas de nodos
                if (typeof NodeManager !== 'undefined' && NodeManager.updateMetrics) {
                    NodeManager.updateMetrics();
                }
            }, 5000); // Cada 5 segundos
        },

        // 🆕 NUEVO: Normalizar métricas del servicio después del test
        normalizeServiceMetrics(service) {
            Logger.testLog(`[NORMALIZE] Normalizando métricas de ${service.name}...`, 'INFO');
            
            // Detener flujo de requests inmediatamente
            const originalRequests = service.requests;
            service.requests = 0; // Reset requests por segundo
            
            // Iniciar reducción gradual de tasa de error
            const originalErrorRate = service.requests > 0 ? (service.errors / originalRequests * 100) : 0;
            
            // Normalizar errores gradualmente
            let normalizeStep = 0;
            const normalizeInterval = setInterval(() => {
                normalizeStep++;
                
                // Reducir errores gradualmente (simula recovery)
                if (service.errors > 0) {
                    const errorReduction = Math.ceil(service.errors * 0.1); // 10% reducción por paso
                    service.errors = Math.max(0, service.errors - errorReduction);
                }
                
                // Simular requests de healthcheck mínimos
                const healthcheckRequests = Math.floor(Math.random() * 5); // 0-5 requests
                service.requests = healthcheckRequests;
                
                // Detener después de 10 pasos (50 segundos)
                if (normalizeStep >= 10) {
                    clearInterval(normalizeInterval);
                    
                    // Estado final normalizado
                    service.requests = Math.floor(Math.random() * 3); // 0-2 requests base
                    service.errors = Math.floor(service.errors * 0.1); // Errores mínimos residuales
                    
                    Logger.testLog(`[NORMALIZE] Completado: ${service.name} normalizado`, 'SUCCESS');
                    
                    // Actualizar visualizaciones finales
                    ServiceManager.updateList();
                    return;
                }
                
                // Actualizar cada paso
                ServiceManager.updateList();
                
            }, 5000); // Cada 5 segundos
        },

        // Generar reporte de prueba
        generateTestReport() {
            if (!this.currentTest || !this.testMetrics) return;

            const test = this.currentTest;
            const service = test.service;
            const metrics = this.testMetrics;
            const networkingConfig = test.networkingConfig;

            const errorRate = metrics.totalRequests > 0 ?
                (metrics.totalErrors / metrics.totalRequests * 100) : 0;

            const report = `
=== REPORTE DE PRUEBA DE CARGA ===
Servicio: ${service.name} (${service.tech})
Duración: ${test.elapsed}/${test.duration} segundos
RPS objetivo: ${test.targetRPS}
Patrón: ${test.pattern}

CONFIGURACIÓN DE NETWORKING:
${this.generateNetworkingReport(networkingConfig)}

RESULTADOS:
- Total de requests: ${metrics.totalRequests.toLocaleString()}
- Total de errores: ${metrics.totalErrors.toLocaleString()}
- Tasa de error: ${errorRate.toFixed(2)}%
- Réplicas iniciales: ${service.minReplicas}
- Réplicas máximas alcanzadas: ${metrics.maxReplicas}
- Auto-escalado activado: ${metrics.maxReplicas > service.minReplicas ? 'Sí' : 'No'}
- Latencia adicional por networking: +${networkingConfig.expectedLatencyIncrease}ms

MÉTRICAS DE NETWORKING:
${this.generateNetworkingMetrics(metrics, networkingConfig)}

CONCLUSIONES:
${this.generateConclusions(errorRate, metrics.maxReplicas, service, networkingConfig)}
        `;

            Logger.testLog('=== REPORTE GENERADO ===', 'SUCCESS');
            Logger.testLog(report, 'INFO');

            // También mostrar en alert para revisión
            setTimeout(() => {
                alert(report);
            }, 1000);
        },

        // 🆕 NUEVA: Generar reporte de configuración de networking
        generateNetworkingReport(config) {
            const report = [];

            if (config.hasLoadBalancer) {
                report.push(`- Load Balancers activos: ${config.loadBalancers.length}`);
            }

            if (config.hasNetworkService) {
                report.push(`- Network Services: ${config.networkServices.length}`);
            }

            if (config.hasIngress) {
                report.push(`- Ingresses configurados: ${config.ingresses.length}`);
                const tlsCount = config.ingresses.filter(ing => ing.tlsEnabled).length;
                if (tlsCount > 0) {
                    report.push(`- Ingresses con TLS: ${tlsCount}`);
                }
            }

            if (config.hasNetworkPolicies) {
                const allowPolicies = config.networkPolicies.filter(np => np.action === 'allow').length;
                const denyPolicies = config.networkPolicies.filter(np => np.action === 'deny').length;
                report.push(`- Network Policies: ${allowPolicies} allow, ${denyPolicies} deny`);
            }

            if (report.length === 0) {
                return '- Sin configuración de networking (tráfico directo)';
            }

            return report.join('\n');
        },

        // 🆕 NUEVA: Generar métricas de networking
        generateNetworkingMetrics(metrics, config) {
            const report = [];

            if (config.hasLoadBalancer) {
                report.push(`- Requests a través de Load Balancer: ${metrics.loadBalancerRequests.toLocaleString()}`);
            }

            if (config.hasNetworkService) {
                report.push(`- Requests a través de Network Service: ${metrics.networkServiceRequests.toLocaleString()}`);
            }

            if (config.hasIngress) {
                report.push(`- Requests a través de Ingress: ${metrics.ingressRequests.toLocaleString()}`);
            }

            if (config.hasNetworkPolicies) {
                report.push(`- Violaciones de Network Policy: ${metrics.networkPolicyViolations.toLocaleString()}`);
            }

            if (report.length === 0) {
                return '- No se utilizaron componentes de networking';
            }

            return report.join('\n');
        },

        // Generar conclusiones automáticas
        generateConclusions(errorRate, maxReplicas, service, networkingConfig) {
            const conclusions = [];

            if (errorRate < 1) {
                conclusions.push('✅ El servicio manejó la carga exitosamente con muy pocos errores.');
            } else if (errorRate < 5) {
                conclusions.push('⚠️ El servicio tuvo algunos errores pero se mantuvo estable.');
            } else {
                conclusions.push('❌ El servicio experimentó una alta tasa de errores bajo carga.');
            }

            if (maxReplicas > service.minReplicas) {
                conclusions.push('📈 El auto-escalado funcionó correctamente, escalando a ' + maxReplicas + ' réplicas.');
            } else {
                conclusions.push('📊 No fue necesario escalar el servicio durante la prueba.');
            }

            if (maxReplicas === service.maxReplicas) {
                conclusions.push('⚠️ Se alcanzó el límite máximo de réplicas. Considera aumentarlo para mayor capacidad.');
            }

            // 🆕 NUEVAS: Conclusiones de networking
            if (networkingConfig.hasLoadBalancer) {
                conclusions.push('⚖️ Load Balancer distribuyó el tráfico correctamente entre las réplicas.');
            }

            if (networkingConfig.hasIngress && networkingConfig.ingresses.some(ing => ing.tlsEnabled)) {
                conclusions.push('🔒 Ingress con TLS añadió latencia adicional pero mejoró la seguridad.');
            }

            if (networkingConfig.hasNetworkPolicies) {
                const denyPolicies = networkingConfig.networkPolicies.filter(np => np.action === 'deny').length;
                if (denyPolicies > 0) {
                    conclusions.push('🛡️ Network Policies de seguridad funcionaron correctamente bloqueando tráfico no autorizado.');
                }
            }

            if (networkingConfig.expectedLatencyIncrease > 10) {
                conclusions.push('🐌 La configuración de networking añadió latencia significativa (+' + networkingConfig.expectedLatencyIncrease + 'ms). Considera optimizar.');
            } else if (networkingConfig.expectedLatencyIncrease > 0) {
                conclusions.push('⏱️ La configuración de networking añadió latencia mínima (+' + networkingConfig.expectedLatencyIncrease + 'ms).');
            }

            return conclusions.join('\n');
        }
    };

    // Gestor de interfaz de usuario
    const UI = {
        // Cambiar pestañas
        showTab(tabName) {
            // Ocultar todas las pestañas
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });

            // Mostrar pestaña seleccionada
            document.getElementById(tabName).classList.add('active');
            event.target.classList.add('active');

            // Actualizar selectores cuando se cambia de pestaña
            this.updateSelectOptions();
        },

        // Actualizar opciones de los selectores
        updateSelectOptions() {
            this.updateClusterSelectors();
            this.updateServiceSelector();
        },

        // Actualizar selectores de clusters
        updateClusterSelectors() {
            const nodeClusterSelect = document.getElementById('nodeCluster');
            const serviceClusterSelect = document.getElementById('serviceCluster');

            const clusterOptions = appState.clusters.map(cluster =>
                `<option value="${cluster.id}">${cluster.name} (${cluster.region})</option>`
            ).join('');

            const defaultOption = '<option value="">Seleccionar cluster...</option>';

            if (nodeClusterSelect) {
                nodeClusterSelect.innerHTML = defaultOption + clusterOptions;
            }

            if (serviceClusterSelect) {
                serviceClusterSelect.innerHTML = defaultOption + clusterOptions;
            }
        },

        // Actualizar selector de servicios para testing
        updateServiceSelector() {
            const testServiceSelect = document.getElementById('testService');

            if (!testServiceSelect) return;

            const serviceOptions = appState.services.map(service => {
                const cluster = appState.clusters.find(c => c.id === service.clusterId);
                return `<option value="${service.id}">${service.name} (${service.tech}) - ${cluster ? cluster.name : 'N/A'}</option>`;
            }).join('');

            testServiceSelect.innerHTML = '<option value="">Seleccionar servicio...</option>' + serviceOptions;
        },

        // Inicializar interfaz
        initialize() {
            // Actualizar selectores iniciales
            this.updateSelectOptions();

            // Inicializar métricas
            MonitoringManager.updateMetrics();

            // Configurar logs iniciales
            Logger.log('Simulador K8s iniciado correctamente', 'SUCCESS');
            Logger.testLog('Sistema de testing inicializado', 'INFO');
        }
    };

    // Funciones globales para compatibilidad
    window.showTab = (tabName) => UI.showTab(tabName);
    window.createCluster = () => ClusterManager.create();
    window.createNode = () => NodeManager.create();
    window.deployService = () => ServiceManager.deploy();
    window.scaleService = (id, direction) => ServiceManager.scale(id, direction);
    window.startLoadTest = () => TestingManager.start();
    window.pauseLoadTest = () => TestingManager.pause();
    window.stopLoadTest = () => TestingManager.stop();

    // Exportar para uso global
    window.MonitoringManager = MonitoringManager;
    window.TestingManager = TestingManager;
    window.UI = UI;

} // Fin de protección contra múltiples cargas