const { ethers } = require('ethers');

async function main() {
    const RPC_URL = 'http://localhost:8545';
    const ADDRESS = '0x5Df2577A3293b5FD0755a047234E4dea1945C57D';

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const balance = await provider.getBalance(ADDRESS);
    
    console.log(`Balance nativo de ${ADDRESS}: ${ethers.utils.formatEther(balance)} ETH`);
    
    const adminAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // De deploy.js
    const adminBalance = await provider.getBalance(adminAddress);
    console.log(`Balance de Admin (0x7099...): ${ethers.utils.formatEther(adminBalance)} ETH`);
}

main().catch(console.error);
