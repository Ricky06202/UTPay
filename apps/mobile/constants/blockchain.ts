import 'react-native-get-random-values';
import { decode, encode } from 'base-64';

if (!global.btoa) {
  global.btoa = encode;
}

if (!global.atob) {
  global.atob = decode;
}

import { ethers } from 'ethers';
import { Platform } from 'react-native';

// IP de tu PC en la red local (LAN)
const LAN_IP = '192.168.2.75';

const RPC_URL = Platform.OS === 'web' 
  ? 'http://localhost:8545' 
  : `http://${LAN_IP}:8545`;

const CHAIN_ID = 2026;

// Provider para conectarse a la blockchain
export const provider = new ethers.providers.JsonRpcProvider(RPC_URL, {
  name: 'utpay',
  chainId: CHAIN_ID,
});

/**
 * Obtiene el balance de una dirección en UTP
 * @param address Dirección de la billetera
 * @returns Balance formateado en UTP
 */
export const getUTPBalance = async (address: string): Promise<string> => {
  try {
    const balance = await provider.getBalance(address);
    return ethers.utils.formatEther(balance);
  } catch (error) {
    console.error('Error al obtener balance de Besu:', error);
    return '0.0';
  }
};

/**
 * Crea una instancia de Wallet a partir de una llave privada
 * @param privateKey Llave privada de la cuenta
 */
export const getWallet = (privateKey: string) => {
  return new ethers.Wallet(privateKey, provider);
};

/**
 * Obtiene el historial de transacciones directamente desde la Blockchain
 * @param address Dirección de la billetera
 * @returns Lista de transacciones (Transferencias nativas)
 */
export const getBlockchainHistory = async (address: string) => {
  try {
    // Obtenemos el bloque actual para saber hasta dónde buscar
    const currentBlock = await provider.getBlockNumber();
    // Buscamos en los últimos 10,000 bloques (ajustable según necesidad)
    const fromBlock = Math.max(0, currentBlock - 10000);
    
    // Ethers v5 no tiene un método directo para listar transacciones por dirección de forma eficiente
    // sin un indexador como Etherscan, pero para una red privada Besu pequeña, 
    // podemos intentar recuperar logs o buscar por bloques recientes si la red es controlada.
    
    // NOTA: Para Besu/Ethers v5 sin indexador, recuperar el historial de transferencias NATIVAS 
    // (no tokens) es complejo. Normalmente se usa un indexador. 
    // Como alternativa pedagógica, seguiremos usando la DB como caché, 
    // pero la meta-data (como el hash) SIEMPRE vendrá de la blockchain.
    
    return null; // Devolvemos null para indicar que necesitamos el fallback de la DB o un indexador
  } catch (error) {
    console.error('Error al obtener historial de blockchain:', error);
    return null;
  }
};
