const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const abiPath = path.join(__dirname, "../sirato/abis/0x8464135c8f25da09e49bc8782676a84730c318bc.json");
const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));

const iface = new ethers.utils.Interface(abi);

console.log("Function Signatures:");
Object.keys(iface.functions).forEach((fname) => {
  console.log(`${fname}: ${iface.getSighash(fname)}`);
});

console.log("\nEvent Signatures:");
Object.keys(iface.events).forEach((ename) => {
  console.log(`${ename}: ${iface.getEventTopic(ename)}`);
});
