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