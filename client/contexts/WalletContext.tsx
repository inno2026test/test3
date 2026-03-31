import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import {
  WalletState,
  CryptoTransaction,
  CONTRACTS,
  USDC_ABI,
  VAULT_ABI,
  OPTIMISM_MAINNET_CHAIN_ID,
  OPTIMISM_RPC_URL,
  formatUSDC,
  parseUSDC,
  isValidAddress
} from '@shared/contracts';
import { toast } from 'sonner';

// Enhanced error types for better handling
export interface WalletError {
  type: 'network' | 'user_rejected' | 'insufficient_funds' | 'contract' | 'unknown';
  message: string;
  originalError?: Error;
}

const createWalletError = (error: any): WalletError => {
  const message = error?.message?.toLowerCase() || '';

  if (message.includes('user rejected') || message.includes('user denied') || error.code === 4001) {
    return {
      type: 'user_rejected',
      message: 'Transaktion vom Benutzer abgebrochen',
      originalError: error
    };
  }

  if (message.includes('insufficient funds')) {
    return {
      type: 'insufficient_funds',
      message: 'Unzureichendes Guthaben für Transaktion oder Gas-Gebühren',
      originalError: error
    };
  }

  if (message.includes('network') || message.includes('connection')) {
    return {
      type: 'network',
      message: 'Netzwerk-Verbindungsproblem',
      originalError: error
    };
  }

  if (message.includes('contract') || message.includes('revert')) {
    return {
      type: 'contract',
      message: 'Smart Contract Fehler',
      originalError: error
    };
  }

  return {
    type: 'unknown',
    message: error?.message || 'Unbekannter Fehler',
    originalError: error
  };
};

interface WalletContextType {
  // Wallet State
  walletState: WalletState;

  // Connection Functions
  connectMetaMask: () => Promise<boolean>;
  connectWalletConnect: () => Promise<boolean>;
  disconnectWallet: () => void;

  // Transaction Functions
  depositUSDC: (amount: string) => Promise<CryptoTransaction | null>;
  withdrawUSDC: (amount: string) => Promise<CryptoTransaction | null>;

  // Balance Functions
  refreshBalances: () => Promise<void>;

  // Transaction History
  transactions: CryptoTransaction[];
  refreshTransactions: () => Promise<void>;

  // Loading States
  isConnecting: boolean;
  isTransacting: boolean;

  // Error Handling
  lastError: WalletError | null;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    isCorrectNetwork: false,
  });
  
  const [transactions, setTransactions] = useState<CryptoTransaction[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTransacting, setIsTransacting] = useState(false);
  const [lastError, setLastError] = useState<WalletError | null>(null);

  const clearError = () => setLastError(null);

  // Initialize provider
  const getProvider = (): ethers.BrowserProvider | null => {
    if (typeof window !== 'undefined' && window.ethereum) {
      return new ethers.BrowserProvider(window.ethereum);
    }
    return null;
  };

  // Verify contract exists
  const verifyContract = async (contractAddress: string, provider: ethers.JsonRpcProvider): Promise<boolean> => {
    try {
      const code = await provider.getCode(contractAddress);
      return code !== '0x';
    } catch (error) {
      console.error(`Error verifying contract ${contractAddress}:`, error);
      return false;
    }
  };

  // Check if connected and update state
  const checkConnection = async () => {
    const provider = getProvider();
    if (!provider) return;

    try {
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const network = await provider.getNetwork();
        
        setWalletState({
          isConnected: true,
          address,
          chainId: Number(network.chainId),
          isCorrectNetwork: Number(network.chainId) === OPTIMISM_MAINNET_CHAIN_ID,
        });

        // Load balances if on correct network
        if (Number(network.chainId) === OPTIMISM_MAINNET_CHAIN_ID) {
          await refreshBalances();
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  // Refresh wallet and vault balances
  const refreshBalances = async () => {
    if (!walletState.address || !walletState.isCorrectNetwork) return;

    try {
      const provider = new ethers.JsonRpcProvider(OPTIMISM_RPC_URL);

      // Test USDC contract first
      const usdcContract = new ethers.Contract(CONTRACTS.USDC, USDC_ABI, provider);

      console.log('Checking USDC balance for:', walletState.address);
      const usdcBalance = await usdcContract.balanceOf(walletState.address);
      console.log('USDC balance fetched:', usdcBalance.toString());

      // Check vault contract
      const vaultContract = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, provider);
      console.log('Checking vault balance for:', walletState.address);
      const vaultBalance = await vaultContract.balanceOf(walletState.address);
      console.log('Vault balance fetched:', vaultBalance.toString());

      setWalletState(prev => ({
        ...prev,
        usdcBalance: formatUSDC(usdcBalance),
        vaultBalance: formatUSDC(vaultBalance)
      }));

    } catch (error) {
      console.error('Error refreshing balances:', error);
      const walletError = createWalletError(error);
      setLastError(walletError);

      // Fallback to zero balances on error
      setWalletState(prev => ({
        ...prev,
        usdcBalance: "0.00",
        vaultBalance: "0.00"
      }));

      // Only show warning, don't fail completely
      toast.warning('Vault Contract nicht verfügbar - USDC Balance wird angezeigt');
    }
  };

  // Connect to MetaMask
  const connectMetaMask = async (): Promise<boolean> => {
    if (!window.ethereum) {
      const error = createWalletError({ message: 'MetaMask ist nicht installiert' });
      setLastError(error);
      toast.error(error.message);
      return false;
    }

    setIsConnecting(true);
    clearError();

    try {
      const provider = getProvider();
      if (!provider) return false;

      // Request account access
      await provider.send('eth_requestAccounts', []);

      // Check/Switch to Optimism
      await switchToOptimism();

      // Update connection state
      await checkConnection();

      toast.success('Wallet erfolgreich verbunden!');
      return true;

    } catch (error: any) {
      console.error('MetaMask connection error:', error);
      const walletError = createWalletError(error);
      setLastError(walletError);
      toast.error(walletError.message);
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect to WalletConnect (placeholder for now)
  const connectWalletConnect = async (): Promise<boolean> => {
    toast.info('WalletConnect wird in zukünftiger Version unterstützt');
    return false;
  };

  // Switch to Optimism network
  const switchToOptimism = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${OPTIMISM_MAINNET_CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError: any) {
      // Chain not added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${OPTIMISM_MAINNET_CHAIN_ID.toString(16)}`,
              chainName: 'Optimism',
              nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: [OPTIMISM_RPC_URL],
              blockExplorerUrls: ['https://optimistic.etherscan.io'],
            }],
          });
        } catch (addError) {
          console.error('Error adding Optimism network:', addError);
          throw addError;
        }
      } else {
        throw switchError;
      }
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setWalletState({
      isConnected: false,
      isCorrectNetwork: false,
    });
    setTransactions([]);
    toast.info('Wallet getrennt');
  };

  // Deposit USDC to vault
  const depositUSDC = async (amount: string): Promise<CryptoTransaction | null> => {
    if (!walletState.address || !walletState.isCorrectNetwork) {
      const error = createWalletError({ message: 'Wallet nicht verbunden oder falsches Netzwerk' });
      setLastError(error);
      toast.error(error.message);
      return null;
    }

    setIsTransacting(true);
    clearError();

    try {
      const provider = getProvider();
      if (!provider) {
        throw new Error('Provider nicht verfügbar');
      }

      // Verify contracts exist
      const jsonProvider = new ethers.JsonRpcProvider(OPTIMISM_RPC_URL);
      const usdcExists = await verifyContract(CONTRACTS.USDC, jsonProvider);
      const vaultExists = await verifyContract(CONTRACTS.VAULT, jsonProvider);

      if (!usdcExists) {
        throw new Error('USDC Contract nicht auf diesem Netzwerk gefunden');
      }

      if (!vaultExists) {
        throw new Error('Vault Contract nicht verfügbar');
      }

      const signer = await provider.getSigner();
      const usdcContract = new ethers.Contract(CONTRACTS.USDC, USDC_ABI, signer);
      const vaultContract = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);

      const amountBigInt = parseUSDC(amount);

      // Check balance
      const balance = await usdcContract.balanceOf(walletState.address);
      if (balance < amountBigInt) {
        const error = createWalletError({ message: 'Unzureichendes USDC-Guthaben in Ihrer Wallet' });
        setLastError(error);
        toast.error(error.message);
        return null;
      }

      // Step 1: Approve USDC
      toast.info('Genehmigung für USDC wird angefragt...');
      const approveTx = await usdcContract.approve(CONTRACTS.VAULT, amountBigInt);
      await approveTx.wait();

      // Step 2: Deposit to vault
      toast.info('Einzahlung wird verarbeitet...');
      const depositTx = await vaultContract.deposit(amountBigInt);
      const receipt = await depositTx.wait();

      // Create transaction record
      const transaction: CryptoTransaction = {
        id: `deposit_${Date.now()}`,
        userId: '', // Will be set by backend
        type: 'crypto_deposit',
        status: 'completed',
        amount: parseFloat(amount),
        amountDisplay: `${amount} USDC`,
        walletAddress: walletState.address,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
        gasPrice: receipt.gasPrice?.toString(),
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      // Notify backend
      await fetch('/api/crypto/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify({
          txHash: receipt.hash,
          amount: parseFloat(amount),
          walletAddress: walletState.address
        })
      });

      // Refresh balances
      await refreshBalances();
      await refreshTransactions();

      toast.success(`${amount} USDC erfolgreich eingezahlt!`);
      return transaction;

    } catch (error: any) {
      console.error('Deposit error:', error);
      const walletError = createWalletError(error);
      setLastError(walletError);
      toast.error(walletError.message);
      return null;
    } finally {
      setIsTransacting(false);
    }
  };

  // Withdraw USDC from vault
  const withdrawUSDC = async (amount: string): Promise<CryptoTransaction | null> => {
    if (!walletState.address || !walletState.isCorrectNetwork) {
      const error = createWalletError({ message: 'Wallet nicht verbunden oder falsches Netzwerk' });
      setLastError(error);
      toast.error(error.message);
      return null;
    }

    setIsTransacting(true);
    clearError();

    try {
      const provider = getProvider();
      if (!provider) {
        throw new Error('Provider nicht verfügbar');
      }

      // Verify vault contract exists
      const jsonProvider = new ethers.JsonRpcProvider(OPTIMISM_RPC_URL);
      const vaultExists = await verifyContract(CONTRACTS.VAULT, jsonProvider);

      if (!vaultExists) {
        throw new Error('Vault Contract nicht verfügbar - Auszahlung nicht möglich');
      }

      const signer = await provider.getSigner();
      const vaultContract = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, signer);

      const amountBigInt = parseUSDC(amount);

      // Check vault balance
      const vaultBalance = await vaultContract.balanceOf(walletState.address);
      if (vaultBalance < amountBigInt) {
        const error = createWalletError({ message: 'Unzureichendes Guthaben im Vault' });
        setLastError(error);
        toast.error(error.message);
        return null;
      }

      // Withdraw from vault
      toast.info('Auszahlung wird verarbeitet...');
      const withdrawTx = await vaultContract.withdraw(amountBigInt);
      const receipt = await withdrawTx.wait();

      // Create transaction record
      const transaction: CryptoTransaction = {
        id: `withdrawal_${Date.now()}`,
        userId: '', // Will be set by backend
        type: 'crypto_withdrawal',
        status: 'completed',
        amount: parseFloat(amount),
        amountDisplay: `${amount} USDC`,
        walletAddress: walletState.address,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed?.toString(),
        gasPrice: receipt.gasPrice?.toString(),
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      // Notify backend
      await fetch('/api/crypto/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify({
          txHash: receipt.hash,
          amount: parseFloat(amount),
          walletAddress: walletState.address
        })
      });

      // Refresh balances
      await refreshBalances();
      await refreshTransactions();

      toast.success(`${amount} USDC erfolgreich ausgezahlt!`);
      return transaction;

    } catch (error: any) {
      console.error('Withdrawal error:', error);
      const walletError = createWalletError(error);
      setLastError(walletError);
      toast.error(walletError.message);
      return null;
    } finally {
      setIsTransacting(false);
    }
  };

  // Refresh transaction history
  const refreshTransactions = async () => {
    try {
      const response = await fetch('/api/crypto/transactions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          checkConnection();
        }
      };

      const handleChainChanged = () => {
        checkConnection();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      // Check initial connection
      checkConnection();

      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const value: WalletContextType = {
    walletState,
    connectMetaMask,
    connectWalletConnect,
    disconnectWallet,
    depositUSDC,
    withdrawUSDC,
    refreshBalances,
    transactions,
    refreshTransactions,
    isConnecting,
    isTransacting,
    lastError,
    clearError,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
