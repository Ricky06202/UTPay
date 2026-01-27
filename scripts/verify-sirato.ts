
async function uploadAbi() {
    const CONTRACT_ADDRESS = '0x8464135c8F25Da09e49BC8782676a84730C318bC';
    const SIRATO_API = 'http://localhost:4000/api'; // Puerto 4000 es el de Nginx que configuramos

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

    console.log(`🚀 Enviando ABI a Sirato para el contrato ${CONTRACT_ADDRESS}...`);

    try {
        // Sirato (Epirus Free) suele usar este endpoint para contratos
        const response = await fetch(`${SIRATO_API}/v1/contracts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                address: CONTRACT_ADDRESS,
                abi: abi,
                contractName: "UTPay"
            })
        });

        if (response.ok) {
            console.log('✅ ABI cargado correctamente. Ahora Sirato debería mostrar los nombres de las funciones y eventos.');
        } else {
            const error = await response.text();
            console.error('❌ Error al cargar el ABI:', error);
        }
    } catch (err) {
        console.error('❌ No se pudo conectar con Sirato. Asegúrate de que el Docker esté corriendo y accesible en http://localhost:4000/api');
    }
}

uploadAbi();
