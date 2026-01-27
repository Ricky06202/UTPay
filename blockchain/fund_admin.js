const { ethers } = require('ethers');

const RPC_URL = 'http://localhost:8545';
const DEPLOYER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const ADMIN_ADDRESS = '0xdFEEFf24f48734dA6faa7FdB28C5a740D15B84C0';

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);
    
    const balance = await provider.getBalance(wallet.address);
    console.log(`Deployer Balance: ${ethers.utils.formatEther(balance)} ETH`);
    
    if (balance.gt(0)) {
        console.log(`Enviando 1 ETH al admin...`);
        const tx = await wallet.sendTransaction({
            to: ADMIN_ADDRESS,
            value: ethers.utils.parseEther('1.0')
        });
        await tx.wait();
        console.log(`Transferencia completada. Hash: ${tx.hash}`);
    } else {
        console.log('El deployer no tiene ETH.');
    }
}

main();
