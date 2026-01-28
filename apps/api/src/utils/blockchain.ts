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
    "function addAdmin(address _newAdmin) public",
    "function removeAdmin(address _admin) public",
    "function admins(address) public view returns (bool)",
    "event Transfer(string fromEmail, string toEmail, uint256 amount, string metadata)",
    "event WalletUpdated(string email, address oldWallet, address newWallet)",
    "event StudentRegistered(string email, address wallet)",
    "event Mint(string email, uint256 amount)",
    "event Burn(string email, uint256 amount)"
];

// Configuración de la red Besu
const ADMIN_PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const providerCache: Record<string, ethers.JsonRpcProvider> = {};

export const getContract = (rpcUrl?: string) => {
    if (!rpcUrl) {
        throw new Error('RPC_URL is required but was not provided to getContract');
    }
    const url = rpcUrl;
    
    if (!providerCache[url]) {
        console.log(`[Blockchain] Creating NEW provider for URL: ${url}`);
        providerCache[url] = new ethers.JsonRpcProvider(url, undefined, {
            staticNetwork: true,
            batchMaxCount: 1
        });
    }
    
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, providerCache[url]);
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
};

export const getReadOnlyContract = (rpcUrl?: string) => {
    if (!rpcUrl) {
        throw new Error('RPC_URL is required but was not provided to getReadOnlyContract');
    }
    const url = rpcUrl;
    console.log(`[Blockchain] getReadOnlyContract - URL: ${url}`);
        
    const provider = new ethers.JsonRpcProvider(url, undefined, {
        staticNetwork: true,
        batchMaxCount: 1
    });

    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
};
