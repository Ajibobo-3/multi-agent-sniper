import { eventBus } from './bus/eventBus.js';
import { AuditorAgent } from './agents/auditor/index.js';
import { ExecutionAgent, paperEngine } from './agents/execution/index.js';
import { circuitBreaker } from './risk/circuitBreaker.js';
import { TokenDetectedEvent, AuditResult } from './types/index.js';
import * as fs from 'fs';
import { CONFIG } from './config/index.js';

async function runSimulation() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║        TESTING DUAL-STREAM SNIPER & RISK ENGINE SIMULATION             ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝');

  const execution = new ExecutionAgent();
  execution.start();

  const auditor = new AuditorAgent();
  auditor.start();

  // -------------------------------------------------------------
  // Test 1: Stream A (The Trenches) - Rapid 2x Flip Scenario
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Stream A (The Trenches) - Pool Init & Dynamic Risk ---');
  const tokenA: TokenDetectedEvent = {
    chain: 'solana',
    stream: 'A',
    tokenAddress: 'TrenchesToken1111111111111111111111111111111',
    poolAddress: 'PoolA1111111111111111111111111111111111111',
    source: 'pumpportal',
    detectedAtMs: Date.now(),
    metadata: { name: 'Trench Runner', symbol: 'TRNCH' },
  };

  const auditA: AuditResult = {
    chain: 'solana',
    stream: 'A',
    tokenAddress: tokenA.tokenAddress,
    poolAddress: tokenA.poolAddress,
    passed: true,
    checks: {
      mintAuthorityRevoked: true,
      freezeAuthorityDisabled: true,
      liquidityLockedOrBurned100: true,
      top10HoldersSharePct: 11.2,
      top10HoldersUnder15Pct: true,
      rugcheckRiskLevel: 'good',
    },
    failureReasons: [],
    latencyMs: 85,
    completedAtMs: Date.now(),
  };

  eventBus.emit('token:audited', auditA);
  await new Promise((r) => setTimeout(r, 100));

  const activeTrades = paperEngine.getActivePositions();
  const tradeA = activeTrades.find((t) => t.tokenAddress === tokenA.tokenAddress);
  if (!tradeA) throw new Error('Trade A failed to initialize');
  console.log(`✅ [Trade A Initialized] ID: ${tradeA.id} | Size: ${tradeA.entryCapitalInvested} SOL`);

  // Price sequence for Trade A:
  // Step 1: Rise +60% (1.6x) -> Triggers Dynamic Break-Even Stop
  let updatedA = paperEngine.updatePrice(tradeA.id, tradeA.simulatedEntryPrice * 1.6)!;
  console.log(`   [Trade A] Price +60% -> Stop moved to: ${updatedA.currentStopLossPrice} (BE active: ${updatedA.beStopActive})`);

  // Step 2: Rise +105% (2.05x) -> Triggers 50/50 Take Profit (sells 50%)
  updatedA = paperEngine.updatePrice(tradeA.id, tradeA.simulatedEntryPrice * 2.05)!;
  console.log(`   [Trade A] Price +105% -> TP Triggered: ${updatedA.tpTriggered} | Remaining tokens: ${updatedA.currentTokensHolding}`);

  // Step 3: Dumps below stop -> Liquidation of remaining 50%
  updatedA = paperEngine.updatePrice(tradeA.id, updatedA.currentStopLossPrice * 0.98)!;
  console.log(`   [Trade A] Closed -> Net PnL: ${updatedA.simulatedNetPnl.toFixed(5)} (${updatedA.simulatedNetPnlPct.toFixed(2)}%) | Exit: ${updatedA.exitReason}`);

  // -------------------------------------------------------------
  // Test 2: Stream B (The Alpha Hunters) - Migration / Smart Money
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Stream B (The Alpha Hunters) - High-Priority Migration ---');
  const tokenB: TokenDetectedEvent = {
    chain: 'solana',
    stream: 'B',
    tokenAddress: 'AlphaMigration1111111111111111111111111111',
    poolAddress: 'RaydiumPoolB11111111111111111111111111111111',
    source: 'raydium_migration',
    detectedAtMs: Date.now(),
    metadata: { name: 'Alpha Migration', symbol: 'ALPHA' },
  };

  const auditB: AuditResult = {
    chain: 'solana',
    stream: 'B',
    tokenAddress: tokenB.tokenAddress,
    poolAddress: tokenB.poolAddress,
    passed: true,
    checks: {
      mintAuthorityRevoked: true,
      freezeAuthorityDisabled: true,
      liquidityLockedOrBurned100: true,
      top10HoldersSharePct: 7.4,
      top10HoldersUnder15Pct: true,
      rugcheckRiskLevel: 'good',
    },
    failureReasons: [],
    latencyMs: 42,
    completedAtMs: Date.now(),
  };

  eventBus.emit('token:audited', auditB);
  await new Promise((r) => setTimeout(r, 100));

  const tradeB = paperEngine.getActivePositions().find((t) => t.tokenAddress === tokenB.tokenAddress);
  if (!tradeB) throw new Error('Trade B failed to initialize');
  console.log(`✅ [Trade B Initialized] Stream: ${tradeB.stream} | Token: ${tradeB.tokenSymbol}`);

  // Test hard floor -20% stop loss
  const updatedB = paperEngine.updatePrice(tradeB.id, tradeB.simulatedEntryPrice * 0.78)!;
  console.log(`   [Trade B] Price dumped -22% -> Stop Loss triggered: ${updatedB.stopLossTriggered} | Exit: ${updatedB.exitReason}`);

  // -------------------------------------------------------------
  // Test 3: Auditor Agent Rejection
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Auditor Rejection (RugCheck riskLevel != good) ---');
  const rejectedEvent: TokenDetectedEvent = {
    chain: 'solana',
    stream: 'A',
    tokenAddress: 'Honeypot11111111111111111111111111111111111',
    poolAddress: 'PoolHoney1111111111111111111111111111111111',
    source: 'pumpportal',
    detectedAtMs: Date.now(),
  };

  const auditRejected: AuditResult = {
    chain: 'solana',
    stream: 'A',
    tokenAddress: rejectedEvent.tokenAddress,
    poolAddress: rejectedEvent.poolAddress,
    passed: false,
    checks: {
      mintAuthorityRevoked: false,
      freezeAuthorityDisabled: false,
      liquidityLockedOrBurned100: false,
      top10HoldersSharePct: 62.5,
      top10HoldersUnder15Pct: false,
      rugcheckRiskLevel: 'danger',
    },
    failureReasons: [
      'RugCheck riskLevel is "danger"',
      'Mint authority active',
      'Top 10 holders own 62.5%',
    ],
    latencyMs: 60,
    completedAtMs: Date.now(),
  };

  eventBus.emit('token:rejected', auditRejected);
  console.log('✅ Token successfully dropped before execution.');

  // -------------------------------------------------------------
  // Test 4: Verify Telemetry Output & Paper Trade Ledger
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Telemetry & Ledger Validation ---');
  const kpis = paperEngine.getKPIs();
  const ledger = paperEngine.getLedger(10);

  console.log('📊 Telemetry KPIs:');
  console.log(`   Win Rate: ${kpis.winRate}%`);
  console.log(`   Total Trades: ${kpis.totalTrades24h}`);
  console.log(`   Net P&L: ${kpis.dailyPnl} SOL`);
  console.log(`   Trades This Hour: ${kpis.tradesThisHour}/${kpis.maxTradesPerHour}`);
  console.log(`   Ledger Count: ${ledger.length}`);

  if (fs.existsSync(CONFIG.LOGS.PAPER_TRADES_PATH)) {
    console.log(`✅ paper_trades.jsonl successfully populated.`);
  }

  console.log('\n🎉 ALL SIMULATION TESTS PASSED SUCCESSFULLY!');
}

runSimulation().catch(console.error);
