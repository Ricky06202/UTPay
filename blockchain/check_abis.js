const { utils } = require("ethers");
const fs = require("fs");

const abi = JSON.parse(fs.readFileSync("../sirato/abis/0x8464135c8f25da09e49bc8782676a84730c318bc.json", "utf8"));

abi.forEach(item => {
    if (item.type === "function") {
        const signature = `${item.name}(${item.inputs.map(i => i.type).join(",")})`;
        const hash = utils.id(signature).slice(0, 10);
        console.log(`${hash}: ${signature}`);
    }
});
