// K8s Simulator - Gestor de Configuraciones
// Protección contra múltiples cargas
if (typeof window.ConfigurationsManager === 'undefined') {

const ConfigurationsManager = {
    // Versión del formato de configuración para compatibilidad futura
    CONFIGURATION_VERSION: '1.0',

    // Guardar configuración completa
    saveConfiguration() {
        const name = document.getElementById('configName').value.trim();
        const description = document.getElementById('configDescription').value.trim();

        if (!name) {
            alert('Por favor ingresa un nombre para la configuración');
            return;
        }

        if (!Utils.validateResourceName(name.toLowerCase())) {
            alert('El nombre de la configuración solo puede contener letras, números, guiones y espacios');
            return;
        }

        // Verificar que hay algo que guardar
        if (appState.clusters.length === 0) {
            alert('No hay clusters para guardar. Crea al menos un cluster antes de guardar la configuración.');
            return;
        }

        const configuration = {
            metadata: {
                name: name,
                description: description,
                version: this.CONFIGURATION_VERSION,
                created: new Date().toISOString(),
                creator: 'K8s Simulator'
            },
            // Guardar estado completo
            clusters: JSON.parse(JSON.stringify(appState.clusters)),
            nodes: JSON.parse(JSON.stringify(appState.nodes)),
            services: JSON.parse(JSON.stringify(appState.services)),
            // Guardar configuraciones de networking
            networking: {
                loadBalancers: JSON.parse(JSON.stringify(NetworkingManager.loadBalancers)),
                services: JSON.parse(JSON.stringify(NetworkingManager.services)),
                networkPolicies: JSON.parse(JSON.stringify(NetworkingManager.networkPolicies)),
                ingresses: JSON.parse(JSON.stringify(NetworkingManager.ingresses))
            }
        };

        // Obtener configuraciones existentes
        const existingConfigs = this.getStoredConfigurations();
        
        // Verificar duplicados
        if (existingConfigs.find(config => config.metadata.name === name)) {
            if (!confirm(`Ya existe una configuración llamada "${name}". ¿Deseas sobrescribirla?`)) {
                return;
            }
            // Eliminar la configuración existente
            this.deleteConfiguration(name);
        }

        // Guardar en localStorage
        try {
            const configKey = `k8s-config-${name}`;
            localStorage.setItem(configKey, JSON.stringify(configuration));
            
            // Actualizar índice de configuraciones
            this.updateConfigurationIndex(name);
            
            // Actualizar UI
            this.updateConfigurationsList();
            this.clearSaveForm();
            
            // Calcular estadísticas
            const stats = this.calculateConfigurationStats(configuration);
            
            Logger.log(`Configuración "${name}" guardada exitosamente (${stats.clusters} clusters, ${stats.nodes} nodos, ${stats.services} servicios)`, 'SUCCESS');
            
        } catch (error) {
            console.error('Error guardando configuración:', error);
            alert('Error al guardar la configuración. Puede que no haya suficiente espacio de almacenamiento.');
        }
    },

    // Cargar configuración
    loadConfiguration(configName) {
        if (!configName) {
            alert('Por favor selecciona una configuración para cargar');
            return;
        }

        // Advertir sobre pérdida de datos actuales
        if (appState.clusters.length > 0 || appState.nodes.length > 0 || appState.services.length > 0) {
            if (!confirm('¿Estás seguro de cargar esta configuración?\n\nSe perderán todos los clusters, nodos y servicios actuales.')) {
                return;
            }
        }

        try {
            const configKey = `k8s-config-${configName}`;
            const configData = localStorage.getItem(configKey);
            
            if (!configData) {
                alert('Configuración no encontrada');
                return;
            }

            const configuration = JSON.parse(configData);
            
            // Verificar versión de compatibilidad
            if (!this.isCompatibleVersion(configuration.metadata.version)) {
                alert('Esta configuración fue creada con una versión incompatible del simulador');
                return;
            }

            // Limpiar estado actual
            this.clearCurrentState();

            // Restaurar configuraciones
            appState.clusters = configuration.clusters || [];
            appState.nodes = configuration.nodes || [];
            appState.services = configuration.services || [];

            // Restaurar networking si existe
            if (configuration.networking) {
                NetworkingManager.loadBalancers = configuration.networking.loadBalancers || [];
                NetworkingManager.services = configuration.networking.services || [];
                NetworkingManager.networkPolicies = configuration.networking.networkPolicies || [];
                NetworkingManager.ingresses = configuration.networking.ingresses || [];
            }

            // Actualizar todas las vistas
            this.updateAllViews();

            // Calcular estadísticas
            const stats = this.calculateConfigurationStats(configuration);
            
            Logger.log(`Configuración "${configName}" cargada exitosamente (${stats.clusters} clusters, ${stats.nodes} nodos, ${stats.services} servicios)`, 'SUCCESS');
            
            // Cerrar modal si está abierto
            this.closeLoadModal();
            
        } catch (error) {
            console.error('Error cargando configuración:', error);
            alert('Error al cargar la configuración. El archivo puede estar corrupto.');
        }
    },

    // Eliminar configuración
    deleteConfiguration(configName) {
        if (!confirm(`¿Estás seguro de eliminar la configuración "${configName}"?\n\nEsta acción no se puede deshacer.`)) {
            return;
        }

        try {
            const configKey = `k8s-config-${configName}`;
            localStorage.removeItem(configKey);
            
            // Actualizar índice
            this.removeFromConfigurationIndex(configName);
            
            // Actualizar lista
            this.updateConfigurationsList();
            
            Logger.log(`Configuración "${configName}" eliminada`, 'WARNING');
            
        } catch (error) {
            console.error('Error eliminando configuración:', error);
            alert('Error al eliminar la configuración');
        }
    },

    // Exportar configuración como archivo JSON
    exportConfiguration(configName) {
        try {
            const configKey = `k8s-config-${configName}`;
            const configData = localStorage.getItem(configKey);
            
            if (!configData) {
                alert('Configuración no encontrada');
                return;
            }

            const configuration = JSON.parse(configData);
            
            // Crear archivo para descarga
            const blob = new Blob([JSON.stringify(configuration, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `k8s-config-${configName}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Logger.log(`Configuración "${configName}" exportada como archivo JSON`, 'SUCCESS');
            
        } catch (error) {
            console.error('Error exportando configuración:', error);
            alert('Error al exportar la configuración');
        }
    },

    // Importar configuración desde archivo
    importConfiguration(file) {
        if (!file) {
            alert('Por favor selecciona un archivo para importar');
            return;
        }

        if (!file.name.endsWith('.json')) {
            alert('Por favor selecciona un archivo JSON válido');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const configuration = JSON.parse(e.target.result);
                
                // Validar estructura de configuración
                if (!this.validateConfigurationStructure(configuration)) {
                    alert('El archivo no contiene una configuración válida del simulador K8s');
                    return;
                }

                // Verificar versión de compatibilidad
                if (!this.isCompatibleVersion(configuration.metadata.version)) {
                    alert('Esta configuración fue creada con una versión incompatible del simulador');
                    return;
                }

                // Verificar si ya existe una configuración con ese nombre
                const existingConfigs = this.getStoredConfigurations();
                const configName = configuration.metadata.name;
                
                if (existingConfigs.find(config => config.metadata.name === configName)) {
                    if (!confirm(`Ya existe una configuración llamada "${configName}". ¿Deseas sobrescribirla?`)) {
                        return;
                    }
                    this.deleteConfiguration(configName);
                }

                // Guardar configuración importada
                const configKey = `k8s-config-${configName}`;
                localStorage.setItem(configKey, JSON.stringify(configuration));
                
                // Actualizar índice
                this.updateConfigurationIndex(configName);
                
                // Actualizar lista
                this.updateConfigurationsList();
                
                Logger.log(`Configuración "${configName}" importada exitosamente`, 'SUCCESS');
                
                // Preguntar si desea cargar la configuración
                if (confirm(`Configuración importada exitosamente. ¿Deseas cargarla ahora?`)) {
                    this.loadConfiguration(configName);
                }
                
            } catch (error) {
                console.error('Error importando configuración:', error);
                alert('Error al importar la configuración. El archivo puede estar corrupto o no ser válido.');
            }
        };
        
        reader.readAsText(file);
    },

    // Obtener todas las configuraciones almacenadas
    getStoredConfigurations() {
        const configs = [];
        const configIndex = this.getConfigurationIndex();
        
        configIndex.forEach(configName => {
            try {
                const configKey = `k8s-config-${configName}`;
                const configData = localStorage.getItem(configKey);
                if (configData) {
                    const configuration = JSON.parse(configData);
                    configs.push(configuration);
                }
            } catch (error) {
                console.warn(`Error cargando configuración ${configName}:`, error);
            }
        });
        
        return configs.sort((a, b) => new Date(b.metadata.created) - new Date(a.metadata.created));
    },

    // Actualizar lista de configuraciones en la UI
    updateConfigurationsList() {
        const container = document.getElementById('configurationsList');
        const configs = this.getStoredConfigurations();

        if (configs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;">💾</div>
                    <p>No hay configuraciones guardadas. Guarda tu primera configuración para poder reutilizarla después.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = configs.map(config => this.renderConfigurationItem(config)).join('');
    },

    // Renderizar elemento de configuración
    renderConfigurationItem(config) {
        const stats = this.calculateConfigurationStats(config);
        const created = new Date(config.metadata.created).toLocaleString();
        const size = this.calculateConfigurationSize(config);

        return `
            <div class="service-item">
                <div class="item-header">
                    <div class="item-title">💾 ${config.metadata.name}</div>
                    <span class="item-status status-active">v${config.metadata.version}</span>
                </div>
                <p><strong>Descripción:</strong> ${config.metadata.description || 'Sin descripción'}</p>
                <p><strong>Creada:</strong> ${created} | <strong>Tamaño:</strong> ${size}</p>
                <p><strong>Contenido:</strong> ${stats.clusters} clusters, ${stats.nodes} nodos, ${stats.services} servicios</p>
                <p><strong>Networking:</strong> ${stats.loadBalancers} LB, ${stats.networkServices} servicios de red, ${stats.policies} políticas, ${stats.ingresses} ingress</p>
                
                <div class="load-test-controls">
                    <button class="btn" onclick="ConfigurationsManager.loadConfiguration('${config.metadata.name}')">Cargar</button>
                    <button class="btn btn-secondary" onclick="ConfigurationsManager.showConfigurationDetails('${config.metadata.name}')">Detalles</button>
                    <button class="btn btn-secondary" onclick="ConfigurationsManager.exportConfiguration('${config.metadata.name}')">Exportar</button>
                    <button class="btn btn-danger" onclick="ConfigurationsManager.deleteConfiguration('${config.metadata.name}')">Eliminar</button>
                </div>
            </div>
        `;
    },

    // Mostrar detalles de configuración
    showConfigurationDetails(configName) {
        try {
            const configKey = `k8s-config-${configName}`;
            const configData = localStorage.getItem(configKey);
            
            if (!configData) {
                alert('Configuración no encontrada');
                return;
            }

            const configuration = JSON.parse(configData);
            const stats = this.calculateConfigurationStats(configuration);
            const created = new Date(configuration.metadata.created).toLocaleString();
            const size = this.calculateConfigurationSize(configuration);

            const details = `
Detalles de la Configuración: ${configuration.metadata.name}
${'='.repeat(50)}

Metadatos:
- Descripción: ${configuration.metadata.description || 'Sin descripción'}
- Versión: ${configuration.metadata.version}
- Creada: ${created}
- Tamaño: ${size}

Clusters (${stats.clusters}):
${configuration.clusters.map(cluster => `- ${cluster.name} (${cluster.region}, ${cluster.version})`).join('\n')}

Nodos (${stats.nodes}):
${configuration.nodes.map(node => {
    const cluster = configuration.clusters.find(c => c.id === node.clusterId);
    return `- ${node.name} (${node.type}) en ${cluster ? cluster.name : 'N/A'}`;
}).join('\n')}

Servicios (${stats.services}):
${configuration.services.map(service => {
    const cluster = configuration.clusters.find(c => c.id === service.clusterId);
    return `- ${service.name} (${service.tech}) en ${cluster ? cluster.name : 'N/A'}`;
}).join('\n')}

Networking:
- Load Balancers: ${stats.loadBalancers}
- Servicios de Red: ${stats.networkServices}
- Network Policies: ${stats.policies}
- Ingresses: ${stats.ingresses}
            `;

            alert(details);
            
        } catch (error) {
            console.error('Error mostrando detalles:', error);
            alert('Error al cargar los detalles de la configuración');
        }
    },

    // Utilidades
    calculateConfigurationStats(config) {
        return {
            clusters: config.clusters ? config.clusters.length : 0,
            nodes: config.nodes ? config.nodes.length : 0,
            services: config.services ? config.services.length : 0,
            loadBalancers: config.networking?.loadBalancers ? config.networking.loadBalancers.length : 0,
            networkServices: config.networking?.services ? config.networking.services.length : 0,
            policies: config.networking?.networkPolicies ? config.networking.networkPolicies.length : 0,
            ingresses: config.networking?.ingresses ? config.networking.ingresses.length : 0
        };
    },

    calculateConfigurationSize(config) {
        const sizeInBytes = new Blob([JSON.stringify(config)]).size;
        if (sizeInBytes < 1024) {
            return `${sizeInBytes} bytes`;
        } else if (sizeInBytes < 1024 * 1024) {
            return `${(sizeInBytes / 1024).toFixed(1)} KB`;
        } else {
            return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
        }
    },

    validateConfigurationStructure(config) {
        return config &&
               config.metadata &&
               config.metadata.name &&
               config.metadata.version &&
               Array.isArray(config.clusters) &&
               Array.isArray(config.nodes) &&
               Array.isArray(config.services);
    },

    isCompatibleVersion(version) {
        // Por ahora solo soportamos la versión 1.0
        return version === '1.0';
    },

    clearCurrentState() {
        // Parar cualquier test en ejecución
        if (appState.isTestRunning) {
            window.stopLoadTest();
        }

        // Limpiar estado de la aplicación
        appState.clusters.length = 0;
        appState.nodes.length = 0;
        appState.services.length = 0;
        appState.currentRequests = 0;

        // Limpiar networking
        NetworkingManager.loadBalancers.length = 0;
        NetworkingManager.services.length = 0;
        NetworkingManager.networkPolicies.length = 0;
        NetworkingManager.ingresses.length = 0;
    },

    updateAllViews() {
        // Actualizar todas las vistas
        ClusterManager.updateList();
        NodeManager.updateList();
        ServiceManager.updateList();
        NetworkingManager.updateLoadBalancersList();
        NetworkingManager.updateNetworkServicesList();
        NetworkingManager.updateNetworkPoliciesList();
        NetworkingManager.updateIngressesList();
        UI.updateSelectOptions();
        MonitoringManager.updateMetrics();
    },

    // Gestión del índice de configuraciones
    getConfigurationIndex() {
        try {
            const index = localStorage.getItem('k8s-configurations-index');
            return index ? JSON.parse(index) : [];
        } catch (error) {
            console.warn('Error cargando índice de configuraciones:', error);
            return [];
        }
    },

    updateConfigurationIndex(configName) {
        try {
            const index = this.getConfigurationIndex();
            if (!index.includes(configName)) {
                index.push(configName);
                localStorage.setItem('k8s-configurations-index', JSON.stringify(index));
            }
        } catch (error) {
            console.error('Error actualizando índice:', error);
        }
    },

    removeFromConfigurationIndex(configName) {
        try {
            const index = this.getConfigurationIndex();
            const newIndex = index.filter(name => name !== configName);
            localStorage.setItem('k8s-configurations-index', JSON.stringify(newIndex));
        } catch (error) {
            console.error('Error actualizando índice:', error);
        }
    },

    // Formularios
    clearSaveForm() {
        document.getElementById('configName').value = '';
        document.getElementById('configDescription').value = '';
    },

    openLoadModal() {
        document.getElementById('loadConfigModal').style.display = 'block';
        this.updateConfigurationsList();
    },

    closeLoadModal() {
        document.getElementById('loadConfigModal').style.display = 'none';
    },

    // Obtener estadísticas de almacenamiento
    getStorageStats() {
        try {
            const configs = this.getStoredConfigurations();
            let totalSize = 0;
            
            configs.forEach(config => {
                const configData = JSON.stringify(config);
                totalSize += new Blob([configData]).size;
            });

            return {
                totalConfigurations: configs.length,
                totalSize: this.formatBytes(totalSize),
                storageUsed: this.getStorageUsage()
            };
        } catch (error) {
            console.error('Error calculando estadísticas:', error);
            return {
                totalConfigurations: 0,
                totalSize: '0 bytes',
                storageUsed: 'Error calculando'
            };
        }
    },

    formatBytes(bytes) {
        if (bytes === 0) return '0 bytes';
        const k = 1024;
        const sizes = ['bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    getStorageUsage() {
        try {
            // Intentar estimar el uso de localStorage
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key) && key.startsWith('k8s-')) {
                    totalSize += localStorage[key].length;
                }
            }
            return this.formatBytes(totalSize);
        } catch (error) {
            return 'No disponible';
        }
    }
};

// Exportar para uso global
window.ConfigurationsManager = ConfigurationsManager;

} // Fin de protección contra múltiples cargas
