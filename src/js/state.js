if (typeof window.appState === 'undefined') {

    // Estado global de la aplicación
    const appState = {
        clusters: [],
        nodes: [],
        services: [],
        isTestRunning: false,
        testInterval: null,
        currentRequests: 0
    };

    // Configuraciones globales
    const config = {
        regions: [
            { value: 'us-east-1', label: 'US East (N. Virginia)' },
            { value: 'us-west-2', label: 'US West (Oregon)' },
            { value: 'eu-west-1', label: 'Europe (Ireland)' },
            { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' }
        ],

        k8sVersions: [
            { value: '1.28', label: '1.28 (Latest)' },
            { value: '1.27', label: '1.27' },
            { value: '1.26', label: '1.26' }
        ],

        clusterTypes: [
            { value: 'managed', label: 'Managed (EKS/GKE)' },
            { value: 'self-managed', label: 'Self-Managed' }
        ],

        nodeTypes: [
            { value: 't3.medium', label: 't3.medium (2 vCPU, 4GB RAM)' },
            { value: 't3.large', label: 't3.large (2 vCPU, 8GB RAM)' },
            { value: 'c5.large', label: 'c5.large (2 vCPU, 4GB RAM)' },
            { value: 'm5.large', label: 'm5.large (2 vCPU, 8GB RAM)' },
            { value: 'm5.xlarge', label: 'm5.xlarge (4 vCPU, 16GB RAM)' }
        ],

        availabilityZones: [
            { value: 'a', label: 'Zona A' },
            { value: 'b', label: 'Zona B' },
            { value: 'c', label: 'Zona C' }
        ],

        technologies: [
            { value: 'nodejs', label: 'Node.js', icon: '📗' },
            { value: 'python', label: 'Python', icon: '🐍' },
            { value: 'golang', label: 'Go', icon: '🔷' },
            { value: 'rust', label: 'Rust', icon: '🦀' }
        ],

        serviceTypes: [
            { value: 'backend', label: 'Backend API' },
            { value: 'frontend', label: 'Frontend' },
            { value: 'microservice', label: 'Microservicio' }
        ],

        loadPatterns: [
            { value: 'constant', label: 'Constante' },
            { value: 'ramp', label: 'Incrementar Gradualmente' },
            { value: 'spike', label: 'Picos de Carga' }
        ]
    };

    // Funciones de estado
    const StateManager = {
        // Funciones para clusters
        addCluster(cluster) {
            cluster.id = Date.now();
            cluster.created = new Date();
            appState.clusters.push(cluster);
            return cluster;
        },

        removeCluster(clusterId) {
            appState.clusters = appState.clusters.filter(c => c.id !== clusterId);
            appState.nodes = appState.nodes.filter(n => n.clusterId !== clusterId);
            appState.services = appState.services.filter(s => s.clusterId !== clusterId);
        },

        // Funciones para nodos
        addNode(node) {
            node.id = Date.now();
            node.cpuUsage = Math.random() * 30 + 10; // Entre 10-40%
            node.memoryUsage = Math.random() * 40 + 15; // Entre 15-55%
            appState.nodes.push(node);
            return node;
        },

        removeNode(nodeId) {
            appState.nodes = appState.nodes.filter(n => n.id !== nodeId);
        },

        // Funciones para servicios
        addService(service) {
            service.id = Date.now();
            service.currentReplicas = service.minReplicas;
            service.requests = 0;
            service.errors = 0;
            appState.services.push(service);
            return service;
        },

        removeService(serviceId) {
            appState.services = appState.services.filter(s => s.id !== serviceId);
        },

        scaleService(serviceId, direction) {
            const service = appState.services.find(s => s.id === serviceId);
            if (!service) return false;

            const newReplicas = service.currentReplicas + direction;

            if (newReplicas >= service.minReplicas && newReplicas <= service.maxReplicas) {
                service.currentReplicas = newReplicas;
                return true;
            }
            return false;
        },

        // Cálculo de métricas
        calculateClusterMetrics() {
            appState.clusters.forEach(cluster => {
                cluster.nodes = appState.nodes.filter(n => n.clusterId === cluster.id).length;
                cluster.pods = appState.services
                    .filter(s => s.clusterId === cluster.id)
                    .reduce((sum, service) => sum + service.currentReplicas, 0);
            });
        },

        // Obtener totales
        getTotals() {
            return {
                clusters: appState.clusters.length,
                nodes: appState.nodes.length,
                pods: appState.services.reduce((sum, service) => sum + service.currentReplicas, 0),
                requests: appState.currentRequests
            };
        },

        // Calcular uso promedio de recursos
        getResourceUsage() {
            if (appState.nodes.length === 0) return { cpu: 0, memory: 0 };

            const avgCpu = appState.nodes.reduce((sum, node) => sum + node.cpuUsage, 0) / appState.nodes.length;
            const avgMemory = appState.nodes.reduce((sum, node) => sum + node.memoryUsage, 0) / appState.nodes.length;

            return { cpu: avgCpu, memory: avgMemory };
        }
    };

    // Exportar para uso global
    window.appState = appState;
    window.config = config;
    window.StateManager = StateManager;

} // Fin de protección contra múltiples cargas