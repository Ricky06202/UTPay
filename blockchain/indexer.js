const { ethers } = require('ethers');
const axios = require('axios');

// Configuración
const RPC_URL = 'http://localhost:8545';
const CONTRACT_ADDRESS = '0xbCF26943C0197d2eE0E5D05c716Be60cc2761508';
const API_URL = 'http://localhost:8787'; // URL de tu API local

const ABI = [
    "event Transfer(string fromEmail, string toEmail, uint256 amount, string metadata)",
    "event WalletUpdated(string email, address oldWallet, address newWallet)",
    "event StudentRegistered(string email, address wallet)",
    "event Mint(string email, uint256 amount)"
];

async function main() {
    console.log('🚀 Iniciando Indexador UTPay...');
    
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    console.log(`📡 Escuchando eventos en ${CONTRACT_ADDRESS}...`);

    // 1. Escuchar Transferencias
    contract.on("Transfer", async (fromEmail, toEmail, amount, metadata, event) => {
        const txHash = event.transactionHash;
        const value = ethers.utils.formatEther(amount);
        
        console.log(`✨ Nueva Transferencia detectada: ${fromEmail} -> ${toEmail} (${value} UTP)`);
        console.log(`🔗 Hash: ${txHash}`);

        try {
            // Notificar a la API para actualizar el estado de la transacción
            await axios.post(`${API_URL}/internal/confirm-transaction`, {
                txHash,
                status: 'success',
                fromEmail,
                toEmail,
                amount: value,
                metadata
            });
            console.log('✅ API notificada correctamente');
        } catch (error) {
            console.error('❌ Error al notificar a la API:', error.message);
        }
    });

    // 2. Escuchar Actualizaciones de Wallet
    contract.on("WalletUpdated", async (email, oldWallet, newWallet, event) => {
        console.log(`🔄 Wallet actualizada para ${email}: ${oldWallet} -> ${newWallet}`);
        try {
            await axios.post(`${API_URL}/internal/update-user-wallet`, {
                email,
                newWallet
            });
            console.log('✅ Wallet actualizada en la DB local');
        } catch (error) {
            console.error('❌ Error al actualizar wallet en DB:', error.message);
        }
    });

    // 3. Escuchar Registros
    contract.on("StudentRegistered", async (email, wallet, event) => {
        console.log(`📝 Nuevo estudiante registrado: ${email} (${wallet})`);
    });

    // 4. Escuchar Mint (Carga de saldo)
    contract.on("Mint", async (email, amount, event) => {
        const value = ethers.utils.formatEther(amount);
        console.log(`💰 Saldo cargado: ${email} +${value} UTP`);
        try {
            await axios.post(`${API_URL}/internal/confirm-transaction`, {
                txHash: event.transactionHash,
                status: 'success',
                fromEmail: 'SISTEMA',
                toEmail: email,
                amount: value,
                metadata: 'Carga de saldo por Admin'
            });
            console.log('✅ Carga registrada en DB');
        } catch (error) {
            console.error('❌ Error al notificar carga a API:', error.message);
        }
    });

    // Mantener el proceso vivo
    process.on('SIGINT', () => {
        console.log('Stopping indexer...');
        process.exit();
    });
}

main().catch(console.error);
