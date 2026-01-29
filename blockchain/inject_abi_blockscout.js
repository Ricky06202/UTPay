const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
    const address = "0x8464135c8F25Da09e49BC8782676a84730C318bC";
    const contractJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build', 'UTPay.json'), 'utf8'));
    const abiStr = JSON.stringify(contractJson.abi).replace(/'/g, "''");
    const addressHash = address.toLowerCase().replace('0x', '');

    const sql = `INSERT INTO smart_contracts (name, compiler_version, optimization, contract_source_code, abi, address_hash, inserted_at, updated_at, contract_code_md5) VALUES ('UTPay', 'v0.8.20', false, '', '${abiStr}', decode('${addressHash}', 'hex'), now(), now(), 'manual_injection') ON CONFLICT (address_hash) DO UPDATE SET abi = EXCLUDED.abi;`;

    console.log("Inyectando ABI en Blockscout...");
    try {
        // Usar un archivo temporal para el SQL para evitar problemas de escape en la terminal
        fs.writeFileSync('inject_abi.sql', sql);
        execSync(`docker cp inject_abi.sql utpay-explorer-db:/tmp/inject_abi.sql`);
        execSync(`docker exec utpay-explorer-db psql -U blockscout -f /tmp/inject_abi.sql`);
        console.log("✅ ABI inyectado con éxito.");
    } catch (error) {
        console.error("Error al inyectar ABI:", error.message);
    } finally {
        if (fs.existsSync('inject_abi.sql')) fs.unlinkSync('inject_abi.sql');
    }
}

main();
