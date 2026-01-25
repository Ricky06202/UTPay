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
- **Base de Datos**: **Cloudflare D1** (SQLite distribuido en el borde) gestionado con [Drizzle ORM](https://orm.drizzle.team). Esta elección tecnológica asegura baja latencia, alta disponibilidad y costos operativos mínimos.
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
- [ ] **Fase 4: Tokenización** - Migración a una red Layer 2 (Polygon o Solana) para convertir el UTP Coin en un activo digital real.
- [ ] **Fase 5: Gobernanza** - Sistema de votación para decisiones universitarias basado en el uso de la moneda.

---

## 📓 Bitácora de Desarrollo

### Día 1 (24 de Enero, 2026)
*   **Gestión de Tareas**: Se implementó la lógica para eliminar tareas finalizadas del historial sin afectar los pagos ya realizados.
*   **Sistema de Postulaciones**: Actualización del motor de búsqueda de tareas para mostrar el estado de postulación del usuario (`hasApplied`) y su oferta actual (`myBid`).
*   **Re-ofertas**: Se habilitó la posibilidad de modificar ofertas existentes en tareas abiertas.
*   **Estandarización UI**: Cambio global del término "Misión" a "Tarea" para una mejor comprensión del usuario panameño.
*   **Optimización de Diseño**: Ajuste de contenedores en "Actividad Reciente" con truncado de texto inteligente (`ellipsizeMode`) para evitar desbordamientos en pantallas pequeñas.
*   **Integridad de Datos**: Implementación de `db.batch` en el backend para asegurar que todas las transacciones financieras sean atómicas (si falla un paso, se revierte todo).

---

## 🛠️ Cómo empezar

1. Clonar el repositorio.
2. Instalar dependencias: `npm install`.
3. Configurar variables de entorno en `/apps/api/.env`.
4. Iniciar servidor: `npm run api`.
5. Iniciar App: `npm run mobile`.

---
*Desarrollado con ❤️ para la comunidad de la UTP.*