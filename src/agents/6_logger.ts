import * as fs from 'fs';
import * as path from 'path';
import { CONFIG } from '../config/index.js';
import {
  KillLogRecord,
  TradeLedgerRecord,
  MorningRecap,
  KillRuleId,
  ActivePositionRisk,
  FilterResult,
  AnalystEvaluation,
} from '../types/index.js';
import { executorAgent } from './4_executor.js';

/**
 * 6. LOGGER (The Auditor)
 *
 * Rules:
 * - Kill Logging: Log every killed token with the exact rule that killed it to logs/paper_trades.jsonl.
 * - Trade Ledger: Log every active trade (entry, size, score, exit, reason).
 * - Morning Recap: Generate a daily summary containing:
 *     Total scanned, count killed by each rule, total trades,
 *     Win/Loss ratio, best/worst trade %, and final balance.
 */
export class LoggerAgent {
  private logFilePath: string;
  private morningRecapPath: string;

  private totalScannedCount: number = 0;
  private totalPassedFilterCount: number = 0;
  private totalPassedAnalystCount: number = 0;

  private killsByRuleMap: Record<KillRuleId | 'ANALYST_SCORE_UNDER_70', number> = {
    RULE_1_AUTHORITY_NOT_REVOKED: 0,
    RULE_2_LP_NOT_BURNED_OR_LOCKED: 0,
    RULE_3_LIQUIDITY_UNDER_40K: 0,
    RULE_4_VOLUME_1H_UNDER_50K: 0,
    RULE_5_TOP10_HOLDERS_OVER_25PCT: 0,
    RULE_6_DEV_WALLET_OVER_3PCT_OR_PAST_RUGS: 0,
    RULE_7_BUNDLED_LAUNCH_OVER_10PCT: 0,
    RULE_8_ALREADY_UP_80PCT_1H: 0,
    ANALYST_SCORE_UNDER_70: 0,
  };

  private recentKills: KillLogRecord[] = [];
  private tradeLedger: TradeLedgerRecord[] = [];

  private startingBalance: number = CONFIG.EXECUTOR.DEFAULT_PAPER_BALANCE_SOL;

  constructor() {
    this.logFilePath = path.resolve(CONFIG.LOGS.PAPER_TRADES_PATH);
    this.morningRecapPath = path.resolve(CONFIG.LOGS.MORNING_RECAP_PATH);
    this.ensureDirs();
  }

  private ensureDirs(): void {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  public recordScannedPair(): void {
    this.totalScannedCount++;
  }

  /**
   * Log token killed by FILTER (The 8 Zero-Tolerance Rules)
   */
  public logFilterKill(filterResult: FilterResult): void {
    if (!filterResult.killedByRule) return;

    this.killsByRuleMap[filterResult.killedByRule] = (this.killsByRuleMap[filterResult.killedByRule] || 0) + 1;

    const killRecord: KillLogRecord = {
      type: 'KILL',
      timestamp: new Date().toISOString(),
      tokenAddress: filterResult.tokenAddress,
      symbol: filterResult.symbol,
      chain: filterResult.chain,
      killedByRule: filterResult.killedByRule,
      details: filterResult.killReason || 'Killed by filter rule',
      metrics: filterResult.metrics,
    };

    this.recentKills.unshift(killRecord);
    if (this.recentKills.length > 100) this.recentKills.pop();

    this.appendJsonl(killRecord);
    this.saveRecap();
  }

  /**
   * Log token killed by ANALYST (Score under 70)
   */
  public logAnalystKill(evalResult: AnalystEvaluation, chain: 'solana' | 'rbc'): void {
    this.killsByRuleMap.ANALYST_SCORE_UNDER_70++;

    const killRecord: KillLogRecord = {
      type: 'KILL',
      timestamp: new Date().toISOString(),
      tokenAddress: evalResult.tokenAddress,
      symbol: evalResult.symbol,
      chain,
      killedByRule: 'ANALYST_SCORE_UNDER_70',
      details: `Analyst Score ${evalResult.totalScore}/100 fell below 70 requirement.`,
      metrics: evalResult.breakdown,
    };

    this.recentKills.unshift(killRecord);
    if (this.recentKills.length > 100) this.recentKills.pop();

    this.appendJsonl(killRecord);
    this.saveRecap();
  }

  /**
   * Record trade entry & score
   */
  public recordTradeEntry(trade: ActivePositionRisk, score: number): void {
    this.totalPassedFilterCount++;
    this.totalPassedAnalystCount++;

    const ledgerRecord: TradeLedgerRecord = {
      type: 'TRADE',
      id: trade.id,
      tokenAddress: trade.tokenAddress,
      symbol: trade.tokenSymbol,
      chain: trade.chain,
      entryTimestamp: new Date().toISOString(),
      entryPrice: trade.entryPrice,
      positionSize: trade.allocatedCapital,
      analystScore: score,
      netPnl: 0,
      netPnlPct: 0,
    };

    this.tradeLedger.unshift(ledgerRecord);
    this.appendJsonl(ledgerRecord);
  }

  /**
   * Record trade completion
   */
  public recordTradeExit(trade: ActivePositionRisk): void {
    const existing = this.tradeLedger.find((t) => t.tokenAddress === trade.tokenAddress);
    const now = new Date();

    if (existing) {
      existing.exitPrice = trade.exitPrice;
      existing.exitTimestamp = now.toISOString();
      existing.exitReason = trade.exitReason;
      existing.netPnl = trade.realizedPnl;
      existing.netPnlPct = trade.realizedPnlPct;
      existing.durationMs = now.getTime() - new Date(existing.entryTimestamp).getTime();
      this.appendJsonl(existing);
    }

    this.saveRecap();
  }

  /**
   * Generates Morning Recap daily summary
   */
  public generateMorningRecap(): MorningRecap {
    const closedTrades = this.tradeLedger.filter((t) => t.exitTimestamp !== undefined);
    const totalTrades = closedTrades.length;

    const winningTrades = closedTrades.filter((t) => t.netPnl > 0).length;
    const losingTrades = closedTrades.filter((t) => t.netPnl <= 0).length;
    const winLossRatio = losingTrades > 0 ? Number((winningTrades / losingTrades).toFixed(2)) : winningTrades;

    let bestTradePct = 0;
    let worstTradePct = 0;

    for (const t of closedTrades) {
      if (t.netPnlPct > bestTradePct) bestTradePct = t.netPnlPct;
      if (t.netPnlPct < worstTradePct) worstTradePct = t.netPnlPct;
    }

    const currentBalance = executorAgent.getPaperBalance();
    const netProfit = currentBalance - this.startingBalance;
    const netProfitPct = this.startingBalance > 0 ? (netProfit / this.startingBalance) * 100 : 0;

    return {
      date: new Date().toISOString().split('T')[0],
      totalScanned: this.totalScannedCount,
      totalPassedFilter: this.totalPassedFilterCount,
      totalPassedAnalyst: this.totalPassedAnalystCount,
      killsByRule: { ...this.killsByRuleMap },
      totalTrades,
      winningTrades,
      losingTrades,
      winLossRatio,
      bestTradePct: Number(bestTradePct.toFixed(2)),
      worstTradePct: Number(worstTradePct.toFixed(2)),
      startingBalance: Number(this.startingBalance.toFixed(6)),
      finalBalance: Number(currentBalance.toFixed(6)),
      netProfit: Number(netProfit.toFixed(6)),
      netProfitPct: Number(netProfitPct.toFixed(2)),
    };
  }

  public printMorningRecap(): void {
    const recap = this.generateMorningRecap();
    console.log('\n╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║                   MORNING RECAP / AUDITOR SUMMARY                      ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝');
    console.log(`  Date: ${recap.date}`);
    console.log(`  Total Scanned: ${recap.totalScanned} | Total Trades: ${recap.totalTrades}`);
    console.log(`  Win/Loss Ratio: ${recap.winningTrades}W / ${recap.losingTrades}L (${recap.winLossRatio}x)`);
    console.log(`  Best Trade: +${recap.bestTradePct}% | Worst Trade: ${recap.worstTradePct}%`);
    console.log(`  Starting Balance: ${recap.startingBalance} SOL | Final: ${recap.finalBalance} SOL`);
    console.log(`  Net Profit: ${recap.netProfit >= 0 ? '+' : ''}${recap.netProfit} SOL (${recap.netProfitPct}%)`);
    console.log('────────────────────────────────────────────────────────────────────────');
    console.log('  Kills by Rule:');
    for (const [rule, count] of Object.entries(recap.killsByRule)) {
      if (count > 0) {
        console.log(`    - ${rule}: ${count}`);
      }
    }
    console.log('════════════════════════════════════════════════════════════════════════\n');
  }

  public saveRecap(): void {
    try {
      const recap = this.generateMorningRecap();
      fs.writeFileSync(this.morningRecapPath, JSON.stringify(recap, null, 2), 'utf-8');
    } catch {
      // non-blocking
    }
  }

  private appendJsonl(record: any): void {
    try {
      const line = JSON.stringify(record) + '\n';
      fs.appendFileSync(this.logFilePath, line, 'utf-8');
    } catch {
      // non-blocking
    }
  }

  public getRecentKills(): KillLogRecord[] {
    return this.recentKills.slice(0, 50);
  }

  public getRecentTrades(): TradeLedgerRecord[] {
    return this.tradeLedger.slice(0, 50);
  }
}

export const loggerAgent = new LoggerAgent();
