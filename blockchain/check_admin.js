const { ethers } = require('ethers');

const RPC_URL = 'http://localhost:8545';
const PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log(`Admin Address: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    const nonce = await provider.getTransactionCount(wallet.address);
    const pendingNonce = await provider.getTransactionCount(wallet.address, 'pending');
    
    console.log(`ETH Balance: ${ethers.utils.formatEther(balance)} ETH`);
    console.log(`Nonce (confirmed): ${nonce}`);
    console.log(`Nonce (pending): ${pendingNonce}`);
}

main();
