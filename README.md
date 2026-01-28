# UTPay - Ecosistema de Economía Digital Universitaria �

UTPay es una plataforma de pagos y servicios diseñada específicamente para la comunidad de la **Universidad Tecnológica de Panamá (UTP)**. El proyecto busca democratizar el acceso a servicios financieros internos, permitiendo a estudiantes, profesores y comercios universitarios interactuar mediante una moneda digital propia: el **UTP Coin**.

---

## 📚 Visión Académica y Objetivos

Este proyecto nace como una investigación sobre la viabilidad de **economías digitales cerradas** en entornos académicos. Representa un caso de estudio para:
- **Validación de Sistemas de Ledger Centralizados**: Implementación de libros contables digitales con transacciones ACID para garantizar la integridad del dinero.
- **Transición a Tecnologías Web3**: Roadmap diseñado para evolucionar de una base de datos centralizada (MVP) hacia una red descentralizada (Blockchain) mediante tokenización.
- **Inclusión Financiera Universitaria**: Facilitar transacciones rápidas para servicios cotidianos (cafetería, copias, tutorías).

### Objetivos Principales:
1. **Facilitar el Intercambio de Valor**: Permitir pagos instantáneos mediante códigos QR.
2. **Impulsar el Emprendimiento Estudiantil**: Marketplace integrado para la venta de artículos y servicios (tutorías, manuales, etc.).
3. **Optimizar Tiempos de Espera**: Reducir el uso de efectivo en puntos críticos como la cafetería y librería.

---

## 🛠️ Arquitectura Técnica (MVP)

Para garantizar velocidad y escalabilidad en la fase inicial, se ha optado por un enfoque de **Backend Centralizado**:

- **Frontend**: [Expo](https://expo.dev) (React Native + Web) para una experiencia multiplataforma real.
- **Backend**: Node.js con [Hono API](https://hono.dev), desplegado en **Cloudflare Workers** para una arquitectura serverless global.
- **Base de Datos Edge**: **Cloudflare D1**. Se utiliza SQLite distribuido en el borde (Edge Computing), lo que permite que los datos estén físicamente cerca del usuario, reduciendo la latencia a milisegundos y eliminando la necesidad de servidores de base de datos tradicionales.
- **ORM**: [Drizzle ORM](https://orm.drizzle.team) para un tipado estricto y consultas SQL ultra-rápidas.
- **Hosting e Infraestructura**: Todo el ecosistema (Frontend, Backend y DB) reside en la red global de **Cloudflare** (Pages, Workers y D1), garantizando una disponibilidad del 99.9% y escalabilidad automática sin intervención manual.
- **Seguridad**: Autenticación basada en JWT vinculada potencialmente al correo institucional.

---

## 🚀 Funcionalidades Clave

1. **Pagos QR**: Sistema de escaneo para pagos rápidos en comercios y entre usuarios.
2. **Marketplace de Tareas**: Tablero donde los estudiantes pueden ofrecer o solicitar servicios (tutorías, mandados, etc.) con pagos protegidos por Escrow.
3. **Sistema de Faucet e Incentivos**:
   - Bono de registro para nuevos usuarios.
   - Recompensas por visualización de avisos universitarios.
   - Pasarela de recarga mediante Yappy (Simulado con validación de administrador).

4. **Identidad y Reputación (Próximamente)**:
   - **Sistema de Reseñas**: Valoración de servicios y usuarios basada en el historial inmutable de tareas.
   - **Perfiles Públicos**: Portafolio de servicios y métricas de confianza.
   - **Roles Dinámicos**: Verificación automática para estudiantes (correo UTP) y validación administrativa para profesores y externos.

---

## 🗺️ Roadmap de Evolución

- [x] **Fase 1: MVP Centralizado** (Estado Actual) - Lógica de base de datos robusta y despliegue en Cloudflare.
- [ ] **Fase 2: Identidad y Confianza** - Implementación de reseñas, perfiles públicos y onboarding abierto con verificación KYC para externos.
- [ ] **Fase 3: Branding y Expansión** - Diseño de símbolo único para UTP Coin (eliminando el uso de $) y expansión a comercios físicos.
- [ ] **Fase 4: Descentralización (PoA)** - Migración a una red blockchain privada basada en **Hyperledger Besu** con consenso PoA (IBFT 2.0). Ver [Plan de Blockchain](BLOCKCHAIN.md).
- [ ] **Fase 5: Gobernanza** - Sistema de votación para decisiones universitarias basado en el uso de la moneda.

---

## 📓 Bitácora de Desarrollo

### Día 4 (27 de Enero, 2026)
*   **Estandarización UI/UX (Tareas)**: Se finalizó el proceso de migración terminológica de "Misiones" a "Tareas" en toda la plataforma (navegación, base de datos y UI), mejorando la claridad para el usuario estudiantil.
*   **Refinamiento del Ciclo de Vida**: Optimización del flujo de trabajo de tareas (Postular -> Escoger -> Terminar -> Finalizar). Se implementó la lógica de persistencia de datos para asegurar que las tareas con interacciones se mantengan en el historial para auditoría, mientras que las vacías se eliminan para mantener la base de datos limpia.
*   **Seguridad en el Flujo de Pagos**: Implementación de verificaciones de propiedad y estado en los endpoints de la API para prevenir manipulaciones en el proceso de aceptación y finalización de trabajos.
*   **Integración de UTP Coin en Tareas**: Se automatizaron los pagos mediante el Smart Contract (burn al crear, mint al completar), asegurando la integridad de la economía digital.
*   **Sistema de Reputación y Reseñas**: Implementación de un sistema de confianza donde los usuarios pueden calificar y reseñar, impactando directamente en el `statHonor` y el `creditScore`.
*   **Mejoras en el Descubrimiento**: Rediseño de la interfaz de tareas con filtros por categorías, búsqueda en tiempo real y organización por pestañas.
*   **Sistema RPG de Estadísticas**: Evolución del perfil de usuario hacia un modelo RPG. Se integraron visualmente las estadísticas de mérito (Intelecto, Fortaleza, Estrategia, Zen, Servicio y Honor) vinculadas a la actividad real del estudiante y su reputación en el sistema de tareas.
*   **Micro-créditos por Mérito**: Implementación del sistema de préstamos basado en el `creditScore`. Los estudiantes con alto desempeño (Score > 80) ahora pueden solicitar micro-créditos en UTP Coin directamente desde la app, con desembolso automático mediante Smart Contracts.

### Día 3 (26 de Enero, 2026)
*   **Adopción de Sirato (Chainlens Free)**: Se integró Sirato como el explorador de bloques principal para la red Hyperledger Besu, sustituyendo/complementando a Blockscout. Esto proporciona una interfaz más moderna y transparente para la auditoría de transacciones, bloques y contratos inteligentes, esencial para la transparencia de la tesis.
*   **Orquestación con Docker Compose**: Configuración completa de los servicios de Sirato (API, Web Frontend, Ingestion Engine y MongoDB) dentro de la red `utpay_net`. Se optimizó el consumo de recursos y la comunicación entre contenedores mediante una arquitectura de microservicios robusta.
*   **Resolución de Conflictos de Red**: Implementación de un proxy inverso con **Nginx** para gestionar el tráfico hacia Sirato en el puerto **4000**, mientras que Blockscout fue remapeado al puerto **4001**. Esto asegura que ambos exploradores coexistan sin conflictos de puertos locales.
*   **Optimización de Conectividad Redis**: Corrección de errores críticos de conexión en `sirato-api` mediante la inyección de variables de entorno multiversión (`SPRING_REDIS_HOST`, `REDIS_HOST`), asegurando una persistencia de datos y caché eficiente.
*   **Sincronización de Datos en Tiempo Real**: Verificación de la ingesta de datos desde los nodos de Besu (node1), logrando una sincronización completa del historial de la red y permitiendo la visualización inmediata de la actividad del UTP Coin.
*   **Health Checks y Diagnóstico**: Implementación de endpoints de salud y monitoreo para todos los servicios de infraestructura, garantizando una disponibilidad del 100% durante las pruebas de estrés de la red.
*   **Gestión de Suministro (Mint & Burn)**: Implementación de funciones de acuñación (`mint`) y quema (`burn`) en el contrato inteligente del UTP Coin. Esto permite un control dinámico sobre el suministro total de la moneda, facilitando la simulación de políticas monetarias universitarias y la gestión de incentivos para estudiantes.

### Día 2 (25 de Enero, 2026)
*   **Transición a Billetera No Custodia**: Se eliminó el almacenamiento de llaves privadas y frases semilla en el servidor. Ahora, las llaves se generan localmente y se almacenan de forma segura en el dispositivo del usuario mediante `Expo SecureStore`, garantizando que solo el usuario tenga control total sobre sus fondos ("Real BTC Experience").
*   **Seguridad Híbrida y Recuperación**: Implementación de un sistema de recuperación basado en frases semilla (12 palabras). Se añadió un flujo de importación manual y alertas visuales dinámicas para indicar si la billetera está correctamente vinculada y lista para firmar transacciones.
*   **Libreta de Contactos Inteligente**: Creación de una tabla de contactos en la base de datos y endpoints dedicados para gestionar una agenda personal. Esto permite enviar dinero sin necesidad de copiar y pegar direcciones de blockchain manualmente.
*   **Flujo "Todo en 1" con QR**: Rediseño del escáner de códigos QR para ser contextual. Al escanear una dirección, el sistema identifica automáticamente al usuario y ofrece opciones rápidas para "Enviar Dinero" o "Guardar en Contactos" en un solo paso.
*   **Sincronización Blockchain**: Integración de saldos en tiempo real consultando directamente a la red blockchain (Ethers.js), eliminando la dependencia de saldos centralizados y permitiendo que todos los usuarios inicien con un balance real de 0.0 UTP.
*   **Mejoras de UX/UI**: Corrección de errores en las descripciones del historial de transacciones, implementación de retroalimentación háptica (Haptics) y adición de indicadores de estado de conexión con el backend.

### Día 1 (24 de Enero, 2026)
*   **Sistema de Pagos QR e Identidad**: Se implementó la generación de códigos QR únicos para cada usuario y la capacidad de realizar pagos escaneando dichos códigos o ingresando manualmente el **UTP ID**.
*   **Integridad Financiera (Batching)**: Implementación de `db.batch` en el backend para asegurar que todas las transferencias sean atómicas: se descuenta al emisor, se acredita al receptor y se registra en el historial en una sola operación indivisible.
*   **Historial de Actividad**: Creación de un sistema de historial de transacciones detallado, visible tanto en el panel principal como en una vista exploradora dedicada.
*   **Gestión de Tareas (Escrow)**: Se implementó la lógica para manejar tareas, incluyendo la eliminación de tareas finalizadas y el sistema de "pagos protegidos".
*   **Sistema de Postulaciones**: Actualización del motor de búsqueda de tareas para mostrar el estado de postulación del usuario (`hasApplied`) y su oferta actual (`myBid`), permitiendo re-ofertas.
*   **Estandarización UI**: Cambio global del término "Misión" a "Tarea" para una mejor comprensión del usuario y optimización de componentes visuales con truncado de texto inteligente (`ellipsizeMode`).

---

## 🎓 Potencial para Tesis / Paper Científico

Este proyecto está estructurado para servir como base de investigación en diversas áreas:
1.  **Ingeniería de Software**: Análisis de rendimiento de bases de datos SQL en el borde (D1) vs. bases de datos tradicionales.
2.  **Economía Digital**: Impacto de una moneda interna en la velocidad del dinero dentro de una micro-economía cerrada.
3.  **Ciberseguridad**: Implementación de protocolos de confianza cero (Zero Trust) y validación de identidad KYC en entornos académicos.
4.  **UX/UI**: Estudio sobre la adopción de billeteras digitales en usuarios jóvenes (Gen Z) en Panamá.

---

## 🛠️ Cómo empezar

1. Clonar el repositorio.
2. Instalar dependencias: `npm install`.
3. Configurar variables de entorno en `/apps/api/.env`.
4. Iniciar servidor: `npm run api`.
5. Iniciar App: `npm run mobile`.

---
*Desarrollado con ❤️ para la comunidad de la UTP.*