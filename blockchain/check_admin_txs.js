const { ethers } = require('ethers');

const RPC_URL = 'http://localhost:8545';
const ADMIN_ADDRESS = '0xdFEEFf24f48734dA6faa7FdB28C5a740D15B84C0';

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const blockNumber = await provider.getBlockNumber();
    
    console.log(`Current Block: ${blockNumber}`);
    
    // Scan all blocks for transactions from admin
    for (let i = blockNumber; i > 0; i--) {
        const block = await provider.getBlockWithTransactions(i);
        if (block.transactions.length === 0) continue;
        for (const tx of block.transactions) {
            if (tx.from.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
                const receipt = await provider.getTransactionReceipt(tx.hash);
                console.log(`TX in Block ${i}: ${tx.hash}`);
                console.log(`  Status: ${receipt.status === 1 ? 'SUCCESS' : 'FAILED'}`);
                console.log(`  Nonce: ${tx.nonce}`);
                // Try to decode if it was a mint
                try {
                    // Simple check if it's mint (method ID for mint(string,uint256) is 0x40c10f19... no, let's just see input)
                    console.log(`  Input: ${tx.data.substring(0, 10)}...`);
                } catch (e) {}
            }
        }
    }
}

main();
