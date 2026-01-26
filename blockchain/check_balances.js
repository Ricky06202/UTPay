const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    
    const accounts = [
        '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
    ];

    for (const acc of accounts) {
        const balance = await provider.getBalance(acc);
        console.log(`Address: ${acc} - Balance: ${ethers.utils.formatEther(balance)} UTP`);
    }
}

main();
