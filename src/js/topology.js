// K8s Simulator - Sistema de Topología Gráfica en Tiempo Real
// Protección contra múltiples cargas
if (typeof window.TopologyManager === 'undefined') {

const TopologyManager = {
    // Estado del gráfico
    svg: null,
    simulation: null,
    width: 800,
    height: 600,
    nodes: [],
    links: [],
    container: null,
    isInitialized: false,
    trafficAnimations: [],

    // Inicializar el gráfico de topología
    initialize() {
        if (this.isInitialized) return;

        // Buscar el contenedor
        this.container = document.getElementById('topology-container');
        if (!this.container) {
            console.warn('Contenedor de topología no encontrado');
            return;
        }

        // Limpiar contenedor
        this.container.innerHTML = '';

        // Crear SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .style('border', '1px solid #ddd')
            .style('border-radius', '8px')
            .style('background', 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)');

        // Agregar definiciones para gradientes y filtros
        this.createDefinitions();

        // Inicializar simulación de fuerza
        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(this.width / 2, this.height / 2))
            .force('collision', d3.forceCollide().radius(40));

        this.isInitialized = true;
        Logger.log('Sistema de topología gráfica inicializado', 'SUCCESS');
        
        // Actualizar inmediatamente
        this.updateTopology();
    },

    // Crear definiciones SVG para efectos visuales
    createDefinitions() {
        const defs = this.svg.append('defs');

        // Marcador para flechas
        defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '-0 -5 10 10')
            .attr('refX', 25)
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', 8)
            .attr('markerHeight', 8)
            .attr('xoverflow', 'visible')
            .append('svg:path')
            .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
            .attr('fill', '#667eea')
            .style('stroke', 'none');
    },

    // Construir topología de nodos y enlaces
    buildTopology() {
        const nodes = [];
        const links = [];
        const nodeMap = new Map();

        // 1. Agregar Load Balancers
        NetworkingManager.loadBalancers.forEach(lb => {
            const node = {
                id: `lb-${lb.id}`,
                type: 'loadbalancer',
                name: lb.name,
                data: lb,
                x: Math.random() * this.width,
                y: Math.random() * this.height
            };
            nodes.push(node);
            nodeMap.set(node.id, node);
        });

        // 2. Agregar Ingresses
        NetworkingManager.ingresses.forEach(ing => {
            const node = {
                id: `ingress-${ing.id}`,
                type: 'ingress',
                name: ing.name,
                data: ing,
                x: Math.random() * this.width,
                y: Math.random() * this.height
            };
            nodes.push(node);
            nodeMap.set(node.id, node);
        });

        // 3. Agregar Network Services
        NetworkingManager.services.forEach(ns => {
            const node = {
                id: `netservice-${ns.id}`,
                type: 'netservice',
                name: ns.name,
                data: ns,
                x: Math.random() * this.width,
                y: Math.random() * this.height
            };
            nodes.push(node);
            nodeMap.set(node.id, node);
        });

        // 4. Agregar Workers/Nodos de K8s
        appState.nodes.forEach(node => {
            const topologyNode = {
                id: `worker-${node.id}`,
                type: 'worker',
                name: node.name,
                data: node,
                x: Math.random() * this.width,
                y: Math.random() * this.height
            };
            nodes.push(topologyNode);
            nodeMap.set(topologyNode.id, topologyNode);
        });

        // 5. Agregar Pods (servicios desplegados)
        appState.services.forEach(service => {
            for (let i = 0; i < service.currentReplicas; i++) {
                const podNode = {
                    id: `pod-${service.id}-${i}`,
                    type: 'pod',
                    name: `${service.name}-${i}`,
                    data: service,
                    replicaIndex: i,
                    x: Math.random() * this.width,
                    y: Math.random() * this.height
                };
                nodes.push(podNode);
                nodeMap.set(podNode.id, podNode);
            }
        });

        // 6. Crear enlaces (conexiones entre nodos)
        this.createLinks(nodes, links, nodeMap);

        return { nodes, links };
    },

    // Crear enlaces entre nodos
    createLinks(nodes, links, nodeMap) {
        // 1. Ingress → Load Balancer o Service
        NetworkingManager.ingresses.forEach(ing => {
            const ingressNode = nodeMap.get(`ingress-${ing.id}`);
            
            const relatedLB = NetworkingManager.loadBalancers.find(lb => lb.serviceId === ing.serviceId);
            if (relatedLB) {
                const lbNode = nodeMap.get(`lb-${relatedLB.id}`);
                if (lbNode) {
                    links.push({
                        source: ingressNode.id,
                        target: lbNode.id,
                        type: 'ingress-to-lb'
                    });
                }
            }
        });

        // 2. Load Balancer → Network Services o Pods
        NetworkingManager.loadBalancers.forEach(lb => {
            const lbNode = nodeMap.get(`lb-${lb.id}`);
            
            const relatedNS = NetworkingManager.services.find(ns => ns.targetServiceId === lb.serviceId);
            if (relatedNS) {
                const nsNode = nodeMap.get(`netservice-${relatedNS.id}`);
                if (nsNode) {
                    links.push({
                        source: lbNode.id,
                        target: nsNode.id,
                        type: 'lb-to-service'
                    });
                }
            } else {
                const targetService = appState.services.find(s => s.id === lb.serviceId);
                if (targetService) {
                    for (let i = 0; i < targetService.currentReplicas; i++) {
                        const podNode = nodeMap.get(`pod-${targetService.id}-${i}`);
                        if (podNode) {
                            links.push({
                                source: lbNode.id,
                                target: podNode.id,
                                type: 'lb-to-pod'
                            });
                        }
                    }
                }
            }
        });

        // 3. Network Services → Workers
        NetworkingManager.services.forEach(ns => {
            const nsNode = nodeMap.get(`netservice-${ns.id}`);
            const targetService = appState.services.find(s => s.id === ns.targetServiceId);
            
            if (targetService) {
                const serviceWorkers = appState.nodes.filter(n => n.clusterId === targetService.clusterId);
                serviceWorkers.forEach(worker => {
                    const workerNode = nodeMap.get(`worker-${worker.id}`);
                    if (workerNode) {
                        links.push({
                            source: nsNode.id,
                            target: workerNode.id,
                            type: 'service-to-worker'
                        });
                    }
                });
            }
        });

        // 4. Workers → Pods
        appState.services.forEach(service => {
            const serviceWorkers = appState.nodes.filter(n => n.clusterId === service.clusterId);
            
            for (let i = 0; i < service.currentReplicas; i++) {
                const podNode = nodeMap.get(`pod-${service.id}-${i}`);
                if (podNode && serviceWorkers.length > 0) {
                    const workerIndex = i % serviceWorkers.length;
                    const worker = serviceWorkers[workerIndex];
                    const workerNode = nodeMap.get(`worker-${worker.id}`);
                    
                    if (workerNode) {
                        links.push({
                            source: workerNode.id,
                            target: podNode.id,
                            type: 'worker-to-pod'
                        });
                    }
                }
            }
        });
    },

    // Actualizar topología completa
    updateTopology() {
        if (!this.isInitialized) {
            this.initialize();
            return;
        }

        const { nodes, links } = this.buildTopology();
        this.nodes = nodes;
        this.links = links;

        this.renderTopology();
    },

    // Renderizar la topología
    renderTopology() {
        // Limpiar elementos existentes
        this.svg.selectAll('.link').remove();
        this.svg.selectAll('.node').remove();
        this.svg.selectAll('.label').remove();

        // Actualizar simulación
        this.simulation.nodes(this.nodes);
        this.simulation.force('link').links(this.links);

        // Crear enlaces
        const link = this.svg.selectAll('.link')
            .data(this.links)
            .enter()
            .append('line')
            .attr('class', 'link')
            .attr('stroke', d => this.getLinkColor(d.type))
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6)
            .attr('marker-end', 'url(#arrowhead)');

        // Crear nodos
        const node = this.svg.selectAll('.node')
            .data(this.nodes)
            .enter()
            .append('circle')
            .attr('class', 'node')
            .attr('r', d => this.getNodeRadius(d.type))
            .attr('fill', d => this.getNodeFill(d.type))
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer');

        // Agregar etiquetas
        const label = this.svg.selectAll('.label')
            .data(this.nodes)
            .enter()
            .append('text')
            .attr('class', 'label')
            .attr('text-anchor', 'middle')
            .attr('dy', d => this.getNodeRadius(d.type) + 15)
            .style('font-size', '10px')
            .style('font-weight', 'bold')
            .style('fill', '#333')
            .text(d => this.getNodeLabel(d));

        // Agregar interactividad
        this.addInteractivity(node, label);

        // Función de tick para la animación
        this.simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            label
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        this.simulation.alpha(1).restart();
    },

    // Obtener color del enlace según el tipo
    getLinkColor(type) {
        const colors = {
            'ingress-to-lb': '#667eea',
            'lb-to-service': '#f093fb',
            'lb-to-pod': '#f5576c',
            'service-to-worker': '#4facfe',
            'worker-to-pod': '#38f9d7',
            'direct-to-pod': '#888'
        };
        return colors[type] || '#888';
    },

    // Obtener radio del nodo según el tipo
    getNodeRadius(type) {
        const radii = {
            'loadbalancer': 25,
            'ingress': 20,
            'netservice': 18,
            'worker': 22,
            'pod': 15
        };
        return radii[type] || 15;
    },

    // Obtener relleno del nodo según el tipo
    getNodeFill(type) {
        const fills = {
            'loadbalancer': '#667eea',
            'ingress': '#ff6b6b',
            'netservice': '#43e97b',
            'worker': '#f093fb',
            'pod': '#4facfe'
        };
        return fills[type] || '#888';
    },

    // Obtener etiqueta del nodo
    getNodeLabel(node) {
        const maxLength = 10;
        let label = node.name;
        
        if (label.length > maxLength) {
            label = label.substring(0, maxLength - 3) + '...';
        }
        
        return label;
    },

    // Agregar interactividad
    addInteractivity(node, label) {
        // Drag & Drop
        const drag = d3.drag()
            .on('start', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });

        node.call(drag);

        // Hover effects
        node
            .on('mouseover', (event, d) => {
                d3.select(event.target)
                    .transition()
                    .duration(200)
                    .attr('r', this.getNodeRadius(d.type) * 1.2)
                    .attr('stroke-width', 3);
                
                this.showTooltip(event, d);
            })
            .on('mouseout', (event, d) => {
                d3.select(event.target)
                    .transition()
                    .duration(200)
                    .attr('r', this.getNodeRadius(d.type))
                    .attr('stroke-width', 2);
                
                this.hideTooltip();
            })
            .on('click', (event, d) => {
                this.showNodeDetails(d);
            });
    },

    // Mostrar tooltip
    showTooltip(event, d) {
        const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'topology-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(0,0,0,0.8)')
            .style('color', 'white')
            .style('padding', '8px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('z-index', 1000);

        const content = this.getTooltipContent(d);
        tooltip.html(content)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
    },

    // Ocultar tooltip
    hideTooltip() {
        d3.selectAll('.topology-tooltip').remove();
    },

    // Obtener contenido del tooltip
    getTooltipContent(d) {
        switch (d.type) {
            case 'loadbalancer':
                return `<strong>${d.name}</strong><br/>
                        Tipo: Load Balancer (${d.data.type})<br/>
                        Puerto: ${d.data.port}→${d.data.targetPort}<br/>
                        IP: ${d.data.externalIP}`;
                        
            case 'ingress':
                return `<strong>${d.name}</strong><br/>
                        Tipo: Ingress<br/>
                        Host: ${d.data.host}<br/>
                        TLS: ${d.data.tlsEnabled ? 'Sí' : 'No'}`;
                        
            case 'netservice':
                return `<strong>${d.name}</strong><br/>
                        Tipo: Network Service<br/>
                        Cluster IP: ${d.data.clusterIP}<br/>
                        Puerto: ${d.data.port}`;
                        
            case 'worker':
                return `<strong>${d.name}</strong><br/>
                        Tipo: Worker Node<br/>
                        CPU: ${d.data.cpuUsage?.toFixed(1)}%<br/>
                        RAM: ${d.data.memoryUsage?.toFixed(1)}%`;
                        
            case 'pod':
                return `<strong>${d.name}</strong><br/>
                        Tipo: Pod<br/>
                        Servicio: ${d.data.name}<br/>
                        Réplica: ${d.replicaIndex + 1}`;
                        
            default:
                return `<strong>${d.name}</strong><br/>Tipo: ${d.type}`;
        }
    },

    // Mostrar detalles del nodo
    showNodeDetails(d) {
        let details = '';
        
        switch (d.type) {
            case 'loadbalancer':
                details = `Load Balancer: ${d.name}\n\n` +
                         `Tipo: ${d.data.type}\n` +
                         `IP Externa: ${d.data.externalIP}\n` +
                         `Puerto: ${d.data.port} → ${d.data.targetPort}\n` +
                         `Estado: ${d.data.status}\n` +
                         `Servicio: ${d.data.serviceName}`;
                break;
                
            case 'worker':
                details = `Worker Node: ${d.name}\n\n` +
                         `Tipo: ${d.data.type}\n` +
                         `Zona: ${d.data.availabilityZone}\n` +
                         `CPU: ${d.data.cpuUsage?.toFixed(1)}%\n` +
                         `RAM: ${d.data.memoryUsage?.toFixed(1)}%`;
                break;
                
            case 'pod':
                details = `Pod: ${d.name}\n\n` +
                         `Servicio: ${d.data.name}\n` +
                         `Tecnología: ${d.data.tech}\n` +
                         `Réplica: ${d.replicaIndex + 1} de ${d.data.currentReplicas}`;
                break;
                
            default:
                details = `${d.type}: ${d.name}`;
        }
        
        alert(details);
    },

    // Simular tráfico durante stress test
    animateTrafficFlow(testService, requestsPerSecond) {
        if (!this.isInitialized || !testService) return;

        this.clearTrafficAnimations();
        const trafficPaths = this.findTrafficPaths(testService);
        
        trafficPaths.forEach((path, index) => {
            setTimeout(() => {
                this.animatePath(path, requestsPerSecond);
            }, index * 100);
        });
    },

    // Encontrar caminos de tráfico para un servicio
    findTrafficPaths(service) {
        const paths = [];
        
        const ingress = NetworkingManager.ingresses.find(ing => ing.serviceId === service.id);
        const loadBalancer = NetworkingManager.loadBalancers.find(lb => lb.serviceId === service.id);
        const networkService = NetworkingManager.services.find(ns => ns.targetServiceId === service.id);
        
        for (let i = 0; i < service.currentReplicas; i++) {
            const path = [];
            
            if (ingress) {
                path.push(`ingress-${ingress.id}`);
            }
            
            if (loadBalancer) {
                path.push(`lb-${loadBalancer.id}`);
            }
            
            if (networkService) {
                path.push(`netservice-${networkService.id}`);
            }
            
            const serviceWorkers = appState.nodes.filter(n => n.clusterId === service.clusterId);
            if (serviceWorkers.length > 0) {
                const workerIndex = i % serviceWorkers.length;
                const worker = serviceWorkers[workerIndex];
                path.push(`worker-${worker.id}`);
            }
            
            path.push(`pod-${service.id}-${i}`);
            
            if (path.length > 1) {
                paths.push(path);
            }
        }
        
        return paths;
    },

    // Animar un camino de tráfico
    animatePath(path, intensity) {
        if (path.length < 2) return;
        
        const frequency = Math.max(100, 2000 / intensity);
        
        const animateSegment = (fromIndex) => {
            if (fromIndex >= path.length - 1) return;
            
            const sourceId = path[fromIndex];
            const targetId = path[fromIndex + 1];
            
            const link = this.svg.selectAll('.link')
                .filter(d => 
                    (d.source.id === sourceId && d.target.id === targetId) ||
                    (d.source.id === targetId && d.target.id === sourceId)
                );
            
            if (!link.empty()) {
                link
                    .transition()
                    .duration(200)
                    .attr('stroke-width', 4)
                    .attr('stroke-opacity', 1)
                    .attr('stroke', '#ff6b6b')
                    .transition()
                    .duration(300)
                    .attr('stroke-width', 2)
                    .attr('stroke-opacity', 0.6)
                    .attr('stroke', d => this.getLinkColor(d.type));
                
                setTimeout(() => {
                    animateSegment(fromIndex + 1);
                }, 150);
            }
        };
        
        const pathInterval = setInterval(() => {
            if (!appState.isTestRunning) {
                clearInterval(pathInterval);
                return;
            }
            animateSegment(0);
        }, frequency);
        
        this.trafficAnimations.push(pathInterval);
    },

    // Limpiar animaciones de tráfico
    clearTrafficAnimations() {
        this.trafficAnimations.forEach(interval => {
            clearInterval(interval);
        });
        this.trafficAnimations = [];
        
        this.svg.selectAll('.link')
            .transition()
            .duration(500)
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6)
            .attr('stroke', d => this.getLinkColor(d.type));
    },

    // Actualizar métricas visuales en tiempo real
    updateVisualMetrics() {
        if (!this.isInitialized) return;
        
        this.svg.selectAll('.node')
            .transition()
            .duration(1000)
            .attr('r', d => {
                let baseRadius = this.getNodeRadius(d.type);
                
                if (d.type === 'worker' && d.data.cpuUsage) {
                    const scaleFactor = 1 + (d.data.cpuUsage / 100) * 0.5;
                    return baseRadius * scaleFactor;
                } else if (d.type === 'pod' && d.data.requests) {
                    const scaleFactor = 1 + Math.min(d.data.requests / 1000, 0.5);
                    return baseRadius * scaleFactor;
                }
                
                return baseRadius;
            });
    },

    // Obtener estadísticas de la topología
    getTopologyStats() {
        return {
            totalNodes: this.nodes.length,
            totalLinks: this.links.length,
            loadBalancers: this.nodes.filter(n => n.type === 'loadbalancer').length,
            ingresses: this.nodes.filter(n => n.type === 'ingress').length,
            networkServices: this.nodes.filter(n => n.type === 'netservice').length,
            workers: this.nodes.filter(n => n.type === 'worker').length,
            pods: this.nodes.filter(n => n.type === 'pod').length
        };
    }
};

// Exportar para uso global
window.TopologyManager = TopologyManager;

} // Fin de protección contra múltiples cargas