
import { Platform } from 'react-native';

// Tu IP local para que el celular pueda conectarse a tu PC
const LAN_IP = '192.168.2.75'; 

const LOCAL_API_URL = Platform.OS === 'web' 
  ? 'http://localhost:8787' 
  : `http://${LAN_IP}:8787`;

const PRODUCTION_API_URL = 'https://utpay-api.ricardosanjurg.workers.dev';

// IMPORTANTE: Ahora usamos PRODUCTION_API_URL porque la blockchain local 
// está expuesta vía ngrok y Cloudflare ya puede verla.
export const API_URL = PRODUCTION_API_URL;
