import { CONFIG } from '../config/index.js';
import { eventBus } from '../bus/eventBus.js';

/**
 * Autonomous Circuit Breaker System
 *
 * 1. Daily Kill-Switch: Terminates the process if daily net drawdown
 *    hits the hardcoded limit (e.g., -$3.00).
 * 2. Velocity Throttling: Caps maximum trades per rolling hour window
 *    to prevent bot-spam capital drain.
 */
export class CircuitBreaker {
  private dailyRealizedPnl: number = 0;
  private tradeTimestamps: number[] = [];
  private isKilled: boolean = false;
  private startOfDayMs: number;

  constructor() {
    this.startOfDayMs = this.getStartOfDayMs();
  }

  /**
   * Register a realized P&L from a closed trade. Checks kill-switch after.
   */
  public registerPnl(pnl: number): void {
    this.dailyRealizedPnl += pnl;

    if (this.dailyRealizedPnl <= CONFIG.CIRCUIT.DAILY_KILL_SWITCH_USD) {
      this.isKilled = true;
      console.error(
        `\n💀 [CircuitBreaker] DAILY KILL-SWITCH TRIGGERED! Net drawdown: $${this.dailyRealizedPnl.toFixed(2)} <= $${CONFIG.CIRCUIT.DAILY_KILL_SWITCH_USD.toFixed(2)}`
      );
      console.error('💀 [CircuitBreaker] Terminating process to prevent further losses.');
      eventBus.emit('circuit:kill', {
        reason: `Daily drawdown limit hit: $${this.dailyRealizedPnl.toFixed(2)}`,
        dailyPnl: this.dailyRealizedPnl,
      });

      // Hard exit in production
      setTimeout(() => process.exit(1), 500);
    }
  }

  /**
   * Check if a new trade is allowed under velocity throttling.
   * Returns true if allowed, false if throttled.
   */
  public canOpenTrade(): boolean {
    if (this.isKilled) return false;

    // Reset daily counters at midnight
    const now = Date.now();
    if (now >= this.startOfDayMs + 86_400_000) {
      this.dailyRealizedPnl = 0;
      this.startOfDayMs = this.getStartOfDayMs();
    }

    // Prune timestamps older than 1 hour
    const oneHourAgo = now - 3_600_000;
    this.tradeTimestamps = this.tradeTimestamps.filter((ts) => ts > oneHourAgo);

    if (this.tradeTimestamps.length >= CONFIG.CIRCUIT.MAX_TRADES_PER_HOUR) {
      console.warn(
        `⏸️ [CircuitBreaker] Velocity throttle active: ${this.tradeTimestamps.length}/${CONFIG.CIRCUIT.MAX_TRADES_PER_HOUR} trades this hour. Rejecting new entry.`
      );
      eventBus.emit('circuit:throttled', {
        reason: 'Max trades per hour reached',
        tradesThisHour: this.tradeTimestamps.length,
      });
      return false;
    }

    return true;
  }

  /**
   * Record a new trade timestamp for velocity tracking.
   */
  public recordTradeEntry(): void {
    this.tradeTimestamps.push(Date.now());
  }

  public getDailyPnl(): number {
    return this.dailyRealizedPnl;
  }

  public getTradesThisHour(): number {
    const oneHourAgo = Date.now() - 3_600_000;
    this.tradeTimestamps = this.tradeTimestamps.filter((ts) => ts > oneHourAgo);
    return this.tradeTimestamps.length;
  }

  public getIsKilled(): boolean {
    return this.isKilled;
  }

  private getStartOfDayMs(): number {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }
}

export const circuitBreaker = new CircuitBreaker();
