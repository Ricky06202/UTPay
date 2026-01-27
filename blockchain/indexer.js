const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuración
const RPC_URL = 'http://localhost:8545';
const CONTRACT_ADDRESS = '0x8464135c8F25Da09e49BC8782676a84730C318bC';
const API_URL = 'http://localhost:8787'; 
const LAST_BLOCK_FILE = path.resolve(__dirname, 'last_block.txt');

const ABI = [
    "event Transfer(string fromEmail, string toEmail, uint256 amount, string metadata)",
    "event WalletUpdated(string email, address oldWallet, address newWallet)",
    "event StudentRegistered(string email, address wallet)",
    "event Mint(string email, uint256 amount)",
    "event Burn(string email, uint256 amount)"
];

async function processEvent(log, contract) {
    const event = contract.interface.parseLog(log);
    const txHash = log.transactionHash;
    console.log(`🔔 Evento detectado: ${event.name}`);

    if (event.name === "Transfer") {
        const [fromEmail, toEmail, amount, metadata] = event.args;
        const value = ethers.utils.formatUnits(amount, 2);
        console.log(`✨ [BLOCK ${log.blockNumber}] Transferencia: ${fromEmail} -> ${toEmail} (${value} UTP)`);
        
        try {
            await axios.post(`${API_URL}/internal/confirm-transaction`, {
                txHash,
                status: 'success',
                fromEmail,
                toEmail,
                amount: value,
                metadata
            });
        } catch (e) {
            console.error(`❌ Error notificando Transferencia: ${e.message}`);
        }
    } else if (event.name === "WalletUpdated") {
        const [email, oldWallet, newWallet] = event.args;
        console.log(`🔄 [BLOCK ${log.blockNumber}] Wallet actualizada: ${email}`);
        try {
            await axios.post(`${API_URL}/internal/update-user-wallet`, { email, newWallet });
        } catch (e) {
            console.error(`❌ Error notificando WalletUpdate: ${e.message}`);
        }
    } else if (event.name === "Mint") {
        const [email, amount] = event.args;
        const value = ethers.utils.formatUnits(amount, 2);
        console.log(`💰 [BLOCK ${log.blockNumber}] Mint: ${email} +${value} UTP`);
        try {
            await axios.post(`${API_URL}/internal/confirm-transaction`, {
                txHash,
                status: 'success',
                fromEmail: 'SISTEMA',
                toEmail: email,
                amount: value,
                metadata: 'Carga de saldo por Admin'
            });
        } catch (e) {
            console.error(`❌ Error notificando Mint: ${e.message}`);
        }
    } else if (event.name === "Burn") {
        const [email, amount] = event.args;
        const value = ethers.utils.formatUnits(amount, 2);
        console.log(`🔥 [BLOCK ${log.blockNumber}] Burn: ${email} -${value} UTP`);
        try {
            await axios.post(`${API_URL}/internal/confirm-transaction`, {
                txHash,
                status: 'success',
                fromEmail: email,
                toEmail: 'SISTEMA',
                amount: value,
                metadata: 'Retiro de saldo por Admin'
            });
        } catch (e) {
            console.error(`❌ Error notificando Burn: ${e.message}`);
        }
    }
}

async function main() {
    console.log('🚀 Iniciando Indexador UTPay con Resiliencia...');
    
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    // 1. Obtener el último bloque procesado
    let lastProcessedBlock = 0;
    if (fs.existsSync(LAST_BLOCK_FILE)) {
        lastProcessedBlock = parseInt(fs.readFileSync(LAST_BLOCK_FILE, 'utf8'));
    }

    console.log(`📡 Buscando eventos desde el bloque ${lastProcessedBlock + 1}...`);

    // Función para sincronizar bloques en rangos pequeños
    const syncBlocks = async () => {
        const currentBlock = await provider.getBlockNumber();
        const CHUNK_SIZE = 1000; // Tamaño máximo de bloques por petición
        
        while (lastProcessedBlock < currentBlock) {
            const fromBlock = lastProcessedBlock + 1;
            const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock);
            
            console.log(`🔄 Sincronizando bloques ${fromBlock} -> ${toBlock}...`);
            
            try {
                const logs = await provider.getLogs({
                address: CONTRACT_ADDRESS,
                fromBlock: fromBlock,
                toBlock: toBlock
            });

            if (logs.length > 0) {
                console.log(`🔎 Encontrados ${logs.length} eventos en este rango.`);
            }

            for (const log of logs) {
                // Procesar eventos en paralelo para máxima velocidad
                processEvent(log, contract).catch(e => {
                    console.error(`❌ Error procesando evento en paralelo: ${e.message}`);
                });
            }

                lastProcessedBlock = toBlock;
                fs.writeFileSync(LAST_BLOCK_FILE, lastProcessedBlock.toString());
            } catch (error) {
                console.error(`❌ Error en bloque ${fromBlock}-${toBlock}:`, error.message);
                break; // Reintentar en la próxima iteración
            }
        }
        console.log(`✅ Sincronización completada hasta bloque ${lastProcessedBlock}`);
    };

    // Sincronización inicial
    await syncBlocks();

    // 2. Escuchar nuevos eventos (Polling cada 2 segundos para igualar el block time de Besu)
    setInterval(async () => {
        try {
            const currentBlock = await provider.getBlockNumber();
            if (currentBlock > lastProcessedBlock) {
                await syncBlocks();
            }
        } catch (e) {
            console.error(`❌ Error en ciclo de sincronización: ${e.message}`);
        }
    }, 2000);

    // Mantener el proceso vivo
    process.on('SIGINT', () => {
        console.log('Stopping indexer...');
        process.exit();
    });
}

main().catch(console.error);
