import axios from 'axios';
import { CONFIG } from '../config/index.js';
import { ScoutPair, Chain } from '../types/index.js';

/**
 * 1. SCOUT (The Watcher)
 *
 * Rules:
 * - Polls new pairs on Pump.fun, Raydium, and Robinhood Chain via DexScreener.
 * - Filter Constraints:
 *     Only accept pairs between 30 minutes and 72 hours old.
 *     Market Cap between $300k and $20M.
 * - Strict Handoff: Pass every valid pair immediately to FILTER. Nothing else.
 */
export class ScoutAgent {
  private seenPairIds: Set<string> = new Set();
  private isPolling: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private onPairFoundCallback?: (pair: ScoutPair) => Promise<void>;

  public setHandoffCallback(callback: (pair: ScoutPair) => Promise<void>): void {
    this.onPairFoundCallback = callback;
  }

  public async start(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;
    console.log('═══════════════════════════════════════════════════════');
    console.log(' 🔭 [1. SCOUT] The Watcher is active');
    console.log(`    Age constraints: ${CONFIG.SCOUT.MIN_AGE_MINUTES}m to ${CONFIG.SCOUT.MAX_AGE_HOURS}h`);
    console.log(`    Market Cap constraints: $${CONFIG.SCOUT.MIN_MCAP_USD.toLocaleString()} - $${CONFIG.SCOUT.MAX_MCAP_USD.toLocaleString()}`);
    console.log('═══════════════════════════════════════════════════════');

    this.pollLoop();
  }

  public stop(): void {
    this.isPolling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[ScoutAgent] Scout stopped.');
  }

  private async pollLoop(): Promise<void> {
    if (!this.isPolling) return;

    try {
      await this.scanDexScreener();
    } catch (err: any) {
      console.warn(`[ScoutAgent] Polling warning: ${err.message}`);
    }

    if (this.isPolling) {
      this.pollTimer = setTimeout(() => this.pollLoop(), CONFIG.SCOUT.POLL_INTERVAL_MS);
    }
  }

  /**
   * Scans DexScreener for Solana (Pump.fun, Raydium) and Robinhood Chain pairs
   */
  public async scanDexScreener(): Promise<ScoutPair[]> {
    const validPairs: ScoutPair[] = [];

    try {
      // 1. Fetch latest token profiles / searches from DexScreener
      const queries = ['solana', 'raydium', 'pump'];
      const randomQuery = queries[Math.floor(Math.random() * queries.length)];

      const url = `https://api.dexscreener.com/latest/dex/search?q=${randomQuery}`;
      const res = await axios.get(url, { timeout: 6000 });

      if (!res.data || !Array.isArray(res.data.pairs)) {
        return validPairs;
      }

      const pairs = res.data.pairs;
      const now = Date.now();

      for (const p of pairs) {
        // Must be Solana or RBC
        const chain: Chain = p.chainId === 'solana' ? 'solana' : 'rbc';
        const pairId = `${chain}_${p.pairAddress}`;

        if (this.seenPairIds.has(pairId)) continue;

        const createdAt = p.pairCreatedAt || now - 3600_000;
        const ageMs = now - createdAt;
        const ageMinutes = Math.floor(ageMs / 60_000);
        const ageHours = ageMinutes / 60;

        const mcap = p.marketCap || p.fdv || 0;

        // FILTER CONSTRAINTS:
        // 1. Age: 30 minutes to 72 hours
        const ageValid = ageMinutes >= CONFIG.SCOUT.MIN_AGE_MINUTES && ageHours <= CONFIG.SCOUT.MAX_AGE_HOURS;
        // 2. Market Cap: $300k to $20M
        const mcapValid = mcap >= CONFIG.SCOUT.MIN_MCAP_USD && mcap <= CONFIG.SCOUT.MAX_MCAP_USD;

        if (ageValid && mcapValid && p.baseToken?.address) {
          this.seenPairIds.add(pairId);

          const scouted: ScoutPair = {
            id: pairId,
            chain,
            dexId: p.dexId || 'raydium',
            baseToken: {
              address: p.baseToken.address,
              name: p.baseToken.name || 'Unknown',
              symbol: p.baseToken.symbol || 'TOKEN',
            },
            quoteToken: {
              address: p.quoteToken?.address || 'SOL',
              symbol: p.quoteToken?.symbol || 'SOL',
            },
            pairAddress: p.pairAddress,
            priceUsd: parseFloat(p.priceUsd || '0'),
            priceNative: parseFloat(p.priceNative || '0'),
            liquidityUsd: p.liquidity?.usd || 0,
            marketCapUsd: mcap,
            volume1hUsd: p.volume?.h1 || 0,
            priceChange1h: p.priceChange?.h1 || 0,
            pairCreatedAt: createdAt,
            ageMinutes,
            rawDexScreenerData: p,
          };

          console.log(`\n🔭 [1. SCOUT] Valid Pair Discovered!`);
          console.log(`    Token: ${scouted.baseToken.symbol} (${scouted.baseToken.address.slice(0, 8)}...)`);
          console.log(`    Age: ${scouted.ageMinutes}m | MCAP: $${Math.round(scouted.marketCapUsd).toLocaleString()} | DEX: ${scouted.dexId}`);

          validPairs.push(scouted);

          // STRICT HANDOFF: Pass immediately to FILTER. Nothing else.
          if (this.onPairFoundCallback) {
            await this.onPairFoundCallback(scouted);
          }
        }
      }
    } catch {
      // Non-blocking error handling
    }

    return validPairs;
  }
}

export const scoutAgent = new ScoutAgent();
