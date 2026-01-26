import { Platform } from 'react-native';

const PRODUCTION_API_URL = 'https://utpay-api.ricardosanjurg.workers.dev';
// Reemplaza esta IP con la IP local de tu PC (ej. 192.168.x.x) para probar en dispositivos físicos
const LAN_IP = '192.168.2.75'; 

const LOCAL_API_URL = Platform.OS === 'web' 
  ? 'http://localhost:8787' 
  : `http://${LAN_IP}:8787`;

// Cambia a true para forzar producción incluso en desarrollo
const FORCE_PRODUCTION = true;

export const API_URL = (__DEV__ && !FORCE_PRODUCTION) ? LOCAL_API_URL : PRODUCTION_API_URL;
