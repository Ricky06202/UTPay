# Guía de Reinicio Total - Ecosistema UTPay

Esta guía explica cómo resetear todo el entorno (Blockchain + Contrato + Base de Datos) para empezar de cero con el sistema de Mérito y Crédito.

## 1. Reiniciar Blockchain y Desplegar Contrato
Desde la carpeta raíz del proyecto o la carpeta `blockchain`, ejecuta:

```bash
cd blockchain
npm run reset
```

Este comando hará lo siguiente:
1. `docker-compose down -v`: Borra todos los contenedores y los datos de la red Besu (limpia la blockchain).
2. `docker-compose up -d`: Levanta la red Besu limpia.
3. Espera 10 segundos a que los nodos sincronicen.
4. `npm run compile`: Compila el contrato `UTPay.sol` con las funciones de Mérito y Crédito.
5. `npm run deploy`: Despliega el contrato, registra al admin, transfiere la propiedad e inyecta $10.00 iniciales al fondo social.

## 2. Actualizar Base de Datos D1
Una vez que el contrato esté desplegado, debes sincronizar la base de datos de Cloudflare con el nuevo esquema de mérito:

```bash
cd apps/api
npm run db:push
```

## 3. Verificar Explorador (Blockscout)
Si la blockchain cambió, Blockscout detectará los nuevos bloques automáticamente. Puedes acceder en:
- **Blockscout**: http://localhost:4000

*Nota: La primera vez que inicies después de un reset, Blockscout puede tardar unos segundos en re-indexar los nuevos bloques.*

Asegúrate de que el contrato desplegado coincida con la dirección en `apps/api/src/utils/blockchain.ts`.

---
**Nota:** El sistema de mérito requiere que los estudiantes tengan un Score > 80 para pedir préstamos. Puedes usar el endpoint `POST /users/update-merit` para simular el progreso del estudiante.
