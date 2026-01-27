const abi = [
  {
    "inputs": [
      { "internalType": "string", "name": "_email", "type": "string" },
      { "internalType": "address", "name": "_wallet", "type": "address" }
    ],
    "name": "registerStudent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "_email", "type": "string" },
      { "internalType": "uint256", "name": "_amount", "type": "uint256" }
    ],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "_email", "type": "string" },
      { "internalType": "uint256", "name": "_amount", "type": "uint256" }
    ],
    "name": "burn",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "string", "name": "email", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "Mint",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "string", "name": "fromEmail", "type": "string" },
      { "indexed": false, "internalType": "string", "name": "toEmail", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "metadata", "type": "string" }
    ],
    "name": "Transfer",
    "type": "event"
  }
];

db.contracts.updateOne(
  { _id: '0x8464135c8f25da09e49bc8782676a84730c318bc' },
  { 
    $set: { 
      abi: JSON.stringify(abi),
      contractName: "UTPay",
      verified: true
    } 
  }
);

print("Contract updated with ABI");
