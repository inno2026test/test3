import { RequestHandler } from "express";
import { ethers } from "ethers";
import { 
  CryptoTransaction,
  VaultEvent,
  CONTRACTS, 
  VAULT_ABI, 
  USDC_ABI,
  OPTIMISM_RPC_URL,
  formatUSDC,
  isValidAddress
} from "../../shared/contracts";
import { getUserById, updateUserBalance } from "../data/users";

// In-memory storage for crypto transactions (in production: use database)
const cryptoTransactions: Map<string, CryptoTransaction> = new Map();

// Provider for reading blockchain data
const provider = new ethers.JsonRpcProvider(OPTIMISM_RPC_URL);

// Contracts for reading data
const vaultContract = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, provider);
const usdcContract = new ethers.Contract(CONTRACTS.USDC, USDC_ABI, provider);

// Track processed events to avoid duplicates
const processedEvents: Set<string> = new Set();

// Helper to generate unique event ID
const getEventId = (txHash: string, logIndex: number): string => {
  return `${txHash}_${logIndex}`;
};

// Helper to convert USDC wei to display amount
const convertUSDCAmount = (weiAmount: string): number => {
  return parseFloat(formatUSDC(BigInt(weiAmount)));
};

// Store crypto transaction
export const storeCryptoTransaction = (transaction: CryptoTransaction): void => {
  cryptoTransactions.set(transaction.id, transaction);
};

// Get user's crypto transactions
export const getUserCryptoTransactions = (userId: string): CryptoTransaction[] => {
  return Array.from(cryptoTransactions.values())
    .filter(tx => tx.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

// Process vault events and sync with database
export const processVaultEvent = async (event: VaultEvent): Promise<void> => {
  const eventId = getEventId(event.transactionHash, event.logIndex);
  
  // Skip if already processed
  if (processedEvents.has(eventId)) {
    return;
  }

  try {
    const amount = convertUSDCAmount(event.amount);
    
    // Find user by wallet address (assuming wallet address is stored in user data)
    // This is a simplified approach - in production you'd have a mapping table
    const user = await findUserByWalletAddress(event.user);
    
    if (!user) {
      console.warn(`No user found for wallet address: ${event.user}`);
      return;
    }

    if (event.type === 'Deposited') {
      // Update user balance - add deposited amount
      const newBalance = user.balance + amount;
      updateUserBalance(user.id, newBalance);
      
      console.log(`✅ Deposit processed: +${amount} USDC for user ${user.email}`);
      
      // Store transaction record
      const transaction: CryptoTransaction = {
        id: `deposit_${event.transactionHash}_${event.logIndex}`,
        userId: user.id,
        type: 'crypto_deposit',
        status: 'completed',
        amount,
        amountDisplay: `${amount.toFixed(2)} USDC`,
        walletAddress: event.user,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        createdAt: new Date(event.timestamp * 1000).toISOString(),
        completedAt: new Date().toISOString(),
      };
      
      storeCryptoTransaction(transaction);
      
    } else if (event.type === 'Withdrawn') {
      // Update user balance - subtract withdrawn amount
      const newBalance = Math.max(0, user.balance - amount);
      updateUserBalance(user.id, newBalance);
      
      console.log(`✅ Withdrawal processed: -${amount} USDC for user ${user.email}`);
      
      // Store transaction record
      const transaction: CryptoTransaction = {
        id: `withdrawal_${event.transactionHash}_${event.logIndex}`,
        userId: user.id,
        type: 'crypto_withdrawal',
        status: 'completed',
        amount,
        amountDisplay: `${amount.toFixed(2)} USDC`,
        walletAddress: event.user,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        createdAt: new Date(event.timestamp * 1000).toISOString(),
        completedAt: new Date().toISOString(),
      };
      
      storeCryptoTransaction(transaction);
    }
    
    // Mark event as processed
    processedEvents.add(eventId);
    
  } catch (error) {
    console.error(`Error processing vault event:`, error);
  }
};

// Helper to find user by wallet address
const findUserByWalletAddress = async (walletAddress: string): Promise<any> => {
  // This is a simplified approach - in production you'd have a proper mapping
  // For now, we'll need to scan through users or maintain a wallet->user mapping
  const { getAllUsers } = await import("../data/users");
  const users = getAllUsers();
  
  return users.find(user => 
    user.walletAddress && 
    user.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );
};

// API Routes

// Handle crypto deposit notification from frontend
export const handleCryptoDeposit: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    const { txHash, amount, walletAddress } = req.body;

    if (!user) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    if (!txHash || !amount || !walletAddress) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: txHash, amount, walletAddress" 
      });
    }

    if (!isValidAddress(walletAddress)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid wallet address" 
      });
    }

    // Verify the transaction on blockchain
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return res.status(400).json({ 
          success: false, 
          error: "Transaction not found on blockchain" 
        });
      }

      if (!receipt.status) {
        return res.status(400).json({ 
          success: false, 
          error: "Transaction failed on blockchain" 
        });
      }

      // Parse vault events from the transaction
      const vaultEvents = receipt.logs
        .filter(log => log.address.toLowerCase() === CONTRACTS.VAULT.toLowerCase())
        .map(log => {
          try {
            const parsedLog = vaultContract.interface.parseLog({
              topics: log.topics,
              data: log.data
            });
            
            if (parsedLog && parsedLog.name === 'Deposited') {
              return {
                type: 'Deposited' as const,
                user: parsedLog.args.user,
                amount: parsedLog.args.amount.toString(),
                timestamp: Math.floor(Date.now() / 1000), // Use current time as fallback
                transactionHash: txHash,
                blockNumber: receipt.blockNumber,
                logIndex: log.index
              };
            }
            return null;
          } catch (error) {
            console.warn("Failed to parse log:", error);
            return null;
          }
        })
        .filter(event => event !== null) as VaultEvent[];

      // Process the events
      for (const event of vaultEvents) {
        await processVaultEvent(event);
      }

      res.json({ 
        success: true, 
        message: "Deposit processed successfully",
        txHash,
        amount
      });

    } catch (blockchainError) {
      console.error("Blockchain verification error:", blockchainError);
      res.status(500).json({ 
        success: false, 
        error: "Failed to verify transaction on blockchain" 
      });
    }

  } catch (error) {
    console.error("Crypto deposit error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

// Handle crypto withdrawal notification from frontend
export const handleCryptoWithdraw: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;
    const { txHash, amount, walletAddress } = req.body;

    if (!user) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    if (!txHash || !amount || !walletAddress) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: txHash, amount, walletAddress" 
      });
    }

    if (!isValidAddress(walletAddress)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid wallet address" 
      });
    }

    // Verify the transaction on blockchain
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return res.status(400).json({ 
          success: false, 
          error: "Transaction not found on blockchain" 
        });
      }

      if (!receipt.status) {
        return res.status(400).json({ 
          success: false, 
          error: "Transaction failed on blockchain" 
        });
      }

      // Parse vault events from the transaction
      const vaultEvents = receipt.logs
        .filter(log => log.address.toLowerCase() === CONTRACTS.VAULT.toLowerCase())
        .map(log => {
          try {
            const parsedLog = vaultContract.interface.parseLog({
              topics: log.topics,
              data: log.data
            });
            
            if (parsedLog && parsedLog.name === 'Withdrawn') {
              return {
                type: 'Withdrawn' as const,
                user: parsedLog.args.user,
                amount: parsedLog.args.amount.toString(),
                timestamp: Math.floor(Date.now() / 1000),
                transactionHash: txHash,
                blockNumber: receipt.blockNumber,
                logIndex: log.index
              };
            }
            return null;
          } catch (error) {
            console.warn("Failed to parse log:", error);
            return null;
          }
        })
        .filter(event => event !== null) as VaultEvent[];

      // Process the events
      for (const event of vaultEvents) {
        await processVaultEvent(event);
      }

      res.json({ 
        success: true, 
        message: "Withdrawal processed successfully",
        txHash,
        amount
      });

    } catch (blockchainError) {
      console.error("Blockchain verification error:", blockchainError);
      res.status(500).json({ 
        success: false, 
        error: "Failed to verify transaction on blockchain" 
      });
    }

  } catch (error) {
    console.error("Crypto withdrawal error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

// Get user's crypto transaction history
export const getCryptoTransactions: RequestHandler = (req, res) => {
  try {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const transactions = getUserCryptoTransactions(user.id);

    res.json({ 
      success: true, 
      transactions 
    });

  } catch (error) {
    console.error("Get crypto transactions error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch transactions" 
    });
  }
};

// Get vault and wallet balances for a user
export const getCryptoBalances: RequestHandler = async (req, res) => {
  try {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    if (!user.walletAddress) {
      return res.json({ 
        success: true, 
        balances: {
          usdcWallet: "0.00",
          usdcVault: "0.00",
          hasWallet: false
        }
      });
    }

    try {
      const [usdcBalance, vaultBalance] = await Promise.all([
        usdcContract.balanceOf(user.walletAddress),
        vaultContract.balanceOf(user.walletAddress)
      ]);

      res.json({ 
        success: true, 
        balances: {
          usdcWallet: formatUSDC(usdcBalance),
          usdcVault: formatUSDC(vaultBalance),
          hasWallet: true,
          walletAddress: user.walletAddress
        }
      });

    } catch (blockchainError) {
      console.error("Blockchain balance error:", blockchainError);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch blockchain balances" 
      });
    }

  } catch (error) {
    console.error("Get crypto balances error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
};

// Health check for crypto service
export const getCryptoStatus: RequestHandler = async (req, res) => {
  try {
    // Check if we can connect to the blockchain
    const latestBlock = await provider.getBlockNumber();
    
    // Check contract accessibility
    const vaultToken = await vaultContract.token();
    
    res.json({ 
      success: true, 
      status: "healthy",
      data: {
        latestBlock,
        vaultContract: CONTRACTS.VAULT,
        usdcContract: CONTRACTS.USDC,
        vaultToken,
        network: "Optimism Mainnet"
      }
    });

  } catch (error) {
    console.error("Crypto status check error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Crypto service unavailable",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
