const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    const privateKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    const wallet = new ethers.Wallet(privateKey, provider);

    const addressConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build', 'address.json'), 'utf8'));
    const contractJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build', 'UTPay.json'), 'utf8'));
    
    const contract = new ethers.Contract(addressConfig.address, contractJson.abi, wallet);

    const email = "test_blockscout_" + Date.now() + "@utp.ac.pa";
    const amount = 500;

    console.log(`Registrando estudiante ${email}...`);
    try {
        const regTx = await contract.registerStudent(email, ethers.Wallet.createRandom().address);
        await regTx.wait();
        console.log("Estudiante registrado.");

        console.log(`Realizando mint de ${amount} UTP para ${email}...`);
        const mintTx = await contract.mint(email, amount);
        const receipt = await mintTx.wait();
        console.log(`✅ Mint completado! Hash: ${receipt.transactionHash}`);
        console.log(`Bloque: ${receipt.blockNumber}`);
    } catch (error) {
        console.error("Error durante el mint:", error.message);
    }
}

main().catch(console.error);
