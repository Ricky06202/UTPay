const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    const adminPrivateKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; 
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

    const addressConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build', 'address.json'), 'utf8'));
    const contractJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build', 'UTPay.json'), 'utf8'));
    const contract = new ethers.Contract(addressConfig.address, contractJson.abi, adminWallet);

    console.log('--- PRUEBA DE RECUPERACIÓN DE CUENTA (TESIS) ---');
    
    const email = 'estudiante_perdido@utp.ac.pa';
    const oldWallet = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'; // Billetera 3
    const newWallet = ethers.Wallet.createRandom().address;

    console.log(`Estudiante: ${email}`);
    console.log(`Billetera Antigua: ${oldWallet}`);
    console.log(`Billetera Nueva: ${newWallet}`);

    // 1. Registro inicial y carga de saldo
    console.log('\n1. Registrando estudiante con billetera antigua...');
    const tx1 = await contract.registerStudent(email, oldWallet);
    await tx1.wait();
    
    console.log('2. Cargando saldo inicial de 1000 tokens ($10.00)...');
    const tx2 = await contract.mint(email, 1000);
    await tx2.wait();
    
    let balance = await contract.getBalance(email);
    console.log(`Saldo inicial: ${balance.toString()}`);

    // 2. Ejecutar recuperación
    console.log('\n3. EJECUTANDO RECUPERACIÓN (updateWallet)...');
    const tx3 = await contract.updateWallet(email, newWallet);
    await tx3.wait();
    console.log('✅ Recuperación ejecutada exitosamente.');

    // 3. Verificaciones
    console.log('\n4. Verificando resultados:');
    
    const linkedEmailOld = await contract.getEmailByWallet(oldWallet);
    const linkedEmailNew = await contract.getEmailByWallet(newWallet);
    const finalBalance = await contract.getBalance(email);
    const studentData = await contract.students(email);

    console.log(`¿Billetera antigua vinculada a alguien?: ${linkedEmailOld === '' ? 'NO (Correcto)' : 'SÍ (' + linkedEmailOld + ')'}`);
    console.log(`¿Billetera nueva vinculada al correo?: ${linkedEmailNew === email ? 'SÍ (Correcto)' : 'NO'}`);
    console.log(`Saldo en el correo tras recuperación: ${finalBalance.toString()} (Debería ser 1000)`);
    console.log(`Billetera registrada en el perfil del estudiante: ${studentData.wallet}`);

    if (linkedEmailOld === '' && linkedEmailNew === email && finalBalance.toString() === '1000' && studentData.wallet === newWallet) {
        console.log('\n🔥🔥 PRUEBA REINA SUPERADA: El saldo reside en la identidad, no en la billetera. 🔥🔥');
    } else {
        console.log('\n❌ La prueba de recuperación falló en algún punto.');
    }
}

main().catch(console.error);
