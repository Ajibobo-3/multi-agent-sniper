import WebSocket from 'ws';
import { Connection, PublicKey } from '@solana/web3.js';
import { CONFIG } from '../../config/index.js';
import { eventBus } from '../../bus/eventBus.js';
import { TokenDetectedEvent, StreamId } from '../../types/index.js';

/**
 * Solana Listener — high-speed event ingestion from PumpPortal and Raydium.
 *
 * Routes detections into two concurrent asynchronous streams:
 *   Stream A ("The Trenches"): ALL new pool initializations. Rapid 2x flips.
 *   Stream B ("The Alpha Hunters"): Raydium migrations (bonding curve completions)
 *                                    OR buys from SMART_MONEY_WALLETS array.
 */
export class SolanaListener {
  private pumpPortalWs: WebSocket | null = null;
  private solanaConnection: Connection | null = null;
  private raydiumSubId: number | null = null;
  private smartMoneySubIds: number[] = [];
  private isRunning: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectDelay: number = 10_000;

  constructor() {
    this.solanaConnection = new Connection(CONFIG.SOLANA.RPC_URL, {
      wsEndpoint: CONFIG.SOLANA.WSS_URL,
      commitment: 'processed',
    });
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[SolanaListener] Initializing dual-stream Solana listener...');

    // Stream A + B source: PumpPortal WebSocket for new token launches
    this.connectPumpPortal();

    // Stream A + B source: Raydium AMM V4 log subscriptions
    this.listenRaydiumPools();

    // Stream B source: Smart money wallet tracking
    this.listenSmartMoneyWallets();
  }

  // ─────────────────────────────────────────────────────────────
  //  PUMP PORTAL (Stream A: all tokens | Stream B: migrations)
  // ─────────────────────────────────────────────────────────────

  private connectPumpPortal(): void {
    if (!this.isRunning) return;

    try {
      console.log(`[SolanaListener] Connecting to PumpPortal at ${CONFIG.SOLANA.PUMP_PORTAL_WSS}...`);
      this.pumpPortalWs = new WebSocket(CONFIG.SOLANA.PUMP_PORTAL_WSS);

      this.pumpPortalWs.on('open', () => {
        console.log('[SolanaListener] ✓ Connected to PumpPortal WebSocket.');
        this.reconnectAttempts = 0;

        // Subscribe to new token creations (Stream A)
        this.pumpPortalWs?.send(JSON.stringify({ method: 'subscribeNewToken' }));

        // Subscribe to Raydium migration events (Stream B)
        this.pumpPortalWs?.send(JSON.stringify({ method: 'subscribeTokenTrade' }));
      });

      this.pumpPortalWs.on('message', (data: WebSocket.Data) => {
        const detectedAtMs = Date.now();
        const detectedAtUs = process.hrtime.bigint();

        try {
          const parsed = JSON.parse(data.toString());

          // Check for Raydium migration (Stream B) — bonding curve completion
          if (parsed.txType === 'migration' || parsed.pool === 'raydium') {
            this.emitTokenEvent({
              chain: 'solana',
              stream: 'B',
              tokenAddress: parsed.mint,
              poolAddress: parsed.pool || parsed.mint,
              quoteAddress: 'So11111111111111111111111111111111111111112',
              source: 'raydium_migration',
              detectedAtMs,
              detectedAtUs,
              metadata: {
                name: parsed.name,
                symbol: parsed.symbol,
                txHash: parsed.signature,
              },
            });
            return;
          }

          // Standard new token creation (Stream A)
          if (parsed.mint) {
            this.emitTokenEvent({
              chain: 'solana',
              stream: 'A',
              tokenAddress: parsed.mint,
              poolAddress: parsed.bondingCurve || parsed.mint,
              quoteAddress: 'So11111111111111111111111111111111111111112',
              initialLiquiditySolOrEth: parsed.vSolInBondingCurve
                ? parsed.vSolInBondingCurve / 1e9
                : undefined,
              initialLiquidityTokens: parsed.vTokensInBondingCurve
                ? parsed.vTokensInBondingCurve / 1e6
                : undefined,
              source: 'pumpportal',
              detectedAtMs,
              detectedAtUs,
              metadata: {
                name: parsed.name,
                symbol: parsed.symbol,
                deployer: parsed.traderPublicKey,
                txHash: parsed.signature,
              },
            });
          }
        } catch {
          // Silent parse failure — don't block the event loop
        }
      });

      this.pumpPortalWs.on('close', () => {
        console.warn('[SolanaListener] PumpPortal WebSocket disconnected. Reconnecting...');
        this.handleReconnect();
      });

      this.pumpPortalWs.on('error', (err) => {
        console.error('[SolanaListener] PumpPortal WebSocket error:', err.message);
        this.pumpPortalWs?.close();
      });
    } catch {
      this.handleReconnect();
    }
  }

  private handleReconnect(): void {
    if (!this.isRunning) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    setTimeout(() => this.connectPumpPortal(), delay);
  }

  // ─────────────────────────────────────────────────────────────
  //  RAYDIUM AMM V4 LOG SUBSCRIPTION (Stream A: init pools)
  // ─────────────────────────────────────────────────────────────

  private listenRaydiumPools(): void {
    if (!this.solanaConnection) return;

    try {
      const raydiumProgram = new PublicKey(CONFIG.SOLANA.RAYDIUM_AMM_PROGRAM_ID);
      console.log(
        `[SolanaListener] Subscribing to Raydium AMM logs: ${raydiumProgram.toBase58()}...`
      );

      this.raydiumSubId = this.solanaConnection.onLogs(
        raydiumProgram,
        async (logs, _ctx) => {
          const detectedAtMs = Date.now();
          const detectedAtUs = process.hrtime.bigint();

          if (logs.err) return;

          const isInitialize = logs.logs.some(
            (l) => l.includes('initialize2') || l.includes('InitializeInstruction2')
          );
          if (!isInitialize || !logs.signature) return;

          console.log(
            `⚡ [SolanaListener] Raydium pool init detected: ${logs.signature.slice(0, 16)}...`
          );

          try {
            const parsedTx = await this.solanaConnection?.getParsedTransaction(logs.signature, {
              maxSupportedTransactionVersion: 0,
              commitment: 'confirmed',
            });

            if (!parsedTx?.meta || parsedTx.meta.err) return;

            const WSOL = 'So11111111111111111111111111111111111111112';
            const tokenBalance = (parsedTx.meta.postTokenBalances || []).find(
              (b) => b.mint !== WSOL
            );

            if (tokenBalance?.mint) {
              this.emitTokenEvent({
                chain: 'solana',
                stream: 'A',
                tokenAddress: tokenBalance.mint,
                poolAddress: logs.signature,
                quoteAddress: WSOL,
                source: 'raydium',
                detectedAtMs,
                detectedAtUs,
                metadata: { txHash: logs.signature },
              });
            }
          } catch {
            // Swallow RPC rate limit errors silently
          }
        },
        'processed'
      );
    } catch (err: any) {
      console.error('[SolanaListener] Failed to subscribe to Raydium logs:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  SMART MONEY WALLETS (Stream B)
  // ─────────────────────────────────────────────────────────────

  private listenSmartMoneyWallets(): void {
    if (!this.solanaConnection || CONFIG.SMART_MONEY_WALLETS.length === 0) {
      console.log('[SolanaListener] No smart money wallets configured for Stream B.');
      return;
    }

    console.log(
      `[SolanaListener] Subscribing to ${CONFIG.SMART_MONEY_WALLETS.length} smart money wallets (Stream B)...`
    );

    for (const wallet of CONFIG.SMART_MONEY_WALLETS) {
      try {
        const pubkey = new PublicKey(wallet);
        const subId = this.solanaConnection.onLogs(
          pubkey,
          async (logs, _ctx) => {
            const detectedAtMs = Date.now();
            const detectedAtUs = process.hrtime.bigint();

            if (logs.err) return;

            // Look for token swap / buy instructions
            const isSwap = logs.logs.some(
              (l) =>
                l.includes('Instruction: Swap') ||
                l.includes('Instruction: SwapExactAmountIn') ||
                l.includes('Instruction: Buy')
            );

            if (!isSwap || !logs.signature) return;

            try {
              const parsedTx = await this.solanaConnection?.getParsedTransaction(logs.signature, {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed',
              });

              if (!parsedTx?.meta || parsedTx.meta.err) return;

              const WSOL = 'So11111111111111111111111111111111111111112';
              const tokenBalance = (parsedTx.meta.postTokenBalances || []).find(
                (b) => b.mint !== WSOL && b.owner === wallet
              );

              if (tokenBalance?.mint) {
                console.log(
                  `🐋 [SolanaListener] Smart money buy detected! Wallet: ${wallet.slice(0, 8)}... Token: ${tokenBalance.mint}`
                );

                this.emitTokenEvent({
                  chain: 'solana',
                  stream: 'B',
                  tokenAddress: tokenBalance.mint,
                  poolAddress: logs.signature,
                  quoteAddress: WSOL,
                  source: 'smart_money',
                  detectedAtMs,
                  detectedAtUs,
                  metadata: {
                    txHash: logs.signature,
                    smartWallet: wallet,
                  },
                });
              }
            } catch {
              // Swallow RPC errors
            }
          },
          'processed'
        );

        this.smartMoneySubIds.push(subId);
      } catch (err: any) {
        console.warn(`[SolanaListener] Failed to subscribe to wallet ${wallet}:`, err.message);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  EMIT HELPER: Routes to both global and stream-specific bus
  // ─────────────────────────────────────────────────────────────

  private emitTokenEvent(event: TokenDetectedEvent): void {
    const streamLabel = event.stream === 'A' ? 'Trenches' : 'Alpha';
    const sym = event.metadata?.symbol || event.tokenAddress.slice(0, 8);
    console.log(
      `⚡ [SolanaListener] [Stream ${event.stream}: ${streamLabel}] Token: ${sym} | Source: ${event.source}`
    );

    eventBus.emit('token:detected', event);

    if (event.stream === 'A') {
      eventBus.emit('token:detected:streamA', event);
    } else {
      eventBus.emit('token:detected:streamB', event);
    }
  }

  public async stop(): Promise<void> {
    this.isRunning = false;

    if (this.pumpPortalWs) {
      this.pumpPortalWs.close();
      this.pumpPortalWs = null;
    }

    if (this.solanaConnection) {
      if (this.raydiumSubId !== null) {
        await this.solanaConnection.removeOnLogsListener(this.raydiumSubId);
        this.raydiumSubId = null;
      }
      for (const id of this.smartMoneySubIds) {
        await this.solanaConnection.removeOnLogsListener(id);
      }
      this.smartMoneySubIds = [];
    }

    console.log('[SolanaListener] All Solana listeners stopped.');
  }
}
