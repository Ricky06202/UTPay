const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    const CONTRACT_ADDRESS = '0x8464135c8F25Da09e49BC8782676a84730C318bC';
    const ABI = [
        "function getBalance(string email) view returns (uint256)",
        "function students(string email) view returns (string email, address wallet, uint256 balance, bool isRegistered)"
    ];
    
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    const email = 'ricardo.sanjur4@utp.ac.pa'; // El email que parece tener el problema
    
    try {
        const balance = await contract.getBalance(email);
        const student = await contract.students(email);
        console.log(`Email: ${email}`);
        console.log(`Balance (getBalance): ${ethers.utils.formatUnits(balance, 2)} UTP`);
        console.log(`Student Info:`, {
            email: student.email,
            wallet: student.wallet,
            balance: ethers.utils.formatUnits(student.balance, 2),
            isRegistered: student.isRegistered
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
}

main();
