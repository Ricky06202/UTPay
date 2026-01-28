const fs = require('fs');
const abiData = JSON.parse(fs.readFileSync('./blockchain/build/UTPay.json', 'utf8'));
const abiString = JSON.stringify(abiData.abi);

// Usamos concatenación para evitar problemas con el símbolo $ en PowerShell
const mongoCmd = "db.contracts.updateOne({ _id: '0x8464135c8f25da09e49bc8782676a84730c318bc' }, { " + 
                 "'$set': { abi: " + JSON.stringify(abiString) + ", contractName: 'UTPay', verified: true } " + 
                 "}, { upsert: true });";

fs.writeFileSync('update_mongo.js', mongoCmd);
console.log('Fichero update_mongo.js creado con éxito.');
