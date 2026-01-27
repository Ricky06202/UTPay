import { ethers } from 'ethers';

// Dirección del contrato desplegado
export const CONTRACT_ADDRESS = '0x8464135c8F25Da09e49BC8782676a84730C318bC';

// ABI simplificado del contrato UTPay
export const CONTRACT_ABI = [
    "function registerStudent(string memory _email, address _wallet) public",
    "function updateWallet(string memory _email, address _newWallet) public",
    "function mint(string memory _email, uint256 _amount) public",
    "function burn(string memory _email, uint256 _amount) public",
    "function transferByEmail(string memory _toEmail, uint256 _amount, string memory _metadata) public",
    "function getBalance(string memory _email) public view returns (uint256)",
    "function getEmailByWallet(address _wallet) public view returns (string memory)",
    "function updateCreditScore(string memory _email, uint256 _newScore) public",
    "function requestLoan(string memory _email, uint256 _amount) public",
    "function payLoan(string memory _email, uint256 _amount) public",
    "function donateToFund(uint256 _amount) public",
    "function creditScore(string memory) public view returns (uint256)",
    "function activeLoans(string memory) public view returns (uint256)",
    "function loanFund() public view returns (uint256)",
    "event Transfer(string fromEmail, string toEmail, uint256 amount, string metadata)",
    "event WalletUpdated(string email, address oldWallet, address newWallet)",
    "event StudentRegistered(string email, address wallet)",
    "event Mint(string email, uint256 amount)",
    "event Burn(string email, uint256 amount)"
];

// Configuración de la red Besu local
const LOCAL_RPC_URL = 'http://127.0.0.1:8545'; 
const ADMIN_PRIVATE_KEY = '0x0607f9d43e7d6637dcdf77c18b471f65d55165d79756750f23a8512691b1d981';

const providerCache: Record<string, ethers.JsonRpcProvider> = {};

export const getContract = (rpcUrl?: string) => {
    const url = rpcUrl || 'https://portraits-decreased-zen-authentication.trycloudflare.com';
    
    if (!providerCache[url]) {
        providerCache[url] = new ethers.JsonRpcProvider(url, undefined, {
            staticNetwork: true,
            batchMaxCount: 1
        });
    }
    
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, providerCache[url]);
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
};

export const getReadOnlyContract = (rpcUrl?: string) => {
    const url = rpcUrl || 'https://portraits-decreased-zen-authentication.trycloudflare.com';
    console.log(`[Blockchain] getReadOnlyContract - URL: ${url}`);
        
    const provider = new ethers.JsonRpcProvider(url, undefined, {
        staticNetwork: true,
        batchMaxCount: 1
    });

    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
};
