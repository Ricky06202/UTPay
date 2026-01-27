const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    const adminPrivateKey = '0x0607f9d43e7d6637dcdf77c18b471f65d55165d79756750f23a8512691b1d981'; 
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

    const addressConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build', 'address.json'), 'utf8'));
    const contractJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build', 'UTPay.json'), 'utf8'));
    const contract = new ethers.Contract(addressConfig.address, contractJson.abi, adminWallet);

    console.log('--- PRUEBA DE MÉRITO Y CRÉDITO (TESIS) ---');
    
    const studentEmail = 'estudiante_meritorio@utp.ac.pa';
    const studentWallet = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Cuenta 2
    const donorEmail = 'admin@utp.ac.pa'; // El admin donará al fondo

    // 1. Registro y Donación al Fondo
    console.log('\n1. Registrando estudiante meritorio...');
    await (await contract.registerStudent(studentEmail, studentWallet)).wait();
    
    console.log('2. Admin donando 5000 tokens ($50.00) al fondo de préstamos...');
    await (await contract.mint(donorEmail, 5000)).wait();
    await (await contract.donateToFund(5000)).wait();
    
    let fund = await contract.loanFund();
    console.log(`Fondo actual: ${fund.toString()} tokens.`);

    // 2. Prueba de Requisito de Score
    console.log('\n3. Intentando pedir préstamo con Score 0 (Debe fallar)...');
    const studentSigner = new ethers.Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', provider);
    const contractAsStudent = contract.connect(studentSigner);
    try {
        await (await contractAsStudent.requestLoan(1000)).wait();
        console.log('❌ Error: El préstamo se aprobó sin mérito.');
    } catch (e) {
        console.log('✅ Préstamo denegado por falta de mérito (Correcto).');
    }

    // 3. Actualizar Score y Pedir Préstamo
    console.log('\n4. Admin actualiza Score a 85 (Mérito detectado)...');
    await (await contract.updateCreditScore(studentEmail, 85)).wait();
    
    console.log('5. Estudiante pide préstamo de 1000 tokens ($10.00)...');
    await (await contractAsStudent.requestLoan(1000)).wait();
    
    let balance = await contract.getBalance(studentEmail);
    let debt = await contract.activeLoans(studentEmail);
    console.log(`✅ Préstamo aprobado.`);
    console.log(`Saldo estudiante: ${balance.toString()} tokens.`);
    console.log(`Deuda activa: ${debt.toString()} tokens.`);

    // 4. Pago de Préstamo y Mejora de Reputación
    console.log('\n6. Estudiante paga el préstamo...');
    await (await contractAsStudent.payLoan()).wait();
    
    let finalDebt = await contract.activeLoans(studentEmail);
    let finalScore = await contract.creditScore(studentEmail);
    console.log(`✅ Préstamo pagado.`);
    console.log(`Deuda actual: ${finalDebt.toString()}`);
    console.log(`Nuevo Credit Score (Reputación): ${finalScore.toString()} (Subió +2 por pago puntual)`);
}

main().catch(console.error);
