import { ethers } from "ethers";
import { 
  VaultEvent,
  CONTRACTS, 
  VAULT_ABI,
  OPTIMISM_RPC_URL,
  formatUSDC
} from "../../shared/contracts";
import { processVaultEvent } from "../routes/crypto";

export class EventListenerService {
  private provider: ethers.JsonRpcProvider;
  private vaultContract: ethers.Contract;
  private isListening = false;
  private currentBlock = 0;
  private checkInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private readonly POLL_INTERVAL = 5000; // 5 seconds
  private readonly BATCH_SIZE = 1000; // Process 1000 blocks at a time
  private readonly MAX_RETRIES = 3;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(OPTIMISM_RPC_URL);
    this.vaultContract = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, this.provider);
    
    console.log(`🔗 EventListenerService initialized`);
    console.log(`📋 Vault Contract: ${CONTRACTS.VAULT}`);
    console.log(`🌐 RPC URL: ${OPTIMISM_RPC_URL}`);
  }

  // Start listening for events
  async startListening(): Promise<void> {
    if (this.isListening) {
      console.log("⚠️ Event listener is already running");
      return;
    }

    try {
      // Get current block number
      this.currentBlock = await this.provider.getBlockNumber();
      console.log(`🏁 Starting event listener from block: ${this.currentBlock}`);
      
      this.isListening = true;
      
      // Start the polling loop
      this.checkInterval = setInterval(() => {
        this.checkForNewEvents().catch(error => {
          console.error("Error in event polling:", error);
        });
      }, this.POLL_INTERVAL);
      
      console.log(`✅ Event listener started, polling every ${this.POLL_INTERVAL}ms`);
      
    } catch (error) {
      console.error("Failed to start event listener:", error);
      throw error;
    }
  }

  // Stop listening for events
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isListening = false;
    console.log("🛑 Event listener stopped");
  }

  // Check for new events since last check
  private async checkForNewEvents(): Promise<void> {
    if (!this.isListening) return;

    try {
      const latestBlock = await this.provider.getBlockNumber();
      
      if (latestBlock <= this.currentBlock) {
        // No new blocks, nothing to do
        return;
      }

      const fromBlock = this.currentBlock + 1;
      const toBlock = Math.min(latestBlock, fromBlock + this.BATCH_SIZE - 1);

      console.log(`🔍 Checking for events in blocks ${fromBlock} to ${toBlock}`);

      await this.processBlockRange(fromBlock, toBlock);
      
      this.currentBlock = toBlock;
      
      if (toBlock < latestBlock) {
        // There are more blocks to process, schedule immediate check
        setTimeout(() => this.checkForNewEvents(), 100);
      }

    } catch (error) {
      console.error("Error checking for new events:", error);
    }
  }

  // Process events in a specific block range
  private async processBlockRange(fromBlock: number, toBlock: number): Promise<void> {
    let retryCount = 0;
    
    while (retryCount < this.MAX_RETRIES) {
      try {
        // Get Deposited events
        const depositFilter = this.vaultContract.filters.Deposited();
        const depositEvents = await this.vaultContract.queryFilter(
          depositFilter, 
          fromBlock, 
          toBlock
        );

        // Get Withdrawn events
        const withdrawFilter = this.vaultContract.filters.Withdrawn();
        const withdrawEvents = await this.vaultContract.queryFilter(
          withdrawFilter, 
          fromBlock, 
          toBlock
        );

        // Process all events
        const allEvents = [...depositEvents, ...withdrawEvents];
        
        if (allEvents.length > 0) {
          console.log(`📨 Found ${allEvents.length} vault events in blocks ${fromBlock}-${toBlock}`);
          
          for (const event of allEvents) {
            await this.processEvent(event);
          }
        }

        return; // Success, exit retry loop
        
      } catch (error) {
        retryCount++;
        console.error(`Error processing block range ${fromBlock}-${toBlock} (attempt ${retryCount}):`, error);
        
        if (retryCount >= this.MAX_RETRIES) {
          console.error(`❌ Failed to process block range ${fromBlock}-${toBlock} after ${this.MAX_RETRIES} attempts`);
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }

  // Process a single event
  private async processEvent(event: ethers.Log): Promise<void> {
    try {
      const parsedLog = this.vaultContract.interface.parseLog({
        topics: event.topics,
        data: event.data
      });

      if (!parsedLog) {
        console.warn("Could not parse vault event:", event);
        return;
      }

      // Get block timestamp
      const block = await this.provider.getBlock(event.blockNumber);
      if (!block) {
        console.warn(`Could not get block ${event.blockNumber}`);
        return;
      }

      let vaultEvent: VaultEvent | null = null;

      if (parsedLog.name === 'Deposited') {
        vaultEvent = {
          type: 'Deposited',
          user: parsedLog.args.user,
          amount: parsedLog.args.amount.toString(),
          timestamp: block.timestamp,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          logIndex: event.index
        };

        const usdcAmount = formatUSDC(parsedLog.args.amount);
        console.log(`💰 Deposit event: ${parsedLog.args.user} deposited ${usdcAmount} USDC`);
        
      } else if (parsedLog.name === 'Withdrawn') {
        vaultEvent = {
          type: 'Withdrawn',
          user: parsedLog.args.user,
          amount: parsedLog.args.amount.toString(),
          timestamp: block.timestamp,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          logIndex: event.index
        };

        const usdcAmount = formatUSDC(parsedLog.args.amount);
        console.log(`💸 Withdrawal event: ${parsedLog.args.user} withdrew ${usdcAmount} USDC`);
      }

      // Process the event
      if (vaultEvent) {
        await processVaultEvent(vaultEvent);
      }

    } catch (error) {
      console.error("Error processing individual event:", error);
    }
  }

  // Get current status
  getStatus(): { isListening: boolean; currentBlock: number; contractAddress: string } {
    return {
      isListening: this.isListening,
      currentBlock: this.currentBlock,
      contractAddress: CONTRACTS.VAULT
    };
  }

  // Manual sync from a specific block (useful for catching up)
  async syncFromBlock(fromBlock: number): Promise<void> {
    const latestBlock = await this.provider.getBlockNumber();
    
    console.log(`🔄 Manual sync from block ${fromBlock} to ${latestBlock}`);
    
    if (fromBlock >= latestBlock) {
      console.log("No blocks to sync");
      return;
    }

    // Process in batches
    let currentFrom = fromBlock;
    
    while (currentFrom <= latestBlock) {
      const currentTo = Math.min(currentFrom + this.BATCH_SIZE - 1, latestBlock);
      
      await this.processBlockRange(currentFrom, currentTo);
      
      currentFrom = currentTo + 1;
      
      // Small delay to avoid overwhelming the RPC
      if (currentFrom <= latestBlock) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    this.currentBlock = latestBlock;
    console.log(`✅ Manual sync completed, now at block ${latestBlock}`);
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; latestBlock?: number; error?: string }> {
    try {
      const latestBlock = await this.provider.getBlockNumber();
      return { healthy: true, latestBlock };
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }
}

// Singleton instance
export const eventListenerService = new EventListenerService();
