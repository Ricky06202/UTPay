const { ethers } = require('ethers');

async function main() {
    const RPC_URL = 'http://localhost:8545';
    // Account 1 from Hardhat/Besu test env (The one we used for deployment)
    const ADMIN_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    const RECIPIENT_ADDRESS = '0x5Df2577A3293b5FD0755a047234E4dea1945C57D'; // Estudiante 3

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);

    console.log(`Enviando 1 ETH (Gas) de Admin a ${RECIPIENT_ADDRESS}...`);
    
    const tx = await adminWallet.sendTransaction({
        to: RECIPIENT_ADDRESS,
        value: ethers.utils.parseEther('1.0')
    });
    
    console.log(`Transacción enviada: ${tx.hash}`);
    await tx.wait();
    console.log('✅ Wallet fondeada con Gas!');
}

main().catch(console.error);
