const path = require('path');
const fs = require('fs');
const solc = require('solc');

const contractPath = path.resolve(__dirname, 'contracts', 'UTPay.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'UTPay.sol': {
            content: source,
        },
    },
    settings: {
        evmVersion: 'paris',
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode.object'],
            },
        },
    },
};

console.log('Compilando contrato...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

if (output.errors) {
    output.errors.forEach((err) => {
        console.error(err.formattedMessage);
    });
}

const contract = output.contracts['UTPay.sol']['UTPay'];

if (!fs.existsSync(path.resolve(__dirname, 'build'))) {
    fs.mkdirSync(path.resolve(__dirname, 'build'));
}

fs.writeFileSync(
    path.resolve(__dirname, 'build', 'UTPay.json'),
    JSON.stringify(contract, null, 2)
);

console.log('Contrato compilado con éxito. ABI y Bytecode guardados en build/UTPay.json');
