import { ScoutPair, PositionOrder } from '../types/index.js';
import { CONFIG } from '../config/index.js';
import { walletManager } from '../execution/walletManager.js';
import { jitoExecutor } from '../execution/jitoExecutor.js';

/**
 * 4. EXECUTOR (The Position Sizer)
 *
 * Rules:
 * - Position Sizing: Allocate a maximum of 8% of the current balance per trade.
 * - Single Entry Rule: Exactly one entry per coin. Never average down.
 * - Inaction Rule: If nothing passes filter/analyst score, do nothing. An empty night is explicitly permitted.
 */
export class ExecutorAgent {
  private activeCoinEntries: Set<string> = new Set();
  private currentPaperBalanceSol: number = CONFIG.EXECUTOR.DEFAULT_PAPER_BALANCE_SOL;

  public setPaperBalance(balance: number): void {
    this.currentPaperBalanceSol = balance;
  }

  public getPaperBalance(): number {
    return this.currentPaperBalanceSol;
  }

  public async getAvailableBalance(): Promise<number> {
    if (CONFIG.EXECUTION_MODE === 'LIVE') {
      const liveBal = await walletManager.getSolanaBalance();
      return liveBal > 0 ? liveBal : this.currentPaperBalanceSol;
    }
    return this.currentPaperBalanceSol;
  }

  public async executeEntry(pair: ScoutPair): Promise<PositionOrder | null> {
    const token = pair.baseToken.address;
    const symbol = pair.baseToken.symbol;

    // SINGLE ENTRY RULE: Exactly one entry per coin. Never average down.
    if (this.activeCoinEntries.has(token)) {
      console.warn(`🛑 [4. EXECUTOR] Inaction: Token ${symbol} already has an active entry. Single entry rule enforced.`);
      return null;
    }

    const currentBalance = await this.getAvailableBalance();

    // 8% MAX POSITION SIZING: Allocate maximum 8% of current balance
    const maxAllocPct = CONFIG.EXECUTOR.MAX_POSITION_PCT_OF_BALANCE; // 0.08
    const allocatedSol = currentBalance * maxAllocPct;

    if (allocatedSol <= 0) {
      console.warn(`🛑 [4. EXECUTOR] Inaction: Insufficient balance (${currentBalance} SOL) to size position.`);
      return null;
    }

    const solPriceUsd = CONFIG.EXECUTOR.SOL_PRICE_ESTIMATE_USD;
    const allocatedCapitalUsd = allocatedSol * solPriceUsd;

    const entryPriceUsd = pair.priceUsd > 0 ? pair.priceUsd : 0.00001;
    const tokensBought = allocatedCapitalUsd / entryPriceUsd;

    const orderId = `ord_${pair.chain}_${token.slice(0, 6)}_${Date.now()}`;

    const order: PositionOrder = {
      orderId,
      tokenAddress: token,
      tokenSymbol: symbol,
      chain: pair.chain,
      allocatedCapitalNative: Number(allocatedSol.toFixed(6)),
      allocatedCapitalUsd: Number(allocatedCapitalUsd.toFixed(4)),
      entryPriceUsd,
      tokensBought,
      currentBalanceBeforeTrade: currentBalance,
      timestamp: new Date().toISOString(),
    };

    // Mark coin as active to prevent duplicate entries
    this.activeCoinEntries.add(token);

    // In paper mode, deduct allocated capital from available paper balance
    if (CONFIG.EXECUTION_MODE === 'PAPER') {
      this.currentPaperBalanceSol = Math.max(0, this.currentPaperBalanceSol - allocatedSol);
    } else if (CONFIG.EXECUTION_MODE === 'LIVE' && pair.chain === 'solana') {
      // Live execution via Jito bundle
      jitoExecutor.executeLiveBuy(token, allocatedSol).catch((err) => {
        console.error('[ExecutorAgent] Live Jito buy failed:', err);
      });
    }

    console.log(`\n⚡ [4. EXECUTOR] Position Sized & Order Placed!`);
    console.log(`    Token: ${symbol} | Size: ${order.allocatedCapitalNative} SOL ($${order.allocatedCapitalUsd}) [8% of ${currentBalance.toFixed(4)} SOL]`);
    console.log(`    Entry Price: $${entryPriceUsd} | Tokens: ${Math.round(tokensBought).toLocaleString()}`);

    return order;
  }

  public releaseCoinEntry(tokenAddress: string, returnedCapitalSol: number): void {
    this.activeCoinEntries.delete(tokenAddress);
    if (CONFIG.EXECUTION_MODE === 'PAPER') {
      this.currentPaperBalanceSol += returnedCapitalSol;
    }
  }
}

export const executorAgent = new ExecutorAgent();
