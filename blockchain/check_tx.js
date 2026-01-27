const { ethers } = require('ethers');

const RPC_URL = 'http://localhost:8545';
const txHash = '0x40eedfe32cf7b49d810f97cac8544c73547e469cb95a0197b93d0e03a4cc1e40';

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const tx = await provider.getTransaction(txHash);
    if (tx) {
        console.log(`Transaction found:`, {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            nonce: tx.nonce,
            blockNumber: tx.blockNumber
        });
    } else {
        console.log('Transaction not found');
    }
}

main();
