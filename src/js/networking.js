if (typeof window.NetworkingManager === 'undefined') {

    const NetworkingManager = {
        // Estado del networking
        loadBalancers: [],
        services: [],
        networkPolicies: [],
        ingresses: [],

        // Crear Load Balancer
        createLoadBalancer() {
            const name = document.getElementById('lbName').value.trim();
            const serviceSelect = document.getElementById('lbService');
            const serviceId = serviceSelect.value;
            const type = document.getElementById('lbType').value;
            const port = parseInt(document.getElementById('lbPort').value);
            const targetPort = parseInt(document.getElementById('lbTargetPort').value);

            // Validaciones
            if (!name) {
                alert('Por favor ingresa un nombre para el Load Balancer');
                return;
            }

            if (!serviceId) {
                alert('Por favor selecciona un servicio');
                return;
            }

            if (!Utils.validateResourceName(name.toLowerCase())) {
                alert('El nombre del Load Balancer solo puede contener letras minúsculas, números y guiones');
                return;
            }

            // Verificar duplicados
            if (this.loadBalancers.some(lb => lb.name === name)) {
                alert('Ya existe un Load Balancer con ese nombre');
                return;
            }

            const service = appState.services.find(s => s.id === parseInt(serviceId));
            if (!service) {
                alert('Servicio no encontrado');
                return;
            }

            const loadBalancer = {
                id: Date.now(),
                name: name,
                serviceId: parseInt(serviceId),
                serviceName: service.name,
                clusterId: service.clusterId,
                type: type,
                port: port,
                targetPort: targetPort,
                status: 'active',
                externalIP: this.generateExternalIP(),
                trafficDistribution: 'round-robin',
                healthCheck: true,
                created: new Date()
            };

            this.loadBalancers.push(loadBalancer);
            this.updateLoadBalancersList();
            // Actualizar las listas de servicios relacionadas
            if (typeof ServiceManager !== 'undefined' && ServiceManager.updateList) {
                ServiceManager.updateList();
            }
            Logger.log(`Load Balancer '${name}' creado para servicio '${service.name}' (${type})`, 'SUCCESS');
            this.clearLoadBalancerForm();
        },

        // Generar IP externa simulada
        generateExternalIP() {
            const segments = [];
            for (let i = 0; i < 4; i++) {
                segments.push(Math.floor(Math.random() * 255) + 1);
            }
            return segments.join('.');
        },

        // Crear Service (ClusterIP, NodePort)
        createNetworkService() {
            const name = document.getElementById('netServiceName').value.trim();
            const serviceSelect = document.getElementById('netTargetService');
            const serviceId = serviceSelect.value;
            const type = document.getElementById('netServiceType').value;
            const port = parseInt(document.getElementById('netServicePort').value);
            const targetPort = parseInt(document.getElementById('netTargetPort').value);

            // Validaciones
            if (!name || !serviceId) {
                alert('Por favor completa todos los campos requeridos');
                return;
            }

            if (!Utils.validateResourceName(name.toLowerCase())) {
                alert('El nombre del servicio solo puede contener letras minúsculas, números y guiones');
                return;
            }

            const targetService = appState.services.find(s => s.id === parseInt(serviceId));
            if (!targetService) return;

            const networkService = {
                id: Date.now(),
                name: name,
                targetServiceId: parseInt(serviceId),
                targetServiceName: targetService.name,
                clusterId: targetService.clusterId,
                type: type,
                port: port,
                targetPort: targetPort,
                clusterIP: this.generateClusterIP(),
                nodePort: type === 'NodePort' ? Math.floor(Math.random() * 10000) + 30000 : null,
                status: 'active',
                endpoints: this.generateEndpoints(targetService),
                created: new Date()
            };

            this.services.push(networkService);
            this.updateNetworkServicesList();
            Logger.log(`Servicio de red '${name}' creado (${type})`, 'SUCCESS');
            this.clearNetworkServiceForm();
        },

        // Generar ClusterIP
        generateClusterIP() {
            return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
        },

        // Generar endpoints para un servicio
        generateEndpoints(service) {
            const endpoints = [];
            for (let i = 0; i < service.currentReplicas; i++) {
                endpoints.push({
                    ip: this.generateClusterIP(),
                    port: service.responseTime || 8080,
                    ready: Math.random() > 0.1 // 90% de probabilidad de estar ready
                });
            }
            return endpoints;
        },

        // Crear Network Policy
        createNetworkPolicy() {
            const name = document.getElementById('policyName').value.trim();
            const targetSelect = document.getElementById('policyTarget');
            const targetId = targetSelect.value;
            const action = document.getElementById('policyAction').value;
            const direction = document.getElementById('policyDirection').value;
            const cidr = document.getElementById('policyCIDR').value.trim();

            if (!name || !targetId) {
                alert('Por favor completa todos los campos requeridos');
                return;
            }

            const targetService = appState.services.find(s => s.id === parseInt(targetId));
            if (!targetService) return;

            const policy = {
                id: Date.now(),
                name: name,
                targetServiceId: parseInt(targetId),
                targetServiceName: targetService.name,
                clusterId: targetService.clusterId,
                action: action, // allow/deny
                direction: direction, // ingress/egress/both
                cidr: cidr || '0.0.0.0/0',
                status: 'active',
                rulesApplied: 0,
                created: new Date()
            };

            this.networkPolicies.push(policy);
            this.updateNetworkPoliciesList();
            Logger.log(`Network Policy '${name}' creada para '${targetService.name}' (${action}/${direction})`, 'SUCCESS');
            this.clearNetworkPolicyForm();
        },

        // Crear Ingress
        createIngress() {
            const name = document.getElementById('ingressName').value.trim();
            const host = document.getElementById('ingressHost').value.trim();
            const path = document.getElementById('ingressPath').value.trim() || '/';
            const serviceSelect = document.getElementById('ingressService');
            const serviceId = serviceSelect.value;
            const port = parseInt(document.getElementById('ingressPort').value);

            if (!name || !host || !serviceId) {
                alert('Por favor completa todos los campos requeridos');
                return;
            }

            const targetService = appState.services.find(s => s.id === parseInt(serviceId));
            if (!targetService) return;

            const ingress = {
                id: Date.now(),
                name: name,
                host: host,
                path: path,
                serviceId: parseInt(serviceId),
                serviceName: targetService.name,
                clusterId: targetService.clusterId,
                port: port,
                tlsEnabled: document.getElementById('ingressTLS').checked,
                status: 'active',
                ingressClass: 'nginx',
                externalIP: this.generateExternalIP(),
                created: new Date()
            };

            this.ingresses.push(ingress);
            this.updateIngressesList();
            Logger.log(`Ingress '${name}' creado para '${host}${path}' → '${targetService.name}'`, 'SUCCESS');
            this.clearIngressForm();
        },

        // Actualizar lista de Load Balancers
        updateLoadBalancersList() {
            const container = document.getElementById('loadBalancersList');

            if (this.loadBalancers.length === 0) {
                container.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;">⚖️</div>
                    <p>No hay Load Balancers configurados. Crea uno para balancear tráfico.</p>
                </div>
            `;
                return;
            }

            container.innerHTML = this.loadBalancers.map(lb => this.renderLoadBalancerItem(lb)).join('');
        },

        // Renderizar item de Load Balancer
        renderLoadBalancerItem(lb) {
            const service = appState.services.find(s => s.id === lb.serviceId);
            const cluster = appState.clusters.find(c => c.id === lb.clusterId);
            const uptime = ClusterManager.calculateUptime(lb.created);

            return `
            <div class="service-item">
                <div class="item-header">
                    <div class="item-title">⚖️ ${lb.name}</div>
                    <span class="item-status status-${lb.status}">${lb.status.toUpperCase()}</span>
                </div>
                <p><strong>Tipo:</strong> ${lb.type} | <strong>Servicio:</strong> ${lb.serviceName}</p>
                <p><strong>Cluster:</strong> ${cluster ? cluster.name : 'N/A'} | <strong>Uptime:</strong> ${uptime}</p>
                <p><strong>External IP:</strong> ${lb.externalIP}:${lb.port} → Pod Port ${lb.targetPort}</p>
                <p><strong>Distribución:</strong> ${lb.trafficDistribution} | <strong>Health Check:</strong> ${lb.healthCheck ? '✅' : '❌'}</p>
                
                <div style="margin: 10px 0;">
                    <label>Tráfico distribuido: ${service ? service.requests : 0} req/s</label>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(100, (service ? service.requests / 1000 : 0) * 100)}%"></div>
                    </div>
                </div>
                
                <div class="load-test-controls">
                    <button class="btn btn-secondary" onclick="NetworkingManager.showLoadBalancerDetails(${lb.id})">Detalles</button>
                    <button class="btn btn-secondary" onclick="NetworkingManager.testLoadBalancer(${lb.id})">Test Conectividad</button>
                    <button class="btn btn-danger" onclick="NetworkingManager.deleteLoadBalancer(${lb.id})">Eliminar</button>
                </div>
            </div>
        `;
        },

        // Actualizar lista de servicios de red
        updateNetworkServicesList() {
            const container = document.getElementById('networkServicesList');

            if (this.services.length === 0) {
                container.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;">🌐</div>
                    <p>No hay servicios de red configurados.</p>
                </div>
            `;
                return;
            }

            container.innerHTML = this.services.map(service => this.renderNetworkServiceItem(service)).join('');
        },

        // Renderizar servicio de red
        renderNetworkServiceItem(netService) {
            const targetService = appState.services.find(s => s.id === netService.targetServiceId);
            const cluster = appState.clusters.find(c => c.id === netService.clusterId);
            const readyEndpoints = netService.endpoints.filter(ep => ep.ready).length;

            return `
            <div class="service-item">
                <div class="item-header">
                    <div class="item-title">🌐 ${netService.name}</div>
                    <span class="item-status status-${netService.status}">${netService.type}</span>
                </div>
                <p><strong>Cluster IP:</strong> ${netService.clusterIP}:${netService.port}</p>
                <p><strong>Target:</strong> ${netService.targetServiceName}:${netService.targetPort}</p>
                ${netService.nodePort ? `<p><strong>NodePort:</strong> ${netService.nodePort}</p>` : ''}
                <p><strong>Endpoints:</strong> ${readyEndpoints}/${netService.endpoints.length} ready</p>
                
                <div class="load-test-controls">
                    <button class="btn btn-secondary" onclick="NetworkingManager.showServiceDetails(${netService.id})">Endpoints</button>
                    <button class="btn btn-danger" onclick="NetworkingManager.deleteNetworkService(${netService.id})">Eliminar</button>
                </div>
            </div>
        `;
        },

        // Actualizar lista de Network Policies
        updateNetworkPoliciesList() {
            const container = document.getElementById('networkPoliciesList');

            if (this.networkPolicies.length === 0) {
                container.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;">🔒</div>
                    <p>No hay políticas de red configuradas.</p>
                </div>
            `;
                return;
            }

            container.innerHTML = this.networkPolicies.map(policy => this.renderNetworkPolicyItem(policy)).join('');
        },

        // Renderizar Network Policy
        renderNetworkPolicyItem(policy) {
            const targetService = appState.services.find(s => s.id === policy.targetServiceId);
            const actionColor = policy.action === 'allow' ? '#28a745' : '#dc3545';

            return `
            <div class="service-item">
                <div class="item-header">
                    <div class="item-title">🔒 ${policy.name}</div>
                    <span class="item-status" style="background: ${actionColor}20; color: ${actionColor};">${policy.action.toUpperCase()}</span>
                </div>
                <p><strong>Target:</strong> ${policy.targetServiceName} | <strong>Direction:</strong> ${policy.direction}</p>
                <p><strong>CIDR:</strong> ${policy.cidr} | <strong>Rules Applied:</strong> ${policy.rulesApplied}</p>
                
                <div class="load-test-controls">
                    <button class="btn btn-secondary" onclick="NetworkingManager.togglePolicy(${policy.id})">
                        ${policy.status === 'active' ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                    <button class="btn btn-danger" onclick="NetworkingManager.deleteNetworkPolicy(${policy.id})">Eliminar</button>
                </div>
            </div>
        `;
        },

        // Actualizar lista de Ingresses
        updateIngressesList() {
            const container = document.getElementById('ingressesList');

            if (this.ingresses.length === 0) {
                container.innerHTML = `
                <div class="empty-state">
                    <div style="font-size: 4rem; margin-bottom: 20px; opacity: 0.3;">🌍</div>
                    <p>No hay Ingresses configurados.</p>
                </div>
            `;
                return;
            }

            container.innerHTML = this.ingresses.map(ingress => this.renderIngressItem(ingress)).join('');
        },

        // Renderizar Ingress
        renderIngressItem(ingress) {
            const targetService = appState.services.find(s => s.id === ingress.serviceId);
            const protocol = ingress.tlsEnabled ? 'https' : 'http';

            return `
            <div class="service-item">
                <div class="item-header">
                    <div class="item-title">🌍 ${ingress.name}</div>
                    <span class="item-status status-${ingress.status}">${ingress.status.toUpperCase()}</span>
                </div>
                <p><strong>URL:</strong> ${protocol}://${ingress.host}${ingress.path}</p>
                <p><strong>Service:</strong> ${ingress.serviceName}:${ingress.port}</p>
                <p><strong>External IP:</strong> ${ingress.externalIP} | <strong>TLS:</strong> ${ingress.tlsEnabled ? '✅' : '❌'}</p>
                <p><strong>Ingress Class:</strong> ${ingress.ingressClass}</p>
                
                <div class="load-test-controls">
                    <button class="btn btn-secondary" onclick="NetworkingManager.testIngress(${ingress.id})">Test URL</button>
                    <button class="btn btn-secondary" onclick="Utils.copyToClipboard('${protocol}://${ingress.host}${ingress.path}')">Copiar URL</button>
                    <button class="btn btn-danger" onclick="NetworkingManager.deleteIngress(${ingress.id})">Eliminar</button>
                </div>
            </div>
        `;
        },

        // Funciones de eliminación
        deleteLoadBalancer(id) {
            const lb = this.loadBalancers.find(item => item.id === id);
            if (lb && confirm(`¿Eliminar Load Balancer '${lb.name}'?`)) {
                this.loadBalancers = this.loadBalancers.filter(item => item.id !== id);
                this.updateLoadBalancersList();
                Logger.log(`Load Balancer '${lb.name}' eliminado`, 'WARNING');
            }
        },

        deleteNetworkService(id) {
            const service = this.services.find(item => item.id === id);
            if (service && confirm(`¿Eliminar servicio de red '${service.name}'?`)) {
                this.services = this.services.filter(item => item.id !== id);
                this.updateNetworkServicesList();
                Logger.log(`Servicio de red '${service.name}' eliminado`, 'WARNING');
            }
        },

        deleteNetworkPolicy(id) {
            const policy = this.networkPolicies.find(item => item.id === id);
            if (policy && confirm(`¿Eliminar política '${policy.name}'?`)) {
                this.networkPolicies = this.networkPolicies.filter(item => item.id !== id);
                this.updateNetworkPoliciesList();
                Logger.log(`Network Policy '${policy.name}' eliminada`, 'WARNING');
            }
        },

        deleteIngress(id) {
            const ingress = this.ingresses.find(item => item.id === id);
            if (ingress && confirm(`¿Eliminar Ingress '${ingress.name}'?`)) {
                this.ingresses = this.ingresses.filter(item => item.id !== id);
                this.updateIngressesList();
                Logger.log(`Ingress '${ingress.name}' eliminado`, 'WARNING');
            }
        },

        // Limpiar formularios
        clearLoadBalancerForm() {
            document.getElementById('lbName').value = '';
            document.getElementById('lbService').selectedIndex = 0;
            document.getElementById('lbType').selectedIndex = 0;
            document.getElementById('lbPort').value = '80';
            document.getElementById('lbTargetPort').value = '8080';
        },

        clearNetworkServiceForm() {
            document.getElementById('netServiceName').value = '';
            document.getElementById('netTargetService').selectedIndex = 0;
            document.getElementById('netServiceType').selectedIndex = 0;
            document.getElementById('netServicePort').value = '80';
            document.getElementById('netTargetPort').value = '8080';
        },

        clearNetworkPolicyForm() {
            document.getElementById('policyName').value = '';
            document.getElementById('policyTarget').selectedIndex = 0;
            document.getElementById('policyAction').selectedIndex = 0;
            document.getElementById('policyDirection').selectedIndex = 0;
            document.getElementById('policyCIDR').value = '';
        },

        clearIngressForm() {
            document.getElementById('ingressName').value = '';
            document.getElementById('ingressHost').value = '';
            document.getElementById('ingressPath').value = '/';
            document.getElementById('ingressService').selectedIndex = 0;
            document.getElementById('ingressPort').value = '80';
            document.getElementById('ingressTLS').checked = false;
        },

        // Actualizar selectores con servicios disponibles
        updateServiceSelectors() {
            const selectors = [
                'lbService', 'netTargetService', 'policyTarget', 'ingressService'
            ];

            const serviceOptions = appState.services.map(service => {
                const cluster = appState.clusters.find(c => c.id === service.clusterId);
                return `<option value="${service.id}">${service.name} (${cluster ? cluster.name : 'N/A'})</option>`;
            }).join('');

            selectors.forEach(selectorId => {
                const selector = document.getElementById(selectorId);
                if (selector) {
                    selector.innerHTML = '<option value="">Seleccionar servicio...</option>' + serviceOptions;
                }
            });
        },

        // Mostrar detalles de servicios de red
        showServiceDetails(id) {
            const netService = this.services.find(item => item.id === id);
            if (!netService) return;

            const targetService = appState.services.find(s => s.id === netService.targetServiceId);
            const cluster = appState.clusters.find(c => c.id === netService.clusterId);

            const details = `
Detalles del Servicio de Red: ${netService.name}
${'='.repeat(40)}

Configuración:
- Tipo: ${netService.type}
- Cluster IP: ${netService.clusterIP}
- Puerto: ${netService.port} → ${netService.targetPort}
- Estado: ${netService.status}

Servicio objetivo:
- Nombre: ${netService.targetServiceName}
- Cluster: ${cluster ? cluster.name : 'N/A'}

Endpoints:
${netService.endpoints.map(ep => `- ${ep.ip}:${ep.port} (${ep.ready ? 'Ready' : 'Not Ready'})`).join('\n')}
        `;

            alert(details);
        },

        // Funcionalidades adicionales
        showLoadBalancerDetails(id) {
            const lb = this.loadBalancers.find(item => item.id === id);
            if (!lb) return;

            const service = appState.services.find(s => s.id === lb.serviceId);
            const details = `
Detalles del Load Balancer: ${lb.name}
${'='.repeat(40)}

Configuración:
- Tipo: ${lb.type}
- Puerto externo: ${lb.port}
- Puerto destino: ${lb.targetPort}
- IP externa: ${lb.externalIP}

Servicio asociado:
- Nombre: ${lb.serviceName}
- Réplicas: ${service ? service.currentReplicas : 'N/A'}
- Requests/s: ${service ? service.requests : 0}

Balanceado de carga:
- Algoritmo: ${lb.trafficDistribution}
- Health checks: ${lb.healthCheck ? 'Habilitado' : 'Deshabilitado'}
- Estado: ${lb.status}
        `;
            alert(details);
        },

        testLoadBalancer(id) {
            const lb = this.loadBalancers.find(item => item.id === id);
            if (!lb) return;

            Logger.log(`Probando conectividad del Load Balancer '${lb.name}'...`, 'INFO');

            setTimeout(() => {
                const success = Math.random() > 0.1; // 90% éxito
                if (success) {
                    Logger.log(`✅ Load Balancer '${lb.name}' responde correctamente en ${lb.externalIP}:${lb.port}`, 'SUCCESS');
                } else {
                    Logger.log(`❌ Error de conectividad en Load Balancer '${lb.name}'`, 'ERROR');
                }
            }, 1000);
        },

        testIngress(id) {
            const ingress = this.ingresses.find(item => item.id === id);
            if (!ingress) return;

            const protocol = ingress.tlsEnabled ? 'https' : 'http';
            const url = `${protocol}://${ingress.host}${ingress.path}`;

            Logger.log(`Probando Ingress: ${url}...`, 'INFO');

            setTimeout(() => {
                const responseTime = Math.floor(Math.random() * 200) + 50;
                Logger.log(`✅ Ingress '${ingress.name}' responde en ${responseTime}ms`, 'SUCCESS');
            }, 1000);
        },

        togglePolicy(id) {
            const policy = this.networkPolicies.find(item => item.id === id);
            if (!policy) return;

            policy.status = policy.status === 'active' ? 'disabled' : 'active';
            this.updateNetworkPoliciesList();

            const action = policy.status === 'active' ? 'habilitada' : 'deshabilitada';
            Logger.log(`Network Policy '${policy.name}' ${action}`, 'INFO');
        }
    };

    // Exportar para uso global
    window.NetworkingManager = NetworkingManager;

} // Fin de protección contra múltiples cargas