const { ethers } = require('ethers');

async function main() {
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    const contractAddress = '0x8464135c8F25Da09e49BC8782676a84730C318bC';
    const abi = [
        "function getBalance(string memory _email) public view returns (uint256)"
    ];
    const contract = new ethers.Contract(contractAddress, abi, provider);
    
    const email = 'ricardo.sanjur4@utp.ac.pa';
    try {
        const balance = await contract.getBalance(email);
        console.log(`Balance for ${email}: ${balance.toString()}`);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

main();
