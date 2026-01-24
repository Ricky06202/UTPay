import { Platform } from 'react-native';

const PRODUCTION_API_URL = 'https://utpay-api.ricardosanjurg.workers.dev';
const LOCAL_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8787' : 'http://127.0.0.1:8787';

// Cambia a true para forzar producción incluso en desarrollo
const FORCE_PRODUCTION = true;

export const API_URL = (__DEV__ && !FORCE_PRODUCTION) ? LOCAL_API_URL : PRODUCTION_API_URL;
