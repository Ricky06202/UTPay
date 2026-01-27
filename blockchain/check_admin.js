const { ethers } = require('ethers');

const RPC_URL = 'http://localhost:8545';
const PRIVATE_KEY = '0x0607f9d43e7d6637dcdf77c18b471f65d55165d79756750f23a8512691b1d981';

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
