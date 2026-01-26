# 🛡️ UTPay Blockchain: Proof of Authority (PoA) con Hyperledger Besu

Este documento detalla la investigación y el plan técnico para migrar el backend de UTPay de una base de datos centralizada (Cloudflare D1) a una red blockchain privada permisionada.

---

## 1. ¿Qué es Proof of Authority (PoA)?

PoA es un mecanismo de consenso basado en la identidad y la reputación de los validadores, en lugar del poder de cómputo (PoW) o la riqueza (PoS).

### ¿Por qué es mejor para la UTP que la minería tradicional?
*   **Eficiencia Energética**: No requiere minería. Un nodo de PoA consume lo mismo que un servidor web estándar.
*   **Velocidad y Finalidad**: Las transacciones son casi instantáneas. En la UTP, un estudiante no puede esperar 10 minutos a que Bitcoin confirme su café; con PoA, la confirmación toma 2-5 segundos.
*   **Control Institucional**: La universidad (o el departamento de IT) actúa como la autoridad. Solo nodos autorizados pueden validar transacciones, evitando ataques externos.
*   **Cero Comisiones (Gas)**: Podemos configurar la red para que las transacciones sean gratuitas para los estudiantes, manteniendo la seguridad.

---

## 2. Herramientas: Hyperledger Besu vs. Geth

| Característica | Hyperledger Besu (Recomendado) | Geth (Clique) |
| :--- | :--- | :--- |
| **Enfoque** | Empresarial / Permisionado | Estándar de Ethereum / Público |
| **Consenso** | **IBFT 2.0** (Finalidad inmediata) | Clique (Finalidad eventual) |
| **Privacidad** | Nativa (Transacciones privadas) | Limitada |
| **Facilidad** | Muy amigable para redes privadas | Requiere más configuración manual |

**Decisión**: Utilizaremos **Hyperledger Besu** con el algoritmo **IBFT 2.0 (Istanbul Byzantine Fault Tolerant)** porque garantiza que una vez que una transacción aparece en un bloque, nunca se revertirá (finalidad instantánea), ideal para pagos en tiempo real.

---

## 3. Plan de Implementación (Red de 4 Nodos)

### Paso 1: Descargar Hyperledger Besu
Besu es un binario ejecutable en Java. 
1. Descarga la última versión desde [besu.hyperledger.org](https://besu.hyperledger.org/en/stable/how-to/install/binary-distribution/).
2. Asegúrate de tener instalado **Java 17+**.

### Paso 2: Configurar la Red Privada (IBFT 2.0)
Levantaremos 4 nodos en una sola máquina usando **Docker** (es la forma más rápida de probar la comunicación entre nodos).

1. **Generar llaves de nodos**: Usaremos la herramienta `besu operator generate-blockchain-config`.
2. **Archivo Genesis**: Definiremos el `chainId` (ej: 2026) y pre-asignaremos balances a las cuentas de prueba.
3. **Docker Compose**: Crearemos un archivo que levante los 4 contenedores, cada uno representando un validador de la UTP.

### Paso 3: El Objetivo - Nodos Hablando entre sí
Cuando los 4 nodos estén corriendo, el objetivo es que logren el **quórum**. 
*   Si un nodo intenta registrar una transacción falsa, los otros 3 lo rechazarán.
*   Si un nodo se cae, la red sigue funcionando con los otros 3.

---

## 4. Transparencia: El Explorador de Bloques

Para mantener la confianza de la comunidad, instalaremos un **Block Explorer** (ventana de cristal).
*   **Herramienta**: [BlockScout](https://www.blockscout.com/)
*   **Resultado**: Una página web interna (`explorer.utpay.pa`) donde cualquier estudiante puede ver:
    > "La billetera `0xABC...` envió 10 UTPay a `Cafetería_Edificio3` el 25/01/2026 a las 10:30 AM".

---

## 5. Próximos Pasos para la API de la UTP 

Una vez la red esté estable: 
1.  **Suministro Inicial**: Hemos pre-asignado **1,000,000,000 UTP** (1 Billón) en la cuenta principal para asegurar liquidez en todo el campus.
2.  **API Bridge**: Crearemos una capa en la API actual (Node.js) que use `ethers.js` para firmar transacciones. 
3.  **Smart Contracts**: Desplegaremos el contrato `UTPayCoin.sol` (ERC-20) en nuestra red privada. 
4.  **SDK para Estudiantes**: Permitiremos que otros estudiantes desarrollen sus propios productos (ej: apps de delivery interno) conectándose a nuestra blockchain. 
 
 --- 
 *Este documento es la hoja de ruta para la descentralización de UTPay.*
