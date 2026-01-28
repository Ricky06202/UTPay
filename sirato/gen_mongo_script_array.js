const fs = require('fs');
const abiData = JSON.parse(fs.readFileSync('./blockchain/build/UTPay.json', 'utf8'));

// Esta vez pasamos el ABI como un objeto (array), no como string
const abiArray = abiData.abi;
const addressLower = '0x8464135c8f25da09e49bc8782676a84730c318bc';
const addressChecksum = '0x8464135c8F25Da09e49BC8782676a84730C318bC';

const mongoCmd = `
db.contracts.updateOne(
    { _id: '${addressLower}' },
    { $set: { abi: ${JSON.stringify(abiArray)}, contractName: 'UTPay', verified: true } },
    { upsert: true }
);
db.contracts.updateOne(
    { _id: '${addressChecksum}' },
    { $set: { abi: ${JSON.stringify(abiArray)}, contractName: 'UTPay', verified: true } },
    { upsert: true }
);
`;

fs.writeFileSync('update_mongo_array.js', mongoCmd);
console.log('Fichero update_mongo_array.js creado con éxito.');
