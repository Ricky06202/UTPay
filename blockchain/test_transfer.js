const { ethers } = require('ethers');

async function main() {
    const RPC_URL = 'http://localhost:8545';
    const CONTRACT_ADDRESS = '0xbCF26943C0197d2eE0E5D05c716Be60cc2761508';
    
    // Private key de estudiante3@utp.ac.pa
    const PRIVATE_KEY = '0xb2f48e0f30f45c8054f1e1632f1db9db6e4b483369ed37072a9792b8519ee3f5';
    
    const ABI = [
        "function transferByEmail(string memory _toEmail, uint256 _amount, string memory _metadata) public",
        "function getBalance(string memory _email) public view returns (uint256)"
    ];

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    const recipient = 'receptor@utp.ac.pa';
    const amount = ethers.utils.parseEther('10');
    const metadata = 'Pago de prueba mijo';

    console.log(`Enviando 10 UTP de estudiante3@utp.ac.pa a ${recipient}...`);
    
    const tx = await contract.transferByEmail(recipient, amount, metadata);
    console.log(`Transacción enviada: ${tx.hash}`);
    
    await tx.wait();
    console.log('✅ Transferencia confirmada!');
    
    const balance = await contract.getBalance('estudiante3@utp.ac.pa');
    console.log(`Nuevo saldo de estudiante3: ${ethers.utils.formatEther(balance)} UTP`);
}

main().catch(console.error);
