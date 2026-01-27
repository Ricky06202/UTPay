const axios = require('axios');

async function main() {
    const API_URL = 'http://localhost:8787';
    const email = 'ricardo.sanjur4@utp.ac.pa';
    
    try {
        console.log(`Solicitando sincronización de balance para ${email}...`);
        const resp = await axios.post(`${API_URL}/internal/sync-user-balance`, { email });
        console.log('Respuesta:', resp.data);
    } catch (e) {
        console.error('Error:', e.response ? e.response.data : e.message);
    }
}

main();
