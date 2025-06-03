# K8s Simulator - Plataforma Educativa

Un simulador interactivo de Kubernetes para aprender conceptos de orquestación de contenedores, infraestructura en la nube y DevOps.

## 🚀 Características

- **Gestión de Clusters**: Crear y administrar clusters de Kubernetes simulados
- **Administración de Nodos**: Agregar y configurar nodos worker con diferentes tipos de instancia
- **Despliegue de Servicios**: Simular despliegues de aplicaciones con auto-escalado
- **🌐 Networking Module (NUEVO)**: Configuración avanzada de Load Balancers, Network Policies, Ingress
- **Monitoreo en Tiempo Real**: Métricas de CPU, memoria y rendimiento
- **Pruebas de Carga**: Sistema de testing para evaluar el comportamiento bajo carga
- **Exportación YAML**: Generar configuraciones reales de Kubernetes

## 🌐 Nuevo Módulo de Networking

El módulo de Networking agrega funcionalidades avanzadas para simular aspectos de red de Kubernetes:

### Load Balancers
- **Tipos soportados**: LoadBalancer (Cloud), NodePort, ClusterIP
- **Configuración de puertos**: Puerto externo y puerto de destino
- **Distribución de tráfico**: Round-robin, health checks
- **IPs externas simuladas**: Generación automática de IPs públicas
- **Pruebas de conectividad**: Verificación de estado y latencia

### Network Services
- **ClusterIP**: Servicios internos del cluster
- **NodePort**: Exposición en puertos específicos de nodos
- **LoadBalancer**: Servicios con balanceadores de carga externos
- **Endpoints automáticos**: Generación de endpoints por réplica
- **DNS interno**: Resolución de nombres simulada

### Network Policies
- **Control de tráfico**: Políticas de Allow/Deny
- **Dirección de tráfico**: Ingress, Egress o ambos
- **Filtrado por CIDR**: Especificación de rangos de red
- **Aplicación por servicio**: Políticas específicas por aplicación
- **Toggle dinámico**: Habilitación/deshabilitación en tiempo real

### Ingress Controllers
- **Routing por host**: Configuración de dominios virtuales
- **Path-based routing**: Enrutamiento por rutas específicas
- **TLS/SSL**: Soporte para HTTPS simulado
- **Ingress Classes**: Nginx y otros controladores
- **Pruebas de URL**: Verificación de accesibilidad externa

## 📋 Modules Overview

### `state.js` - Gestión de Estado
- Estado global de la aplicación (`appState`)
- Configuraciones del sistema (`config`)
- Funciones de gestión de estado (`StateManager`)
- Cálculo de métricas agregadas

### `utils.js` - Utilidades
- Funciones de formateo y validación
- Sistema de logging (`Logger`)
- Utilidades para exportación/importación
- Generación de YAML para Kubernetes

### `clusters.js` - Gestión de Clusters
- Crear y eliminar clusters
- Validaciones y gestión de estado
- Exportación de configuraciones
- Cálculo de costos y métricas

### `nodes.js` - Gestión de Nodos
- Agregar y administrar nodos worker
- Monitoreo de recursos en tiempo real
- Simulación de fallos y recuperación
- Drenado de nodos

### `services.js` - Gestión de Servicios
- Despliegue de aplicaciones
- Auto-escalado horizontal
- Simulación de carga y errores
- Métricas de rendimiento

### `monitoring.js` - Monitoreo y Testing
- Sistema de métricas en tiempo real
- Pruebas de carga configurables
- Reportes automáticos de testing
- Interfaz de usuario unificada

## 🚀 Cómo Usar

### 📋 Versiones Disponibles

1. **`index.html`** - Versión original monolítica
   ```bash
   open index.html
   ```
   - ✅ Funcionalidad completa en un solo archivo
   - ❌ Difícil de mantener y extender

2. **`index-atomized.html`** - Versión modular básica
   ```bash
   open index-atomized.html
   ```
   - ✅ Código organizado en módulos
   - ✅ Fácil mantenimiento
   - ✅ Funcionalidad idéntica al original

3. **`index-extended.html`** - 🆕 Versión con Networking
   ```bash
   open index-extended.html
   ```
   - ✅ Todas las ventajas de la versión atomizada
   - ✅ Módulo completo de Networking
   - ✅ Funcionalidades avanzadas de red
   - 🎯 **RECOMENDADA para aprendizaje completo**

### 🎯 ¿Cuál Elegir?

- **Para estudiantes/aprendizaje**: `index-extended.html` (más completo)
- **Para desarrollo/modificación**: `index-atomized.html` (más simple de extender)
- **Para referencia**: `index.html` (versión original)

## 🛠️ Desarrollo y Extensión

### Agregar Nueva Funcionalidad

1. **Crear nuevo módulo** (ejemplo: `networking.js`):
```javascript
const NetworkingManager = {
    // Nueva funcionalidad aquí
};
window.NetworkingManager = NetworkingManager;
```

2. **Incluir en HTML**:
```html
<script src="src/js/networking.js"></script>
```

3. **Usar en otros módulos**:
```javascript
// Ahora disponible globalmente
NetworkingManager.nuevaFuncion();
```

### Modificar Estilos
- Editar `src/css/styles.css`
- Los cambios se reflejan automáticamente

### Agregar Configuraciones
- Extender el objeto `config` en `state.js`
- Usar en cualquier módulo: `config.nuevaConfiguracion`

## 🎯 Casos de Uso Educativos

### Para Estudiantes
- Aprender conceptos de Kubernetes sin complejidad
- Experimentar con auto-escalado y pruebas de carga
- Entender métricas y monitoreo

### Para Educadores
- Demostrar conceptos de orquestación
- Simular escenarios reales de producción
- Mostrar mejores prácticas de DevOps

### Para Desarrolladores
- Entender arquitecturas de microservicios
- Aprender sobre recursos y límites
- Practicar con configuraciones YAML

## 🔄 Migración del Código Original

Si tienes el código original y quieres migrar:

1. **Separar CSS**: Mover estilos a `src/css/styles.css`
2. **Modularizar JavaScript**: Dividir funcionalidades en archivos específicos
3. **Actualizar HTML**: Referenciar archivos externos
4. **Probar funcionalidad**: Verificar que todo funciona igual

## 🧪 Testing y QA

### Pruebas Manuales
- ✅ Crear clusters en diferentes regiones
- ✅ Agregar nodos con distintos tipos de instancia
- ✅ Desplegar servicios con auto-escalado
- ✅ Ejecutar pruebas de carga
- ✅ Verificar exportación YAML

### Validaciones Automáticas
- Nombres de recursos válidos
- Límites de réplicas respetados
- Capacidad de cluster disponible
- Configuraciones coherentes

## 📊 Métricas y Monitoreo

### Métricas Básicas
- Número de clusters activos
- Total de nodos en ejecución
- Pods desplegados
- Requests por segundo

### Métricas de Recursos
- Uso promedio de CPU
- Consumo de memoria
- Distribución de carga por nodo
- Estado de salud de servicios

### Métricas de Testing
- RPS durante pruebas de carga
- Tiempo de respuesta promedio
- Tasa de errores
- Escalado automático activado

## 🔧 Configuración Avanzada

### Personalizar Tipos de Instancia
Editar `config.nodeTypes` en `state.js`:
```javascript
nodeTypes: [
    { value: 'custom.large', label: 'Custom Large (8 vCPU, 32GB RAM)' },
    // Agregar más tipos...
]
```

### Nuevos Patrones de Carga
Extender `config.loadPatterns` y `TestingManager.calculateCurrentRPS()`:
```javascript
case 'custom-pattern':
    // Lógica personalizada
    return customCalculation(test);
```

### Personalizar Tecnologías
Modificar `config.technologies`:
```javascript
technologies: [
    { value: 'java', label: 'Java', icon: '☕' },
    { value: 'dotnet', label: '.NET', icon: '🔷' }
]
```

## 🚀 Funcionalidades Futuras

### Próximas Mejoras
- [+] Persistencia en localStorage
- [+] Importar/exportar configuraciones completas
- [+] Visualización de topología de red
- [ ] Simulación de fallos de infraestructura
- [ ] Integración con métricas reales (Prometheus)
- [ ] Plantillas predefinidas de despliegues
- [ ] Sistema de notificaciones y alertas
- [ ] Dashboard de costos detallado

### Extensiones Posibles
- **Networking**: Simular balanceadores de carga y redes
- **Storage**: Volúmenes persistentes y backups
- **Security**: RBAC y políticas de seguridad
- **CI/CD**: Pipeline de despliegue automatizado
- **Multi-cloud**: Soporte para diferentes proveedores

## 🐛 Troubleshooting

### Problemas Comunes

**Error: "No hay clusters creados"**
- Solución: Crear al menos un cluster antes de agregar nodos o servicios

**Pruebas de carga no funcionan**
- Verificar que hay servicios desplegados
- Confirmar que el cluster tiene nodos disponibles

**Métricas no se actualizan**
- Verificar la consola del navegador por errores
- Recargar la página si es necesario

**Auto-escalado no funciona**
- Verificar límites de réplicas mínimas/máximas
- Confirmar que hay capacidad en el cluster

### Debug Mode
Para activar logging detallado, abrir la consola del navegador:
```javascript
// Ver estado completo
console.log(appState);

// Ver logs del sistema
console.log(Logger.logs);

// Ver métricas actuales
console.log(StateManager.getTotals());
```

## 📝 Contribuir

### Estructura de Commits
```
type(scope): description

feat(clusters): add multi-region support
fix(nodes): resolve memory leak in metrics
docs(readme): update installation instructions
style(css): improve responsive design
```

### Pull Request Guidelines
1. Crear branch desde `main`
2. Implementar cambios en módulos apropiados
3. Probar funcionalidad completa
4. Actualizar documentación si es necesario
5. Crear PR con descripción detallada

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 🤝 Agradecimientos

- Inspirado en las mejores prácticas de Kubernetes
- Diseñado para facilitar el aprendizaje de DevOps
- Construido con tecnologías web estándar para máxima compatibilidad

---

**¡Disfruta aprendiendo Kubernetes de manera interactiva! 🚀**

Para preguntas o sugerencias, no dudes en abrir un issue o contribuir al proyecto.