import * as fs from 'fs';
import * as path from 'path';
import { CONFIG } from '../../config/index.js';
import { eventBus } from '../../bus/eventBus.js';
import { circuitBreaker } from '../../risk/circuitBreaker.js';
import {
  AuditResult,
  PaperTradeRecord,
  TelemetryKPIs,
  TradeStatus,
  ExitReason,
} from '../../types/index.js';

export class PaperExecutionEngine {
  private activeTrades: Map<string, PaperTradeRecord> = new Map();
  private tradeHistory: PaperTradeRecord[] = [];
  private logFilePath: string;
  private startTimeMs: number = Date.now();

  constructor() {
    this.logFilePath = path.resolve(CONFIG.LOGS.PAPER_TRADES_PATH);
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    const dir = path.dirname(this.logFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  public start(): void {
    console.log('═══════════════════════════════════════════════════════');
    console.log(' 🎯 EXECUTION AGENT & DYNAMIC RISK ENGINE');
    console.log('   Micro-Positioning: 0.05 SOL / 0.01 RBC ETH');
    console.log('   Stream A: 50/50 TP @ +100% (2x), trail remainder');
    console.log('   Break-Even Stop: at +50% ROI -> move stop to entry');
    console.log('   Hard Floor: -20% stop-loss or -20% trailing drawdown');
    console.log('   Circuit Breakers: Max 3 trades/hr, Daily Kill: -$3.00');
    console.log('═══════════════════════════════════════════════════════');

    // Subscribe to audited tokens
    eventBus.on('token:audited', (auditResult: AuditResult) => {
      this.executePaperEntry(auditResult);
    });
  }

  /**
   * Execute immediate micro-position paper entry if circuit breakers permit
   */
  public executePaperEntry(auditResult: AuditResult): PaperTradeRecord | null {
    // Check Circuit Breaker velocity & daily drawdown limits
    if (!circuitBreaker.canOpenTrade()) {
      console.warn(
        `⛔ [ExecutionAgent] Trade entry blocked by circuit breaker for ${auditResult.tokenAddress}`
      );
      return null;
    }

    const entryTimeMs = Date.now();
    const tradeId = `${auditResult.chain}_${auditResult.stream}_${auditResult.tokenAddress}_${entryTimeMs}`;

    // Micro-position capital allocation
    const capitalInvested =
      auditResult.chain === 'solana'
        ? CONFIG.SOLANA.BUY_AMOUNT_SOL
        : CONFIG.RBC.BUY_AMOUNT_ETH;

    // Simulated baseline price
    const simulatedEntryPrice = 0.00001;
    const tokensBought = capitalInvested / simulatedEntryPrice;

    // Initial stop-loss is absolute 20% below entry (Hard Floor)
    const initialStopLoss = simulatedEntryPrice * (1 - CONFIG.RISK.HARD_FLOOR_STOP_LOSS);

    // Simulated token symbol
    const tokenSymbol =
      auditResult.chain === 'solana'
        ? auditResult.tokenAddress.slice(0, 4).toUpperCase()
        : 'RBC-' + auditResult.tokenAddress.slice(2, 6).toUpperCase();

    const record: PaperTradeRecord = {
      id: tradeId,
      chain: auditResult.chain,
      stream: auditResult.stream,
      tokenAddress: auditResult.tokenAddress,
      tokenSymbol,
      poolAddress: auditResult.poolAddress,
      detectedAtTimestamp: new Date(auditResult.completedAtMs - auditResult.latencyMs).toISOString(),
      entryTimestamp: new Date(entryTimeMs).toISOString(),
      simulatedEntryPrice,
      entryCapitalInvested: capitalInvested,
      tokensBought,
      currentTokensHolding: tokensBought,

      peakPrice: simulatedEntryPrice,
      currentPrice: simulatedEntryPrice,
      unrealizedPnlPct: 0,
      realizedPnl: 0,

      tpTriggered: false,
      beStopActive: false,
      currentStopLossPrice: initialStopLoss,
      stopLossTriggered: false,

      simulatedNetPnl: 0,
      simulatedNetPnlPct: 0,
      status: 'OPEN',
    };

    // Record trade in circuit breaker
    circuitBreaker.recordTradeEntry();

    this.activeTrades.set(tradeId, record);

    const streamTag = record.stream === 'A' ? 'Trenches' : 'Alpha';
    console.log(`\n🚀 [ExecutionAgent] [PAPER BUY] Position Entered!`);
    console.log(`   Stream: ${record.stream} (${streamTag}) | Chain: ${record.chain.toUpperCase()}`);
    console.log(`   Token: ${record.tokenSymbol} (${record.tokenAddress})`);
    console.log(`   Size: ${record.entryCapitalInvested} | Tokens: ${record.tokensBought}`);
    console.log(`   Entry: ${record.simulatedEntryPrice} | Initial Stop: ${record.currentStopLossPrice.toFixed(8)} (-20%)`);

    eventBus.emit('trade:entered', record);
    this.appendLog(record);

    return record;
  }

  /**
   * Real-time dynamic risk engine: evaluate price updates against TP, BE, and SL
   */
  public updatePrice(tradeId: string, newPrice: number): PaperTradeRecord | null {
    const trade = this.activeTrades.get(tradeId);
    if (!trade || trade.status === 'STOPPED_OUT' || trade.status === 'CLOSED') {
      return null;
    }

    const now = Date.now();
    trade.currentPrice = newPrice;
    const entryPrice = trade.simulatedEntryPrice;

    // Track peak price
    if (newPrice > trade.peakPrice) {
      trade.peakPrice = newPrice;
    }

    // 1. RULE: The 50/50 Take-Profit Rule (+100% / 2x target)
    const target2x = entryPrice * CONFIG.RISK.TP_50_50_THRESHOLD;
    if (!trade.tpTriggered && newPrice >= target2x) {
      trade.tpTriggered = true;
      trade.tpTimestamp = new Date(now).toISOString();
      trade.timeTo2xMs = now - new Date(trade.entryTimestamp).getTime();

      // Market sell exactly 50% of the bag to recover initial capital
      const tokensToSell = trade.tokensBought * 0.5;
      const capitalRecovered = tokensToSell * newPrice;
      trade.currentTokensHolding -= tokensToSell;
      trade.realizedPnl += capitalRecovered;
      trade.status = 'HALF_CLOSED';

      console.log(`\n🎉 [RiskEngine] 50/50 TAKE PROFIT TRIGGERED @ 2.0x!`);
      console.log(`   Token: ${trade.tokenSymbol} | Price: ${newPrice} (Entry: ${entryPrice})`);
      console.log(`   Sold 50% bag (${tokensToSell.toFixed(0)} tokens) for ${capitalRecovered.toFixed(4)}`);
      console.log(`   Time to 2x: ${trade.timeTo2xMs}ms | Letting remaining 50% ride.`);
    }

    // 2. RULE: Dynamic Break-Even Stop (+50% ROI / 1.5x)
    const target50Pct = entryPrice * CONFIG.RISK.TRAILING_BE_THRESHOLD;
    if (!trade.beStopActive && newPrice >= target50Pct) {
      trade.beStopActive = true;
      if (trade.currentStopLossPrice < entryPrice) {
        trade.currentStopLossPrice = entryPrice;
        console.log(`\n🛡️ [RiskEngine] +50% ROI Hit! Stop-Loss moved to BREAK-EVEN (${entryPrice}).`);
      }
    }

    // 3. RULE: Hard Floor & Trailing Drawdown
    // Trailing stop: 20% drawdown from peak
    const trailingStopPrice = trade.peakPrice * (1 - CONFIG.RISK.MAX_TRAILING_DRAWDOWN);
    if (trailingStopPrice > trade.currentStopLossPrice) {
      trade.currentStopLossPrice = trailingStopPrice;
    }

    // Check if Stop-Loss is hit
    if (newPrice <= trade.currentStopLossPrice) {
      trade.stopLossTriggered = true;
      trade.stopLossTimestamp = new Date(now).toISOString();
      trade.timeToStopLossMs = now - new Date(trade.entryTimestamp).getTime();

      // Liquidate remaining bag
      const remainingProceeds = trade.currentTokensHolding * newPrice;
      trade.realizedPnl += remainingProceeds;
      trade.currentTokensHolding = 0;
      trade.exitTimestamp = new Date(now).toISOString();
      trade.exitPrice = newPrice;
      trade.durationMs = now - new Date(trade.entryTimestamp).getTime();
      trade.status = 'STOPPED_OUT';

      // Net P&L
      trade.simulatedNetPnl = trade.realizedPnl - trade.entryCapitalInvested;
      trade.simulatedNetPnlPct = (trade.simulatedNetPnl / trade.entryCapitalInvested) * 100;

      let exitReason: ExitReason = 'STOP_LOSS_HARD';
      if (trade.tpTriggered) {
        exitReason = 'TP_2X';
      } else if (trade.beStopActive) {
        exitReason = trade.currentStopLossPrice > entryPrice ? 'STOP_LOSS_TRAILING' : 'STOP_LOSS_BE';
      }
      trade.exitReason = exitReason;

      console.log(`\n🛑 [RiskEngine] STOP-LOSS TRIGGERED (${trade.exitReason})!`);
      console.log(`   Token: ${trade.tokenSymbol} | Exit: ${newPrice} | Stop: ${trade.currentStopLossPrice}`);
      console.log(`   Net P&L: ${trade.simulatedNetPnl.toFixed(5)} (${trade.simulatedNetPnlPct.toFixed(2)}%)`);
      console.log(`   Hold Duration: ${trade.timeToStopLossMs}ms`);

      // Register with Circuit Breaker
      circuitBreaker.registerPnl(trade.simulatedNetPnl);

      // Archive to history & remove from active
      this.activeTrades.delete(tradeId);
      this.tradeHistory.unshift(trade);
      if (this.tradeHistory.length > 200) {
        this.tradeHistory.pop();
      }

      this.appendLog(trade);
      eventBus.emit('trade:closed', trade);
      return trade;
    }

    // Update unrealized values for active trade
    const currentUnrealizedVal = trade.currentTokensHolding * newPrice;
    trade.simulatedNetPnl = trade.realizedPnl + currentUnrealizedVal - trade.entryCapitalInvested;
    trade.simulatedNetPnlPct = (trade.simulatedNetPnl / trade.entryCapitalInvested) * 100;
    trade.unrealizedPnlPct = ((newPrice - entryPrice) / entryPrice) * 100;

    eventBus.emit('trade:updated', trade);
    return trade;
  }

  private appendLog(record: PaperTradeRecord): void {
    try {
      const line = JSON.stringify(record) + '\n';
      fs.appendFileSync(this.logFilePath, line, 'utf-8');
    } catch (err: any) {
      console.error('[ExecutionAgent] Failed to write paper trade log:', err.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  TELEMETRY GETTERS (consumed by /api/telemetry)
  // ─────────────────────────────────────────────────────────────

  public getActivePositions(): any[] {
    return Array.from(this.activeTrades.values()).map((t) => ({
      ...t,
      entryPrice: t.simulatedEntryPrice,
      currentPrice: t.currentPrice,
      roiPct: t.unrealizedPnlPct,
      entryCapital: t.entryCapitalInvested,
      currentValue: t.currentTokensHolding * t.currentPrice,
      stopLossPrice: t.currentStopLossPrice,
    }));
  }

  public getLedger(limit: number = 50): any[] {
    return this.tradeHistory.slice(0, limit).map((t) => {
      let durationStr = '—';
      if (t.durationMs) {
        const secs = Math.floor(t.durationMs / 1000);
        durationStr = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
      }
      return {
        ...t,
        entryPrice: t.simulatedEntryPrice,
        exitPrice: t.exitPrice ?? t.currentPrice,
        entryCapital: t.entryCapitalInvested,
        netPnl: t.simulatedNetPnl,
        netPnlPct: t.simulatedNetPnlPct,
        exitReason: t.exitReason ?? (t.tpTriggered ? 'TP 2x' : 'Stop Loss'),
        duration: durationStr,
      };
    });
  }

  public getKPIs(): TelemetryKPIs {
    const totalTrades = this.tradeHistory.length;
    const wins = this.tradeHistory.filter((t) => t.simulatedNetPnl > 0).length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

    const totalRealizedPnl = this.tradeHistory.reduce((sum, t) => sum + t.simulatedNetPnl, 0);

    const uptimeMs = Date.now() - this.startTimeMs;
    const hours = Math.floor(uptimeMs / 3_600_000);
    const minutes = Math.floor((uptimeMs % 3_600_000) / 60_000);
    const seconds = Math.floor((uptimeMs % 60_000) / 1000);
    const uptime = `${hours}h ${minutes}m ${seconds}s`;

    const dailyDrawdownUsed = Math.min(0, circuitBreaker.getDailyPnl());

    return {
      dailyPnl: Number(totalRealizedPnl.toFixed(4)),
      dailyPnlPct: Number((totalTrades > 0 ? (totalRealizedPnl / (totalTrades * 0.05)) * 100 : 0).toFixed(2)),
      winRate: Number(winRate.toFixed(1)),
      totalTrades24h: totalTrades,
      activeTrades: this.activeTrades.size,
      dailyDrawdownUsed: Number(Math.abs(dailyDrawdownUsed).toFixed(2)),
      dailyDrawdownLimit: Math.abs(CONFIG.CIRCUIT.DAILY_KILL_SWITCH_USD),
      tradesThisHour: circuitBreaker.getTradesThisHour(),
      maxTradesPerHour: CONFIG.CIRCUIT.MAX_TRADES_PER_HOUR,
      uptime,
      lastHeartbeat: new Date().toISOString(),
    };
  }
}

export const paperEngine = new PaperExecutionEngine();
