const { ethers } = require('ethers');

const RPC_URL = 'http://localhost:8545';
const CONTRACT_ADDRESS = '0x8464135c8F25Da09e49BC8782676a84730C318bC';
const ABI = [
    "function getBalance(string memory _email) public view returns (uint256)",
    "function students(string memory) public view returns (string email, address wallet, uint256 balance, bool isRegistered)"
];

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    
    const email = 'ricardo.sanjur4@utp.ac.pa'; // El email que parece estar usando el usuario
    try {
        const balance = await contract.getBalance(email);
        console.log(`Saldo en contrato para ${email}: ${ethers.utils.formatUnits(balance, 2)} UTP`);
        
        const student = await contract.students(email);
        console.log(`Datos del estudiante:`, {
            email: student.email,
            wallet: student.wallet,
            balance: student.balance.toString(),
            isRegistered: student.isRegistered
        });
    } catch (e) {
        console.error(`Error consultando saldo: ${e.message}`);
    }
}

main();
