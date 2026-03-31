// Smart Contract ABIs and Configuration
export const OPTIMISM_MAINNET_CHAIN_ID = 10;
export const OPTIMISM_RPC_URL = "https://optimism-mainnet.infura.io/v3/272ad09425aa46408fc960cb5dacdda3";

// Contract Addresses on Optimism Mainnet
export const CONTRACTS = {
  VAULT: "0x32398234BE7d2820876b1AFe48662c2AE24a9C37", // DEMO: This contract needs to be deployed
  USDC: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", // Real USDC on Optimism
} as const;

// USDC Token ABI (ERC-20 Standard)
export const USDC_ABI = [
  // Read Functions
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  
  // Write Functions
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
] as const;

// Vault Contract ABI
export const VAULT_ABI = [
  // Read Functions
  "function balanceOf(address user) view returns (uint256)",
  "function totalBalance() view returns (uint256)",
  "function token() view returns (address)",
  
  // Write Functions
  "function deposit(uint256 amount) returns (bool)",
  "function withdraw(uint256 amount) returns (bool)",
  
  // Events
  "event Deposited(address indexed user, uint256 amount, uint256 timestamp)",
  "event Withdrawn(address indexed user, uint256 amount, uint256 timestamp)"
] as const;

// TypeScript Interfaces
export interface CryptoTransaction {
  id: string;
  userId: string;
  type: 'crypto_deposit' | 'crypto_withdrawal';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number; // Amount in USDC (with decimals)
  amountDisplay: string; // Display amount (e.g., "10.50 USDC")
  walletAddress: string;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  gasPrice?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface VaultEvent {
  type: 'Deposited' | 'Withdrawn';
  user: string;
  amount: string; // Amount in wei/smallest unit
  timestamp: number;
  transactionHash: string;
  blockNumber: number;
  logIndex: number;
}

export interface WalletState {
  isConnected: boolean;
  address?: string;
  chainId?: number;
  isCorrectNetwork: boolean;
  usdcBalance?: string; // USDC balance in user's wallet
  vaultBalance?: string; // User's balance in vault
}

// Utility constants
export const USDC_DECIMALS = 6; // USDC has 6 decimals
export const USDC_SYMBOL = "USDC";

// Helper functions for amount conversion
export const formatUSDC = (amount: bigint): string => {
  return (Number(amount) / Math.pow(10, USDC_DECIMALS)).toFixed(2);
};

export const parseUSDC = (amount: string): bigint => {
  return BigInt(Math.round(parseFloat(amount) * Math.pow(10, USDC_DECIMALS)));
};

// Validate Ethereum address
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Network configuration for wagmi
export const optimismMainnet = {
  id: OPTIMISM_MAINNET_CHAIN_ID,
  name: 'Optimism',
  network: 'optimism',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: [OPTIMISM_RPC_URL] },
    default: { http: [OPTIMISM_RPC_URL] },
  },
  blockExplorers: {
    etherscan: { name: 'Optimism Explorer', url: 'https://optimistic.etherscan.io' },
    default: { name: 'Optimism Explorer', url: 'https://optimistic.etherscan.io' },
  },
} as const;
