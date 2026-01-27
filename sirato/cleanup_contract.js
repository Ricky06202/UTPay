const fs = require('fs');
const abi = JSON.parse(fs.readFileSync('abis/0x8464135c8F25Da09e49BC8782676a84730C318bC.json', 'utf8'));

const addressChecksum = "0x8464135c8F25Da09e49BC8782676a84730C318bC";
const addressLower = addressChecksum.toLowerCase();

// Delete both and re-insert the checksummed one
db.contracts.deleteMany({ _id: { $in: [addressChecksum, addressLower] } });

db.contracts.insertOne({
    _id: addressChecksum,
    contractName: "UTPay",
    contractType: "Custom",
    verified: true,
    abi: abi,
    isPrivate: false
});

// Also update tokens collection
db.tokens.updateOne(
    { _id: addressLower },
    { 
        $set: { 
            _id: addressChecksum,
            contractType: "Custom",
            name: "UTPay University Token",
            symbol: "UTP",
            decimals: 2
        }
    },
    { upsert: true }
);

// If the lower one exists in tokens, delete it after upserting the checksummed one
if (addressChecksum !== addressLower) {
    db.tokens.deleteOne({ _id: addressLower });
}

print("Cleanup complete.");
