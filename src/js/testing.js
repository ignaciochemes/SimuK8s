if (typeof window.TestingManager === 'undefined') {

    const TestingManager = {
        isRunning: false,
        currentTest: null,
        testInterval: null,

        // Iniciar prueba de carga
        start() {
            const serviceSelect = document.getElementById('testService');
            const serviceId = serviceSelect.value;
            const requestsPerSecond = parseInt(document.getElementById('requestsPerSecond').value) || 100;
            const duration = parseInt(document.getElementById('testDuration').value) || 60;

            if (!serviceId) {
                alert('Por favor selecciona un servicio para testear');
                return;
            }

            const service = appState.services.find(s => s.id === parseInt(serviceId));
            if (!service) {
                alert('Servicio no encontrado');
                return;
            }

            this.isRunning = true;
            appState.isTestRunning = true;
            this.currentTest = {
                service: service,
                requestsPerSecond: requestsPerSecond,
                duration: duration,
                startTime: Date.now(),
                totalRequests: 0,
                totalErrors: 0
            };

            Logger.testLog(`Iniciando prueba de carga en ${service.name}: ${requestsPerSecond} req/s por ${duration}s`, 'INFO');

            // Iniciar simulación
            this.testInterval = setInterval(() => {
                this.simulateLoad();
            }, 1000);

            // Detener automáticamente después de la duración
            setTimeout(() => {
                this.stop();
            }, duration * 1000);

            this.updateUI();
        },

        // Pausar prueba
        pause() {
            if (this.testInterval) {
                clearInterval(this.testInterval);
                this.testInterval = null;
                Logger.testLog('Prueba pausada', 'WARNING');
            }
        },

        // Detener prueba
        stop() {
            if (this.testInterval) {
                clearInterval(this.testInterval);
                this.testInterval = null;
            }

            this.isRunning = false;
            appState.isTestRunning = false;

            if (this.currentTest) {
                const duration = (Date.now() - this.currentTest.startTime) / 1000;
                const avgRPS = this.currentTest.totalRequests / duration;
                const errorRate = (this.currentTest.totalErrors / this.currentTest.totalRequests) * 100;

                Logger.testLog(`Prueba completada en ${duration.toFixed(1)}s: ${avgRPS.toFixed(1)} RPS promedio, ${errorRate.toFixed(2)}% errores`, 'SUCCESS');
                this.currentTest = null;
            }

            this.updateUI();
        },

        // Simular carga en el servicio
        simulateLoad() {
            if (!this.currentTest) return;

            const service = this.currentTest.service;
            const rps = this.currentTest.requestsPerSecond;

            // Agregar requests al servicio
            service.requests += rps;
            this.currentTest.totalRequests += rps;
            appState.currentRequests = rps;

            // Simular auto-escalado si está disponible
            if (typeof ServiceManager !== 'undefined' && ServiceManager.simulateAutoScaling) {
                ServiceManager.simulateAutoScaling(service, rps);
            }

            // Simular errores bajo carga
            if (typeof ServiceManager !== 'undefined' && ServiceManager.simulateErrors) {
                const errors = ServiceManager.simulateErrors(service, rps);
                this.currentTest.totalErrors += errors;
            }

            // Actualizar métricas en tiempo real
            this.updateRealTimeMetrics();
        },

        // Actualizar métricas en tiempo real
        updateRealTimeMetrics() {
            if (!this.currentTest) return;

            const service = this.currentTest.service;
            const duration = (Date.now() - this.currentTest.startTime) / 1000;
            const avgRPS = this.currentTest.totalRequests / duration;
            const errorRate = this.currentTest.totalErrors > 0 ? 
                (this.currentTest.totalErrors / this.currentTest.totalRequests) * 100 : 0;

            // Actualizar UI
            document.getElementById('currentRPS').textContent = this.currentTest.requestsPerSecond;
            document.getElementById('avgResponseTime').textContent = `${service.responseTime + Math.random() * 50}ms`;
            document.getElementById('activeReplicas').textContent = service.currentReplicas + (service.pendingPods || 0);
            document.getElementById('errorRate').textContent = `${errorRate.toFixed(2)}%`;
        },

        // Actualizar UI
        updateUI() {
            // Actualizar estado de botones y métricas
            if (typeof MonitoringManager !== 'undefined') {
                MonitoringManager.updateMetrics();
            }
            if (typeof ServiceManager !== 'undefined') {
                ServiceManager.updateList();
            }
            if (typeof NodeManager !== 'undefined') {
                NodeManager.updateList();
            }
        }
    };

    // Funciones globales para compatibilidad
    window.startLoadTest = () => TestingManager.start();
    window.pauseLoadTest = () => TestingManager.pause();
    window.stopLoadTest = () => TestingManager.stop();

    // Exportar para uso global
    window.TestingManager = TestingManager;

} // Fin de protección contra múltiples cargas