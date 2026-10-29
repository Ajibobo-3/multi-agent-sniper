import { ScoutPair } from './types/index.js';
import { scoutAgent } from './agents/1_scout.js';
import { filterAgent } from './agents/2_filter.js';
import { analystAgent } from './agents/3_analyst.js';
import { executorAgent } from './agents/4_executor.js';
import { riskAgent } from './agents/5_risk.js';
import { loggerAgent } from './agents/6_logger.js';

/**
 * 6-AGENT SEQUENTIAL SOLANA & RBC TRADING ENGINE
 *
 * NO agent skips a step. NO agent overrides another.
 * Protecting the balance comes first; profit comes second.
 *
 * Pipeline sequence:
 *   1. SCOUT    -> Polls DexScreener (30m - 72h old, $300k - $20M MCAP)
 *   2. FILTER   -> 8 Zero-Tolerance Kill Rules. Drop immediately if any fails.
 *   3. ANALYST  -> Scores 0 - 100. Cutoff 70+. Drops anything < 70.
 *   4. EXECUTOR -> Position sizing: max 8% of balance. Single entry. Inaction rule.
 *   5. RISK     -> Hard -6% Stop Loss. At +12%, activates dynamic trailing stop.
 *   6. LOGGER   -> Logs kills with exact rule, trade ledger, Morning Recap.
 */
export class SixAgentEngine {
  private isRunning: boolean = false;

  constructor() {
    this.wireSequentialPipeline();
  }

  private wireSequentialPipeline(): void {
    // 1. SCOUT handoff to PIPELINE
    scoutAgent.setHandoffCallback(async (pair: ScoutPair) => {
      await this.processPairSequentially(pair);
    });

    // 5. RISK trade closure handoff to 6. LOGGER
    riskAgent.setOnTradeClosedCallback((closedTrade) => {
      loggerAgent.recordTradeExit(closedTrade);
    });
  }

  /**
   * Strict sequential pipeline execution for a single pair
   */
  public async processPairSequentially(pair: ScoutPair): Promise<boolean> {
    loggerAgent.recordScannedPair();

    // ─────────────────────────────────────────────────────────────
    // STEP 2: FILTER (The Shield - 8 Zero-Tolerance Kill Rules)
    // ─────────────────────────────────────────────────────────────
    const filterResult = await filterAgent.evaluateToken(pair);
    if (!filterResult.passed) {
      // RULE FAILED: Kill instantly, handoff to LOGGER
      loggerAgent.logFilterKill(filterResult);
      return false; // NO agent skips a step. Pipeline stops here.
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 3: ANALYST (The Scorer - 0 to 100)
    // ─────────────────────────────────────────────────────────────
    const analystResult = analystAgent.evaluate(pair);
    if (!analystResult.passedThreshold) {
      // SCORE < 70: Kill instantly, handoff to LOGGER
      loggerAgent.logAnalystKill(analystResult, pair.chain);
      return false; // NO agent skips a step. Pipeline stops here.
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 4: EXECUTOR (The Position Sizer - Max 8% Balance)
    // ─────────────────────────────────────────────────────────────
    const order = await executorAgent.executeEntry(pair);
    if (!order) {
      // Inaction rule or single entry rule applied
      return false;
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 5: RISK (The Guardian - Hard -6% SL, +12% Trailing Stop)
    // ─────────────────────────────────────────────────────────────
    const activeRisk = riskAgent.registerPosition(order);

    // ─────────────────────────────────────────────────────────────
    // STEP 6: LOGGER (The Auditor - Record entry into ledger)
    // ─────────────────────────────────────────────────────────────
    loggerAgent.recordTradeEntry(activeRisk, analystResult.totalScore);

    return true;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║        6-AGENT SEQUENTIAL SOLANA & RBC TRADING ENGINE ACTIVE           ║');
    console.log('║        1. SCOUT  -> 2. FILTER -> 3. ANALYST                           ║');
    console.log('║        4. EXECUTOR -> 5. RISK   -> 6. LOGGER                           ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝');

    await scoutAgent.start();
  }

  public stop(): void {
    this.isRunning = false;
    scoutAgent.stop();
    loggerAgent.printMorningRecap();
  }
}

export const sixAgentEngine = new SixAgentEngine();
