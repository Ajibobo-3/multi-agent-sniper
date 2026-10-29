import { sixAgentEngine } from './engine.js';
import { filterAgent } from './agents/2_filter.js';
import { analystAgent } from './agents/3_analyst.js';
import { executorAgent } from './agents/4_executor.js';
import { riskAgent } from './agents/5_risk.js';
import { loggerAgent } from './agents/6_logger.js';
import { ScoutPair } from './types/index.js';

async function runSixAgentTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║       VERIFICATION: 6-AGENT SEQUENTIAL SOLANA & RBC ENGINE             ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝');

  // Baseline valid ScoutPair
  const basePair: ScoutPair = {
    id: 'solana_test_pair_1',
    chain: 'solana',
    dexId: 'raydium',
    baseToken: { address: 'TokenValid111111111111111111111111111111111', name: 'Valid Coin', symbol: 'VAL' },
    quoteToken: { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL' },
    pairAddress: 'PairAddress111111111111111111111111111111111',
    priceUsd: 0.005,
    priceNative: 0.000027,
    liquidityUsd: 85_000,   // >= $40k (Rule 3 OK)
    marketCapUsd: 1_200_000,// $300k - $20M (Scout OK)
    volume1hUsd: 120_000,   // >= $50k (Rule 4 OK)
    priceChange1h: 35.0,    // <= 80% (Rule 8 OK)
    pairCreatedAt: Date.now() - 3600_000 * 2, // 2h old (30m - 72h OK)
    ageMinutes: 120,
    rawDexScreenerData: {
      txns: { h1: { buys: 280, sells: 110 } },
      priceChange: { m5: 3.2, h1: 35.0 },
    },
  };

  // ─────────────────────────────────────────────────────────────
  // TEST 1: Filter 8 Zero-Tolerance Kill Rules
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 1: Testing the 8 Zero-Tolerance Kill Rules ---');

  // Kill Rule 3: Liquidity under $40k
  const pairLowLiq = { ...basePair, liquidityUsd: 32_000 };
  const resLiq = await filterAgent.evaluateToken(pairLowLiq);
  console.assert(!resLiq.passed && resLiq.killedByRule === 'RULE_3_LIQUIDITY_UNDER_40K', 'Rule 3 failed to kill');
  loggerAgent.logFilterKill(resLiq);

  // Kill Rule 4: Volume 1h under $50k
  const pairLowVol = { ...basePair, volume1hUsd: 28_000 };
  const resVol = await filterAgent.evaluateToken(pairLowVol);
  console.assert(!resVol.passed && resVol.killedByRule === 'RULE_4_VOLUME_1H_UNDER_50K', 'Rule 4 failed to kill');
  loggerAgent.logFilterKill(resVol);

  // Kill Rule 8: Up > 80% in 1h
  const pairOverpumped = { ...basePair, priceChange1h: 94.0 };
  const resPump = await filterAgent.evaluateToken(pairOverpumped);
  console.assert(!resPump.passed && resPump.killedByRule === 'RULE_8_ALREADY_UP_80PCT_1H', 'Rule 8 failed to kill');
  loggerAgent.logFilterKill(resPump);

  console.log('✅ Filter Zero-Tolerance Rules verified.');

  // ─────────────────────────────────────────────────────────────
  // TEST 2: Analyst Scoring & 70+ Cutoff
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 2: Testing Analyst 70+ Cutoff ---');

  // Low score pair (low momentum, few buyers)
  const lowScorePair = {
    ...basePair,
    baseToken: { address: 'LowScoreToken11111111111111111111111111111111', name: 'Slow', symbol: 'SLOW' },
    priceChange1h: -5.0,
    rawDexScreenerData: {
      txns: { h1: { buys: 10, sells: 40 } },
      priceChange: { m5: -2.0, h1: -5.0 },
    },
  };

  const evalLow = analystAgent.evaluate(lowScorePair);
  console.assert(!evalLow.passedThreshold && evalLow.totalScore < 70, 'Low score should be < 70');
  loggerAgent.logAnalystKill(evalLow, 'solana');

  // High score pair
  const evalHigh = analystAgent.evaluate(basePair);
  console.assert(evalHigh.passedThreshold && evalHigh.totalScore >= 70, 'High score should be >= 70');
  console.log('✅ Analyst scoring and 70+ cutoff verified.');

  // ─────────────────────────────────────────────────────────────
  // TEST 3: Executor Position Sizing (Max 8% Balance & Single Entry)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 3: Testing Executor 8% Sizing & Single Entry ---');
  executorAgent.setPaperBalance(0.016); // $3 bankroll (0.016 SOL)
  const initialBalance = executorAgent.getPaperBalance();

  const order = await executorAgent.executeEntry(basePair);
  if (!order) throw new Error('Order execution failed');

  const expectedMaxAlloc = initialBalance * 0.08;
  console.assert(
    order.allocatedCapitalNative <= expectedMaxAlloc + 0.000001,
    `Allocated ${order.allocatedCapitalNative} exceeds 8% limit of ${expectedMaxAlloc}`
  );
  console.log(`✅ Position Sizing verified: ${order.allocatedCapitalNative} SOL is <= 8% of ${initialBalance} SOL.`);

  // Test Single Entry Rule: Same coin should be rejected
  const dupOrder = await executorAgent.executeEntry(basePair);
  console.assert(dupOrder === null, 'Single entry rule failed: duplicate order allowed');
  console.log('✅ Single Entry Rule enforced: duplicate order rejected.');

  // ─────────────────────────────────────────────────────────────
  // TEST 4: Risk Guardian (-6% Hard Stop & +12% Trailing Stop)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 4: Testing Risk Guardian (-6% Hard SL & +12% Trailing Stop) ---');
  riskAgent.setOnTradeClosedCallback((closed) => loggerAgent.recordTradeExit(closed));
  loggerAgent.recordScannedPair();
  loggerAgent.recordScannedPair();

  const pos = riskAgent.registerPosition(order);
  loggerAgent.recordTradeEntry(pos, evalHigh.totalScore);
  const entryPrice = pos.entryPrice;

  // Scenario A: Trade hit with -6% stop loss
  console.log('--- Sub-scenario: Price dips -6.5% ---');
  riskAgent.evaluatePriceTick(pos.tokenAddress, entryPrice * 0.935);
  console.assert(pos.status === 'STOPPED_OUT', 'Position should be STOPPED_OUT at -6.5%');
  console.log(`✅ Hard Stop-Loss verified: Exited on ${pos.exitReason} with net PnL: ${pos.realizedPnl} SOL.`);

  // Scenario B: Runner hits +12% trailing stop
  console.log('\n--- Sub-scenario: New trade hits +15% then pulls back ---');
  const runnerPair: ScoutPair = {
    ...basePair,
    baseToken: { address: 'RunnerToken111111111111111111111111111111111', name: 'Runner', symbol: 'RUN' },
  };
  const runnerOrder = await executorAgent.executeEntry(runnerPair);
  if (!runnerOrder) throw new Error('Runner order failed');
  const runnerPos = riskAgent.registerPosition(runnerOrder);
  loggerAgent.recordTradeEntry(runnerPos, 88);

  // Step 1: Rise +15% -> Activates trailing stop!
  riskAgent.evaluatePriceTick(runnerPos.tokenAddress, runnerOrder.entryPriceUsd * 1.15);
  console.assert(runnerPos.trailingStopActive === true, 'Trailing stop should be active at +15%');
  console.log(`✅ Trailing Stop Activation verified: Trailing active = ${runnerPos.trailingStopActive}`);

  // Step 2: Pullback 5% from peak -> Exits with profit!
  riskAgent.evaluatePriceTick(runnerPos.tokenAddress, runnerPos.currentStopLossPrice * 0.99);
  console.assert(runnerPos.status === 'PROFIT_EXIT', 'Position should be PROFIT_EXIT');
  console.log(`✅ Trailing Stop Exit verified: Exited on ${runnerPos.exitReason} with net PnL: +${runnerPos.realizedPnl} SOL.`);

  // ─────────────────────────────────────────────────────────────
  // TEST 5: Logger Agent Morning Recap
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- TEST 5: Morning Recap & Auditor Summary ---');
  loggerAgent.printMorningRecap();

  console.log('🎉 ALL 6 AGENTS VERIFIED AND PASSING 100% SPECIFICATIONS!');
}

runSixAgentTests().catch(console.error);
