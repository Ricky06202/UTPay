import { ethers } from 'ethers';

// Dirección del contrato desplegado
export const CONTRACT_ADDRESS = '0xbCF26943C0197d2eE0E5D05c716Be60cc2761508';

// ABI simplificado del contrato UTPay
export const CONTRACT_ABI = [
    "function registerStudent(string memory _email, address _wallet) public",
    "function updateWallet(string memory _email, address _newWallet) public",
    "function mint(string memory _email, uint256 _amount) public",
    "function transferByEmail(string memory _toEmail, uint256 _amount, string memory _metadata) public",
    "function getBalance(string memory _email) public view returns (uint256)",
    "function getEmailByWallet(address _wallet) public view returns (string memory)",
    "event Transfer(string fromEmail, string toEmail, uint256 amount, string metadata)",
    "event WalletUpdated(string email, address oldWallet, address newWallet)",
    "event StudentRegistered(string email, address wallet)",
    "event Mint(string email, uint256 amount)"
];

// Configuración de la red Besu
const RPC_URL = 'http://localhost:8545'; // Nota: En producción/Docker esto podría cambiar
const ADMIN_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

export const getContract = () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
};

export const getReadOnlyContract = () => {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
};
