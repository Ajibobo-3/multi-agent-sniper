import { PositionOrder, ActivePositionRisk } from '../types/index.js';
import { CONFIG } from '../config/index.js';
import { executorAgent } from './4_executor.js';
import { jitoExecutor } from '../execution/jitoExecutor.js';

/**
 * 5. RISK (The Guardian)
 *
 * Rules:
 * - Hard Stop-Loss: Hardcode a -6% stop-loss before order goes live.
 *   Nobody is allowed to move the stop lower.
 * - Trailing Stop Activation: The moment price reaches +12% profit,
 *   switch to a dynamic trailing stop and let it run.
 * - Exit Rule: Exit only when the initial -6% stop or the +12% trailing stop triggers an exit.
 */
export class RiskAgent {
  private activePositions: Map<string, ActivePositionRisk> = new Map();
  private onTradeClosedCallback?: (trade: ActivePositionRisk) => void;

  public setOnTradeClosedCallback(callback: (trade: ActivePositionRisk) => void): void {
    this.onTradeClosedCallback = callback;
  }

  /**
   * Initializes risk tracking for a newly sized position order
   */
  public registerPosition(order: PositionOrder): ActivePositionRisk {
    const entryPrice = order.entryPriceUsd;

    // HARD STOP-LOSS: Exactly -6% from entry price
    const initialStopLossPrice = entryPrice * (1 - CONFIG.RISK.HARD_STOP_LOSS_PCT); // -6%

    const pos: ActivePositionRisk = {
      id: order.orderId,
      tokenAddress: order.tokenAddress,
      tokenSymbol: order.tokenSymbol,
      chain: order.chain,
      entryPrice,
      currentPrice: entryPrice,
      allocatedCapital: order.allocatedCapitalNative,
      tokensHolding: order.tokensBought,

      initialStopLossPrice,
      trailingStopActive: false,
      currentStopLossPrice: initialStopLossPrice, // Hardcoded -6%
      peakPrice: entryPrice,
      roiPct: 0,

      status: 'OPEN',
      realizedPnl: 0,
      realizedPnlPct: 0,
    };

    this.activePositions.set(order.tokenAddress, pos);

    console.log(`\n🛡️ [5. RISK] Position Protection Armed!`);
    console.log(`    Token: ${pos.tokenSymbol} | Entry: $${entryPrice}`);
    console.log(`    Initial Stop-Loss: $${initialStopLossPrice.toFixed(8)} (-6.0% Hard Floor)`);
    console.log(`    Trailing Activation Target: $${(entryPrice * 1.12).toFixed(8)} (+12.0%)`);

    return pos;
  }

  /**
   * Evaluates price ticks against the -6% Hard SL and +12% Trailing Stop rules
   */
  public evaluatePriceTick(tokenAddress: string, currentPrice: number): ActivePositionRisk | null {
    const pos = this.activePositions.get(tokenAddress);
    if (!pos || pos.status !== 'OPEN') return null;

    pos.currentPrice = currentPrice;
    const entryPrice = pos.entryPrice;
    const currentRoiPct = ((currentPrice - entryPrice) / entryPrice) * 100;
    pos.roiPct = currentRoiPct;

    // Track peak price
    if (currentPrice > pos.peakPrice) {
      pos.peakPrice = currentPrice;
    }

    // -------------------------------------------------------------
    // TRAILING STOP ACTIVATION: At +12% profit
    // -------------------------------------------------------------
    const target12PctPrice = entryPrice * (1 + CONFIG.RISK.TRAILING_STOP_TRIGGER_PCT); // +12%
    if (!pos.trailingStopActive && currentPrice >= target12PctPrice) {
      pos.trailingStopActive = true;
      // Initialize trailing stop at peak minus 4% drawdown buffer
      const newTrailingStop = pos.peakPrice * (1 - CONFIG.RISK.TRAILING_DRAWDOWN_PCT);
      pos.currentStopLossPrice = Math.max(pos.currentStopLossPrice, newTrailingStop);

      console.log(`\n🚀 [5. RISK] +12% PROFIT HIT! Trailing Stop Activated on ${pos.tokenSymbol}!`);
      console.log(`    Price: $${currentPrice.toFixed(8)} (+${currentRoiPct.toFixed(2)}%)`);
      console.log(`    Trailing Stop Level: $${pos.currentStopLossPrice.toFixed(8)} | Letting runner ride!`);
    }

    // Update trailing stop level if price reaches higher peaks
    if (pos.trailingStopActive) {
      const dynamicTrailingStop = pos.peakPrice * (1 - CONFIG.RISK.TRAILING_DRAWDOWN_PCT);
      if (dynamicTrailingStop > pos.currentStopLossPrice) {
        pos.currentStopLossPrice = dynamicTrailingStop;
      }
    }

    // -------------------------------------------------------------
    // EXIT RULE: Exit ONLY when -6% stop or +12% trailing stop triggers
    // -------------------------------------------------------------
    if (currentPrice <= pos.currentStopLossPrice) {
      const isTrailing = pos.trailingStopActive;
      const exitReason = isTrailing ? '+12% TRAILING_STOP_TRIGGERED' : '-6% HARD_STOP_LOSS';
      const status = isTrailing ? 'PROFIT_EXIT' : 'STOPPED_OUT';

      pos.status = status;
      pos.exitPrice = currentPrice;
      pos.exitTimestamp = new Date().toISOString();
      pos.exitReason = exitReason;

      // Calculate net yield
      const exitValue = pos.tokensHolding * currentPrice;
      const entryValue = pos.tokensHolding * entryPrice;
      const pnlUsd = exitValue - entryValue;
      pos.realizedPnlPct = currentRoiPct;

      // Realized in SOL
      const pnlSol = pos.allocatedCapital * (currentRoiPct / 100);
      pos.realizedPnl = Number(pnlSol.toFixed(6));

      const returnedSol = pos.allocatedCapital + pnlSol;

      console.log(`\n🛑 [5. RISK] POSITION EXIT EXECUTED (${exitReason})!`);
      console.log(`    Token: ${pos.tokenSymbol} | Exit Price: $${currentPrice.toFixed(8)}`);
      console.log(`    Net P&L: ${pnlSol >= 0 ? '+' : ''}${pnlSol.toFixed(6)} SOL (${currentRoiPct >= 0 ? '+' : ''}${currentRoiPct.toFixed(2)}%)`);

      // Release slot in executor and restore paper/live balance
      executorAgent.releaseCoinEntry(tokenAddress, returnedSol);

      // If in LIVE mode, fire live 100% market sell
      if (CONFIG.EXECUTION_MODE === 'LIVE' && pos.chain === 'solana') {
        jitoExecutor.executeLiveSell(pos.tokenAddress, 100).catch((err) => {
          console.error('[RiskAgent] Live market sell error:', err);
        });
      }

      this.activePositions.delete(tokenAddress);

      if (this.onTradeClosedCallback) {
        this.onTradeClosedCallback(pos);
      }

      return pos;
    }

    return pos;
  }

  public getActivePositions(): ActivePositionRisk[] {
    return Array.from(this.activePositions.values());
  }
}

export const riskAgent = new RiskAgent();
