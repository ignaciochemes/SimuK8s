// K8s Simulator - Utilidades y Funciones Auxiliares
// Protección contra múltiples cargas
if (typeof window.Utils === 'undefined') {

const Utils = {
    // Formatear timestamp
    formatTimestamp() {
        return new Date().toLocaleTimeString();
    },
    
    // Generar ID único
    generateId() {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    },
    
    // Formatear bytes a MB/GB
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // Formatear porcentaje
    formatPercentage(value, decimals = 1) {
        return value.toFixed(decimals) + '%';
    },
    
    // Validar nombre de recurso
    validateResourceName(name) {
        const regex = /^[a-z0-9-]+$/;
        return regex.test(name) && name.length > 0 && name.length <= 63;
    },
    
    // Calcular distribución de pods en nodos
    calculatePodDistribution(clusterId) {
        const clusterServices = appState.services.filter(s => s.clusterId === clusterId);
        const clusterNodes = appState.nodes.filter(n => n.clusterId === clusterId);
        
        if (clusterNodes.length === 0) return {};
        
        const distribution = {};
        clusterNodes.forEach(node => {
            distribution[node.id] = 0;
        });
        
        clusterServices.forEach(service => {
            const podsPerNode = Math.ceil(service.currentReplicas / clusterNodes.length);
            clusterNodes.forEach(node => {
                distribution[node.id] += podsPerNode;
            });
        });
        
        return distribution;
    },
    
    // Simular latencia de red
    simulateNetworkLatency(min = 50, max = 200) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    // Generar color aleatorio para métricas
    generateRandomColor() {
        const colors = [
            '#667eea', '#764ba2', '#f093fb', '#f5576c',
            '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    },
    
    // Debounce para optimizar rendimiento
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Throttle para limitar ejecución
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Copiar texto al portapapeles
    copyToClipboard(text) {
        if (navigator.clipboard) {
            return navigator.clipboard.writeText(text);
        } else {
            // Fallback para navegadores antiguos
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return Promise.resolve();
        }
    },
    
    // Exportar datos a JSON
    exportData() {
        const data = {
            clusters: appState.clusters,
            nodes: appState.nodes,
            services: appState.services,
            exportedAt: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    },
    
    // Importar datos desde JSON
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (data.clusters) appState.clusters = data.clusters;
            if (data.nodes) appState.nodes = data.nodes;
            if (data.services) appState.services = data.services;
            
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    },
    
    // Calcular costo estimado
    calculateEstimatedCost(resource) {
        const costPerHour = {
            't3.medium': 0.0416,
            't3.large': 0.0832,
            'c5.large': 0.085,
            'm5.large': 0.096,
            'm5.xlarge': 0.192
        };
        
        if (resource.type === 'node') {
            return costPerHour[resource.nodeType] || 0;
        }
        
        return 0;
    },
    
    // Generar configuración YAML para Kubernetes
    generateKubernetesYAML(service) {
        return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${service.name}
  labels:
    app: ${service.name}
    tech: ${service.tech}
spec:
  replicas: ${service.currentReplicas}
  selector:
    matchLabels:
      app: ${service.name}
  template:
    metadata:
      labels:
        app: ${service.name}
    spec:
      containers:
      - name: ${service.name}
        image: ${service.tech}:latest
        ports:
        - containerPort: 8080
        resources:
          limits:
            cpu: "${service.cpuLimit}m"
            memory: "${service.ramLimit}Mi"
          requests:
            cpu: "100m"
            memory: "128Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: ${service.name}-service
spec:
  selector:
    app: ${service.name}
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
  type: LoadBalancer`;
    }
};

// Logging system
const Logger = {
    logs: [],
    testLogs: [],
    
    log(message, type = 'INFO') {
        const timestamp = Utils.formatTimestamp();
        const logEntry = {
            timestamp,
            type,
            message,
            id: Utils.generateId()
        };
        
        this.logs.push(logEntry);
        this.displayLog(logEntry, 'systemLogs');
        
        // Limitar logs a 100 entradas
        if (this.logs.length > 100) {
            this.logs.shift();
        }
    },
    
    testLog(message, type = 'INFO') {
        const timestamp = Utils.formatTimestamp();
        const logEntry = {
            timestamp,
            type,
            message,
            id: Utils.generateId()
        };
        
        this.testLogs.push(logEntry);
        this.displayLog(logEntry, 'testLogs');
        
        // Limitar logs a 100 entradas
        if (this.testLogs.length > 100) {
            this.testLogs.shift();
        }
    },
    
    displayLog(logEntry, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const logElement = document.createElement('div');
        logElement.textContent = `[${logEntry.timestamp}] [${logEntry.type}] ${logEntry.message}`;
        
        // Aplicar colores según el tipo
        switch (logEntry.type) {
            case 'ERROR':
                logElement.style.color = '#ff6b6b';
                break;
            case 'WARNING':
                logElement.style.color = '#feca57';
                break;
            case 'SUCCESS':
                logElement.style.color = '#48dbfb';
                break;
            default:
                logElement.style.color = '#00ff00';
        }
        
        container.appendChild(logElement);
        container.scrollTop = container.scrollHeight;
    },
    
    clearLogs() {
        this.logs = [];
        const container = document.getElementById('systemLogs');
        if (container) container.innerHTML = '';
    },
    
    clearTestLogs() {
        this.testLogs = [];
        const container = document.getElementById('testLogs');
        if (container) container.innerHTML = '';
    },
    
    exportLogs() {
        return {
            systemLogs: this.logs,
            testLogs: this.testLogs,
            exportedAt: new Date().toISOString()
        };
    }
};

// Exportar para uso global
window.Utils = Utils;
window.Logger = Logger;

// UI Manager para manejo de tabs y interfaces
const UI = {
    initialize() {
        this.setupTabs();
        this.updateSelectOptions();
    },
    
    setupTabs() {
        // Configurar tabs principales
        window.showTab = (tabName) => {
            // Ocultar todos los paneles
            document.querySelectorAll('.tab-panel').forEach(panel => {
                panel.classList.remove('active');
            });
            
            // Desactivar todas las tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Mostrar panel activo
            document.getElementById(tabName).classList.add('active');
            
            // Activar tab correspondiente
            const activeTab = Array.from(document.querySelectorAll('.tab')).find(tab => 
                tab.textContent.includes(this.getTabIcon(tabName))
            );
            if (activeTab) {
                activeTab.classList.add('active');
            }
            
            // Actualizar datos específicos de la tab
            if (tabName === 'configurations') {
                updateConfigurationsStats();
                ConfigurationsManager.updateConfigurationsList();
            }
        };
        
        // Configurar funciones de creación
        window.createCluster = () => ClusterManager.create();
        window.createNode = () => NodeManager.create();
        window.deployService = () => ServiceManager.deploy();
    },
    
    getTabIcon(tabName) {
        const icons = {
            'clusters': '🏗️',
            'nodes': '🖥️',
            'services': '⚙️',
            'networking': '🌐',
            'configurations': '💾',
            'monitoring': '📊',
            'testing': '🧪'
        };
        return icons[tabName] || '';
    },
    
    updateSelectOptions() {
        // Actualizar selectores de clusters
        const clusterSelectors = ['nodeCluster', 'serviceCluster'];
        const clusterOptions = appState.clusters.map(cluster => 
            `<option value="${cluster.id}">${cluster.name} (${cluster.region})</option>`
        ).join('');
        
        clusterSelectors.forEach(selectorId => {
            const selector = document.getElementById(selectorId);
            if (selector) {
                const currentValue = selector.value;
                selector.innerHTML = '<option value="">Seleccionar cluster...</option>' + clusterOptions;
                if (currentValue) selector.value = currentValue;
            }
        });
        
        // Actualizar selectores de servicios para testing
        const serviceSelectors = ['testService'];
        const serviceOptions = appState.services.map(service => {
            const cluster = appState.clusters.find(c => c.id === service.clusterId);
            return `<option value="${service.id}">${service.name} (${cluster ? cluster.name : 'N/A'})</option>`;
        }).join('');
        
        serviceSelectors.forEach(selectorId => {
            const selector = document.getElementById(selectorId);
            if (selector) {
                const currentValue = selector.value;
                selector.innerHTML = '<option value="">Seleccionar servicio...</option>' + serviceOptions;
                if (currentValue) selector.value = currentValue;
            }
        });
    }
};

// Exportar UI Manager
window.UI = UI;

} // Fin de protección contra múltiples cargas