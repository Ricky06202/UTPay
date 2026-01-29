const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    const txHash = '0xe15f91cbd5f3ed68e27ee61008fc0df221a3d23ac4b49790dfc5f0adacd0a1e9';
    
    console.log(`Checking transaction: ${txHash}`);
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
        console.log('Transaction not found');
        return;
    }
    
    console.log('Transaction:', {
        hash: tx.hash,
        blockNumber: tx.blockNumber,
        from: tx.from,
        to: tx.to,
        data: tx.data
    });
    
    const receipt = await provider.getTransactionReceipt(txHash);
    console.log('Receipt:', {
        status: receipt.status === 1 ? 'Success' : 'Failed',
        blockNumber: receipt.blockNumber,
        logs: receipt.logs.length
    });
    
    if (receipt.logs.length > 0) {
        console.log('Logs found:');
        receipt.logs.forEach((log, i) => {
            console.log(`Log ${i}:`, log);
        });
    }
}

main();
