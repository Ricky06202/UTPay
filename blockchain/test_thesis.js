const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    
    // El admin configurado en deploy.js
    const adminPrivateKey = '0x0607f9d43e7d6637dcdf77c18b471f65d55165d79756750f23a8512691b1d981'; 
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);
    
    // Una billetera aleatoria sin roles
    const randomWallet = ethers.Wallet.createRandom().connect(provider);

    const addressConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build', 'address.json'), 'utf8'));
    const contractJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build', 'UTPay.json'), 'utf8'));
    
    const contractAsAdmin = new ethers.Contract(addressConfig.address, contractJson.abi, adminWallet);
    const contractAsRandom = new ethers.Contract(addressConfig.address, contractJson.abi, randomWallet);

    console.log('--- PRUEBA DE ROLES Y MATEMÁTICA ---');
    console.log('Contrato:', addressConfig.address);
    console.log('Admin:', adminWallet.address);
    console.log('Random:', randomWallet.address);

    // 1. Verificar Admin
    const currentAdmin = await contractAsAdmin.admin();
    console.log('Admin en el contrato:', currentAdmin);
    if (currentAdmin.toLowerCase() === adminWallet.address.toLowerCase()) {
        console.log('✅ El admin es correcto.');
    } else {
        console.log('❌ El admin NO coincide.');
    }

    // 2. Prueba de Mint (Admin)
    console.log('\nIntentando Mint de 100 tokens ($1.00) desde Admin...');
    try {
        const tx = await contractAsAdmin.mint('admin@utp.ac.pa', 100);
        await tx.wait();
        const balance = await contractAsAdmin.getBalance('admin@utp.ac.pa');
        console.log(`✅ Mint exitoso. Saldo de admin@utp.ac.pa: ${balance.toString()} (Debería ser 100)`);
    } catch (e) {
        console.error('❌ Error en Mint de Admin:', e.message);
    }

    // 3. Prueba de Mint (Random - debe fallar)
    console.log('\nIntentando Mint desde billetera aleatoria (debe fallar)...');
    try {
        const tx = await contractAsRandom.mint('admin@utp.ac.pa', 100, { gasLimit: 100000 });
        await tx.wait();
        console.log('❌ Error: El mint desde cuenta no autorizada FUNCIONÓ (esto es malo).');
    } catch (e) {
        console.log('✅ Mint falló como se esperaba (Revert).');
    }

    // 4. Prueba de Transferencia y Matemática
    console.log('\nIntentando transferencia de 50 tokens ($0.50) a un nuevo estudiante...');
    const studentAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Cuenta 2 de Hardhat
    try {
        console.log('Registrando nuevo estudiante...');
        const txReg = await contractAsAdmin.registerStudent('estudiante@utp.ac.pa', studentAddress);
        await txReg.wait();

        console.log('Transfiriendo...');
        const txTrans = await contractAsAdmin.transferByEmail('estudiante@utp.ac.pa', 50, 'Pago de prueba');
        await txTrans.wait();

        const balanceAdmin = await contractAsAdmin.getBalance('admin@utp.ac.pa');
        const balanceEst = await contractAsAdmin.getBalance('estudiante@utp.ac.pa');
        
        console.log(`✅ Transferencia exitosa.`);
        console.log(`Saldo Admin: ${balanceAdmin.toString()} (Esperado: 50)`);
        console.log(`Saldo Estudiante: ${balanceEst.toString()} (Esperado: 50)`);
    } catch (e) {
        console.error('❌ Error en transferencia:', e.message);
    }
}

main().catch(console.error);
