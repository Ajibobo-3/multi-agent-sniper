import {
  createPublicClient,
  http,
  webSocket,
  parseAbiItem,
  defineChain,
  type PublicClient,
  type Address,
} from 'viem';
import { CONFIG } from '../../config/index.js';
import { eventBus } from '../../bus/eventBus.js';
import { TokenDetectedEvent } from '../../types/index.js';

/**
 * Robinhood Chain (EVM Chain ID: 4663) Listener
 *
 * Watches DEX factory PairCreated events via WebSocket push + HTTP block polling fallback.
 * All RBC detections route to Stream A (Trenches).
 */

export const robinhoodChain = defineChain({
  id: CONFIG.RBC.CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Robinhood Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: [CONFIG.RBC.RPC_URL],
      webSocket: [CONFIG.RBC.WSS_URL],
    },
  },
});

export class RbcListener {
  private client: PublicClient | null = null;
  private isRunning: boolean = false;
  private pollIntervalTimer: NodeJS.Timeout | null = null;
  private lastProcessedBlock: bigint = 0n;

  private pairCreatedEventAbi = parseAbiItem(
    'event PairCreated(address indexed token0, address indexed token1, address pair, uint256 allPairsLength)'
  );

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    try {
      if (CONFIG.RBC.WSS_URL && CONFIG.RBC.WSS_URL.startsWith('ws')) {
        this.client = createPublicClient({
          chain: robinhoodChain,
          transport: webSocket(CONFIG.RBC.WSS_URL, { retryCount: 5, retryDelay: 2000 }),
        });
        console.log('[RbcListener] Viem client initialized (WebSocket transport).');
      } else {
        throw new Error('Falling back to HTTP.');
      }
    } catch {
      this.client = createPublicClient({
        chain: robinhoodChain,
        transport: http(CONFIG.RBC.RPC_URL),
      });
      console.log('[RbcListener] Viem client initialized (HTTP polling transport).');
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(
      `[RbcListener] Starting Robinhood Chain (ID: ${CONFIG.RBC.CHAIN_ID}) factory listener...`
    );

    await this.listenPairCreated();
    this.startBlockPoller();
  }

  private async listenPairCreated(): Promise<void> {
    if (!this.client) return;

    try {
      this.client.watchEvent({
        event: this.pairCreatedEventAbi,
        onLogs: (logs) => {
          const detectedAtMs = Date.now();
          const detectedAtUs = process.hrtime.bigint();

          for (const log of logs) {
            const { token0, token1, pair } = log.args as {
              token0: Address;
              token1: Address;
              pair: Address;
            };

            const targetToken = this.identifyTargetToken(token0, token1);
            const quoteToken =
              targetToken.toLowerCase() === token0.toLowerCase() ? token1 : token0;

            const event: TokenDetectedEvent = {
              chain: 'rbc',
              stream: 'A',
              tokenAddress: targetToken,
              poolAddress: pair,
              quoteAddress: quoteToken,
              source: 'rbc_factory',
              detectedAtMs,
              detectedAtUs,
              metadata: { txHash: log.transactionHash },
            };

            console.log(
              `⚡ [RbcListener] [Stream A: Trenches] New pair: ${pair} Token: ${targetToken}`
            );
            eventBus.emit('token:detected', event);
            eventBus.emit('token:detected:streamA', event);
          }
        },
        onError: (error) => {
          console.warn('[RbcListener] watchEvent error (fallback to polling):', error.message);
        },
      });
    } catch (err: any) {
      console.warn('[RbcListener] watchEvent not supported, relying on block polling:', err.message);
    }
  }

  private startBlockPoller(): void {
    const poll = async () => {
      if (!this.isRunning || !this.client) return;

      try {
        const currentBlock = await this.client.getBlockNumber();

        if (this.lastProcessedBlock === 0n) {
          this.lastProcessedBlock = currentBlock;
        } else if (currentBlock > this.lastProcessedBlock) {
          const logs = await this.client.getLogs({
            fromBlock: this.lastProcessedBlock + 1n,
            toBlock: currentBlock,
            event: this.pairCreatedEventAbi,
          });

          const detectedAtMs = Date.now();
          const detectedAtUs = process.hrtime.bigint();

          for (const log of logs) {
            const { token0, token1, pair } = log.args as {
              token0: Address;
              token1: Address;
              pair: Address;
            };

            const targetToken = this.identifyTargetToken(token0, token1);
            const quoteToken =
              targetToken.toLowerCase() === token0.toLowerCase() ? token1 : token0;

            const event: TokenDetectedEvent = {
              chain: 'rbc',
              stream: 'A',
              tokenAddress: targetToken,
              poolAddress: pair,
              quoteAddress: quoteToken,
              source: 'rbc_factory',
              detectedAtMs,
              detectedAtUs,
              metadata: { txHash: log.transactionHash },
            };

            console.log(
              `⚡ [RbcListener] [Block Poller] Pair: ${pair} Token: ${targetToken}`
            );
            eventBus.emit('token:detected', event);
            eventBus.emit('token:detected:streamA', event);
          }

          this.lastProcessedBlock = currentBlock;
        }
      } catch {
        // Non-blocking — swallow RPC timeouts
      }

      if (this.isRunning) {
        this.pollIntervalTimer = setTimeout(poll, 1000);
      }
    };

    poll();
  }

  private identifyTargetToken(token0: Address, token1: Address): Address {
    const knownBases = [
      CONFIG.RBC.WRAPPED_NATIVE_TOKEN.toLowerCase(),
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
    ];

    return knownBases.includes(token0.toLowerCase()) ? token1 : token0;
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.pollIntervalTimer) {
      clearTimeout(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }
    console.log('[RbcListener] RBC listener stopped.');
  }
}
