const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    const privateKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('Desplegando contrato UTPay...');

    const contractJson = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, 'build', 'UTPay.json'), 'utf8')
    );

    const factory = new ethers.ContractFactory(
        contractJson.abi,
        contractJson.evm.bytecode.object,
        wallet
    );

    const contract = await factory.deploy({
        gasLimit: 5000000,
        gasPrice: 0
    });
    
    await contract.deployed();
    console.log('✅ Contrato UTPay inyectado en:', contract.address);

    // Guardar solo la dirección para el backend y frontend
    const config = {
        address: contract.address,
        network: 'Besu Local',
        chainId: 2026
    };

    fs.writeFileSync(
        path.resolve(__dirname, 'build', 'address.json'),
        JSON.stringify(config, null, 2)
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
