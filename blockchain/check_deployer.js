const { ethers } = require('ethers');

const RPC_URL = 'http://localhost:8545';
const CONTRACT_ADDRESS = '0xbCF26943C0197d2eE0E5D05c716Be60cc2761508';

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    // En Besu no hay una forma directa de saber quién desplegó si no tienes el bloque,
    // pero podemos intentar ver el historial o preguntar al usuario.
    // Intentaremos consultar el bloque 0 o 1.
    const block = await provider.getBlock(1);
    console.log(`Bloque 1:`, block ? block.miner : 'No encontrado');
}

main();
