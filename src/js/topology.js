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
        trafficParticles: [], // Nuevas partículas de tráfico
        particleAnimationFrame: null, // Frame de animación para partículas
        particleContainer: null, // Contenedor de partículas
        realTimeUpdateTimer: null, // Timer para actualizaciones en tiempo real

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

            // Crear contenedor de partículas
            this.particleContainer = this.svg.append('g')
                .attr('class', 'particles-layer');

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

            // 4. Workers → Pods (TODOS los pods del servicio)
            appState.services.forEach(service => {
                const serviceWorkers = appState.nodes.filter(n => n.clusterId === service.clusterId);

                // 🆕 ARREGLO: Crear enlace para cada pod individual
                for (let i = 0; i < service.currentReplicas; i++) {
                    const podNode = nodeMap.get(`pod-${service.id}-${i}`);
                    if (podNode && serviceWorkers.length > 0) {
                        // Determinar en qué worker está este pod
                        const workerIndex = i % serviceWorkers.length;
                        const worker = serviceWorkers[workerIndex];
                        const workerNode = nodeMap.get(`worker-${worker.id}`);

                        if (workerNode) {
                            links.push({
                                source: workerNode.id,
                                target: podNode.id,
                                type: 'worker-to-pod',
                                serviceId: service.id, // 🆕 NUEVO: Identificar a qué servicio pertenece
                                podIndex: i // 🆕 NUEVO: Índice del pod
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

            // 🆕 NUEVO: Programar próxima actualización si hay test activo
            if (appState.isTestRunning) {
                this.scheduleRealTimeUpdate();
            }
        },

        // 🆕 NUEVO: Programar actualización en tiempo real
        scheduleRealTimeUpdate() {
            // Actualizar cada 3 segundos durante testing
            if (this.realTimeUpdateTimer) {
                clearTimeout(this.realTimeUpdateTimer);
            }
            
            this.realTimeUpdateTimer = setTimeout(() => {
                if (appState.isTestRunning) {
                    this.updateTopologyRealTime();
                }
            }, 3000);
        },

        // 🆕 NUEVO: Actualización en tiempo real sin restart completo
        updateTopologyRealTime() {
            if (!this.isInitialized) return;

            const { nodes, links } = this.buildTopology();
            
            // Detectar cambios en pods
            const oldPodCount = this.nodes.filter(n => n.type === 'pod').length;
            const newPodCount = nodes.filter(n => n.type === 'pod').length;
            
            if (oldPodCount !== newPodCount) {
                console.log(`Pods changed: ${oldPodCount} -> ${newPodCount}`);
                
                // Actualizar datos
                this.nodes = nodes;
                this.links = links;
                
                // Re-renderizar con animación suave
                this.renderTopologySmooth();
            }
            
            // Programar siguiente actualización
            if (appState.isTestRunning) {
                this.scheduleRealTimeUpdate();
            }
        },

        // 🆕 NUEVO: Renderizado suave para cambios en tiempo real
        renderTopologySmooth() {
            // Actualizar nodos existentes y agregar nuevos
            const nodeSelection = this.svg.selectAll('.node')
                .data(this.nodes, d => d.id);
                
            // Nodos que se van
            nodeSelection.exit()
                .transition()
                .duration(500)
                .attr('r', 0)
                .attr('opacity', 0)
                .remove();
                
            // Nodos nuevos
            const newNodes = nodeSelection.enter()
                .append('circle')
                .attr('class', 'node')
                .attr('r', 0)
                .attr('fill', d => this.getNodeFill(d.type))
                .attr('stroke', '#fff')
                .attr('stroke-width', 2)
                .style('cursor', 'pointer')
                .attr('cx', d => d.x || this.width / 2)
                .attr('cy', d => d.y || this.height / 2);
                
            // Animar entrada de nodos nuevos
            newNodes.transition()
                .duration(500)
                .attr('r', d => this.getNodeRadius(d.type));
                
            // Actualizar nodos existentes
            nodeSelection.merge(newNodes)
                .transition()
                .duration(300)
                .attr('r', d => this.getNodeRadius(d.type))
                .attr('fill', d => this.getNodeFill(d.type));
                
            // Actualizar etiquetas
            const labelSelection = this.svg.selectAll('.label')
                .data(this.nodes, d => d.id);
                
            labelSelection.exit()
                .transition()
                .duration(500)
                .attr('opacity', 0)
                .remove();
                
            const newLabels = labelSelection.enter()
                .append('text')
                .attr('class', 'label')
                .attr('text-anchor', 'middle')
                .attr('dy', d => this.getNodeRadius(d.type) + 15)
                .style('font-size', '10px')
                .style('font-weight', 'bold')
                .style('fill', '#333')
                .attr('opacity', 0)
                .text(d => this.getNodeLabel(d));
                
            newLabels.transition()
                .duration(500)
                .attr('opacity', 1);
                
            // Actualizar enlaces
            const linkSelection = this.svg.selectAll('.link')
                .data(this.links);
                
            linkSelection.exit()
                .transition()
                .duration(500)
                .attr('stroke-opacity', 0)
                .remove();
                
            const newLinks = linkSelection.enter()
                .append('line')
                .attr('class', 'link')
                .attr('stroke', d => this.getLinkColor(d.type))
                .attr('stroke-width', 2)
                .attr('stroke-opacity', 0)
                .attr('marker-end', 'url(#arrowhead)');
                
            newLinks.transition()
                .duration(500)
                .attr('stroke-opacity', 0.6);
                
            // Actualizar simulación
            this.simulation.nodes(this.nodes);
            this.simulation.force('link').links(this.links);
            this.simulation.alpha(0.3).restart();
            
            // Reagregar interactividad a nodos nuevos
            this.addInteractivity(newNodes, newLabels);
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

            // 🆕 NUEVO: Debugging - verificar caminos
            console.log(`🎯 Iniciando animación para ${testService.name}:`);
            console.log(`- Réplicas actuales: ${testService.currentReplicas}`);
            console.log(`- Caminos encontrados: ${trafficPaths.length}`);
            trafficPaths.forEach((path, i) => {
                console.log(`  Camino ${i + 1}:`, path.join(' → '));
            });

            if (trafficPaths.length === 0) {
                console.warn(`⚠️ No se encontraron caminos de tráfico para ${testService.name}`);
                return;
            }

            // Inicializar sistema de partículas
            this.startTrafficParticles(trafficPaths, requestsPerSecond);

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

            // 🆕 ARREGLO: Crear caminos para TODOS los pods del servicio
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

                // 🆕 ARREGLO: Encontrar el nodo donde está este pod específico
                const serviceWorkers = appState.nodes.filter(n => n.clusterId === service.clusterId);
                if (serviceWorkers.length > 0) {
                    const workerIndex = i % serviceWorkers.length;
                    const worker = serviceWorkers[workerIndex];
                    path.push(`worker-${worker.id}`);
                }

                // 🆕 ARREGLO: Ir directamente al pod específico
                path.push(`pod-${service.id}-${i}`);

                if (path.length > 1) {
                    paths.push(path);
                }
            }

            console.log(`📍 Caminos de tráfico para ${service.name}:`, paths);
            
            // 🆕 NUEVO: Verificar que todos los nodos del camino existen
            paths.forEach((path, index) => {
                const missingNodes = path.filter(nodeId => !this.nodes.find(n => n.id === nodeId));
                if (missingNodes.length > 0) {
                    console.warn(`⚠️ Camino ${index + 1} tiene nodos faltantes:`, missingNodes);
                }
            });
            
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

            // Limpiar partículas de tráfico
            this.stopTrafficParticles();

            // 🆕 NUEVO: Limpiar timer de actualización en tiempo real
            if (this.realTimeUpdateTimer) {
                clearTimeout(this.realTimeUpdateTimer);
                this.realTimeUpdateTimer = null;
            }

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
        },

        // ===== SISTEMA DE PARTÍCULAS DE TRÁFICO =====

        // Iniciar sistema de partículas de tráfico
        startTrafficParticles(trafficPaths, requestsPerSecond) {
            if (!this.particleContainer) return;

            this.stopTrafficParticles();
            this.trafficParticles = [];

            // Crear partículas para cada camino de tráfico
            trafficPaths.forEach((path, pathIndex) => {
                this.createParticlesForPath(path, requestsPerSecond, pathIndex);
            });

            // Iniciar loop de animación
            this.startParticleAnimation();
        },

        // Crear partículas para un camino específico
        createParticlesForPath(path, requestsPerSecond, pathIndex) {
            if (path.length < 2) return;

            // ARREGLO: Limitar frecuencia mínima y máxima para evitar sobrecarga
            const particleFrequency = Math.max(200, Math.min(2000, 3000 / requestsPerSecond)); // Entre 200ms y 2000ms
            const pathColor = this.getPathColor(pathIndex);

            // ARREGLO: Limitar número máximo de partículas por camino
            let particlesInPath = 0;
            const maxParticlesPerPath = 5; // Máximo 5 partículas por camino

            // Crear generador de partículas para este camino
            const particleGenerator = setInterval(() => {
                if (!appState.isTestRunning) {
                    clearInterval(particleGenerator);
                    return;
                }

                // ARREGLO: No crear más partículas si ya hay muchas
                if (particlesInPath >= maxParticlesPerPath) {
                    return;
                }

                this.createSingleParticle(path, pathColor);
                particlesInPath++;

                // ARREGLO: Decrementar contador cuando la partícula termine
                setTimeout(() => {
                    particlesInPath = Math.max(0, particlesInPath - 1);
                }, path.length * 2000); // Tiempo estimado para completar el camino
            }, particleFrequency);

            this.trafficAnimations.push(particleGenerator);
        },

        // Crear una sola partícula
        createSingleParticle(path, color) {
            // ARREGLO: Verificar límite global de partículas antes de crear
            if (this.trafficParticles.length >= 50) {
                return; // No crear más partículas si ya hay muchas
            }

            const particle = {
                id: `particle-${Date.now()}-${Math.random()}`,
                path: path,
                currentSegment: 0,
                progress: 0,
                speed: 0.03 + Math.random() * 0.02, // ARREGLO: Velocidad más rápida para que se eliminen antes
                color: color,
                size: 3 + Math.random() * 2,
                opacity: 0.8 + Math.random() * 0.2,
                element: null,
                created: Date.now() // ARREGLO: Timestamp para control de vida
            };

            // ARREGLO: Verificar que el contenedor existe
            if (!this.particleContainer) {
                console.warn('Contenedor de partículas no disponible');
                return;
            }

            // Crear elemento SVG para la partícula
            particle.element = this.particleContainer
                .append('circle')
                .attr('class', 'traffic-particle')
                .attr('r', particle.size)
                .attr('fill', particle.color)
                .attr('opacity', particle.opacity)
                .style('filter', 'drop-shadow(0 0 3px rgba(255,255,255,0.8))');

            this.trafficParticles.push(particle);
        },

        // Loop principal de animación de partículas
        startParticleAnimation() {
            const animate = () => {
                if (!appState.isTestRunning) {
                    this.particleAnimationFrame = null;
                    return;
                }

                // ARREGLO: Limitar número total de partículas para evitar lag
                if (this.trafficParticles.length > 50) {
                    // Eliminar las partículas más antiguas
                    const particlesToRemove = this.trafficParticles.splice(0, this.trafficParticles.length - 50);
                    particlesToRemove.forEach(particle => {
                        if (particle.element) {
                            particle.element.remove();
                        }
                    });
                }

                this.updateParticles();
                this.particleAnimationFrame = requestAnimationFrame(animate);
            };

            if (!this.particleAnimationFrame) {
                this.particleAnimationFrame = requestAnimationFrame(animate);
            }
        },

        // Actualizar posición de todas las partículas
        updateParticles() {
            const now = Date.now();
            const maxLifetime = 10000; // ARREGLO: Máximo 10 segundos de vida por partícula

            this.trafficParticles = this.trafficParticles.filter(particle => {
                // ARREGLO: Eliminar partículas muy antiguas
                if (now - particle.created > maxLifetime) {
                    if (particle.element) {
                        particle.element.remove();
                    }
                    return false;
                }

                // Avanzar la partícula
                particle.progress += particle.speed;

                // Si la partícula completó el segmento actual
                if (particle.progress >= 1) {
                    particle.currentSegment++;
                    particle.progress = 0;

                    // Si completó todo el camino
                    if (particle.currentSegment >= particle.path.length - 1) {
                        if (particle.element) {
                            particle.element.remove();
                        }
                        return false; // Eliminar partícula
                    }
                }

                // Calcular posición actual
                const position = this.getParticlePosition(particle);
                if (position && particle.element) {
                    particle.element
                        .attr('cx', position.x)
                        .attr('cy', position.y);
                } else if (!position) {
                    // ARREGLO: Si no se puede calcular posición, eliminar partícula
                    if (particle.element) {
                        particle.element.remove();
                    }
                    return false;
                }

                return true; // Mantener partícula
            });
        },

        // Calcular posición de partícula en el camino
        getParticlePosition(particle) {
            const sourceNodeId = particle.path[particle.currentSegment];
            const targetNodeId = particle.path[particle.currentSegment + 1];

            const sourceNode = this.nodes.find(n => n.id === sourceNodeId);
            const targetNode = this.nodes.find(n => n.id === targetNodeId);

            if (!sourceNode || !targetNode) return null;

            // Interpolación lineal entre nodos
            const x = sourceNode.x + (targetNode.x - sourceNode.x) * particle.progress;
            const y = sourceNode.y + (targetNode.y - sourceNode.y) * particle.progress;

            return { x, y };
        },

        // Obtener color para camino de tráfico
        getPathColor(pathIndex) {
            const colors = [
                '#ff6b6b', // Rojo
                '#4ecdc4', // Turquesa
                '#45b7d1', // Azul
                '#f9ca24', // Amarillo
                '#f0932b', // Naranja
                '#eb4d4b', // Rojo oscuro
                '#6c5ce7', // Púrpura
                '#a29bfe', // Lavanda
                '#fd79a8', // Rosa
                '#00b894'  // Verde
            ];
            return colors[pathIndex % colors.length];
        },

        // Detener todas las partículas
        stopTrafficParticles() {
            // ARREGLO: Log para debugging
            if (this.trafficParticles.length > 0) {
                console.log(`Limpiando ${this.trafficParticles.length} partículas`);
            }

            // Cancelar frame de animación
            if (this.particleAnimationFrame) {
                cancelAnimationFrame(this.particleAnimationFrame);
                this.particleAnimationFrame = null;
            }

            // Eliminar todas las partículas del DOM
            this.trafficParticles.forEach(particle => {
                if (particle.element) {
                    try {
                        particle.element.remove();
                    } catch (e) {
                        console.warn('Error removiendo partícula:', e);
                    }
                }
            });

            this.trafficParticles = [];

            // Limpiar contenedor de partículas
            if (this.particleContainer) {
                try {
                    this.particleContainer.selectAll('.traffic-particle').remove();
                } catch (e) {
                    console.warn('Error limpiando contenedor:', e);
                }
            }

            // ARREGLO: Forzar garbage collection
            setTimeout(() => {
                if (typeof window.gc === 'function') {
                    window.gc();
                }
            }, 100);
        },

        // Resaltar camino de servicio (funcionalidad existente mejorada)
        highlightServicePath(serviceId) {
            const service = appState.services.find(s => s.id === serviceId);
            if (!service) return;

            this.clearHighlight();

            const trafficPaths = this.findTrafficPaths(service);
            const pathNodes = new Set();
            const pathLinks = new Set();

            trafficPaths.forEach(path => {
                path.forEach(nodeId => pathNodes.add(nodeId));
                for (let i = 0; i < path.length - 1; i++) {
                    pathLinks.add(`${path[i]}-${path[i + 1]}`);
                    pathLinks.add(`${path[i + 1]}-${path[i]}`);
                }
            });

            // Resaltar nodos
            this.svg.selectAll('.node')
                .transition()
                .duration(500)
                .attr('opacity', d => pathNodes.has(d.id) ? 1 : 0.3)
                .attr('stroke-width', d => pathNodes.has(d.id) ? 3 : 2);

            // Resaltar enlaces
            this.svg.selectAll('.link')
                .transition()
                .duration(500)
                .attr('opacity', d => {
                    const linkId1 = `${d.source.id}-${d.target.id}`;
                    const linkId2 = `${d.target.id}-${d.source.id}`;
                    return pathLinks.has(linkId1) || pathLinks.has(linkId2) ? 1 : 0.2;
                })
                .attr('stroke-width', d => {
                    const linkId1 = `${d.source.id}-${d.target.id}`;
                    const linkId2 = `${d.target.id}-${d.source.id}`;
                    return pathLinks.has(linkId1) || pathLinks.has(linkId2) ? 4 : 2;
                });

            // Resaltar etiquetas
            this.svg.selectAll('.label')
                .transition()
                .duration(500)
                .attr('opacity', d => pathNodes.has(d.id) ? 1 : 0.4);
        },

        // Limpiar resaltados
        clearHighlight() {
            this.svg.selectAll('.node')
                .transition()
                .duration(500)
                .attr('opacity', 1)
                .attr('stroke-width', 2);

            this.svg.selectAll('.link')
                .transition()
                .duration(500)
                .attr('opacity', 0.6)
                .attr('stroke-width', 2);

            this.svg.selectAll('.label')
                .transition()
                .duration(500)
                .attr('opacity', 1);
        },

        // ===== MÉTODOS DE DEBUGGING Y RENDIMIENTO =====

        // Obtener estadísticas de rendimiento
        getPerformanceStats() {
            return {
                totalParticles: this.trafficParticles.length,
                animationRunning: !!this.particleAnimationFrame,
                activeGenerators: this.trafficAnimations.length,
                isTestRunning: appState.isTestRunning,
                containerExists: !!this.particleContainer,
                svgExists: !!this.svg
            };
        },

        // Limpiar todo forzadamente (para debugging)
        emergencyCleanup() {
            console.warn('EMERGENCY CLEANUP: Limpiando todas las animaciones');
            
            // Detener todas las animaciones
            this.stopTrafficParticles();
            
            // Limpiar intervalos
            this.trafficAnimations.forEach(interval => {
                try {
                    clearInterval(interval);
                } catch (e) {
                    console.warn('Error clearing interval:', e);
                }
            });
            this.trafficAnimations = [];
            
            // Resetear estado
            appState.isTestRunning = false;
            appState.currentRequests = 0;
            
            // Forzar limpieza del DOM
            if (this.particleContainer) {
                try {
                    this.particleContainer.selectAll('*').remove();
                } catch (e) {
                    console.warn('Error in emergency DOM cleanup:', e);
                }
            }
            
            console.log('Emergency cleanup completed');
        },

        // Monitor de rendimiento (llamar periódicamente durante debug)
        logPerformanceStats() {
            const stats = this.getPerformanceStats();
            console.log('Performance Stats:', stats);
            
            if (stats.totalParticles > 30) {
                console.warn(`ADVERTENCIA: Muchas partículas activas (${stats.totalParticles}). Considerá reducir RPS.`);
            }
            
            return stats;
        }
    };

    // Exportar para uso global
    window.TopologyManager = TopologyManager;

} // Fin de protección contra múltiples cargas