const ethers = require('ethers');
const fs = require('fs');

const abiData = JSON.parse(fs.readFileSync('./blockchain/build/UTPay.json', 'utf8'));
const iface = new ethers.utils.Interface(abiData.abi);

console.log('Selectors in UTPay ABI:');
Object.keys(iface.functions).forEach((fun) => {
    console.log(`${iface.getSighash(fun)} : ${fun}`);
});
