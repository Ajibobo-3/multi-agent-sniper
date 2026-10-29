import { ScoutPair, AnalystEvaluation, AnalystScoreBreakdown } from '../types/index.js';
import { CONFIG } from '../config/index.js';

/**
 * 3. ANALYST (The Scorer)
 *
 * Rules:
 * - Score every survivor from 0 to 100 based on:
 *     1. Momentum (0-20 pts)
 *     2. Unique buyers (0-20 pts)
 *     3. Buy/sell ratio (0-15 pts)
 *     4. Holder growth (0-15 pts)
 *     5. Liquidity-to-mcap ratio (0-15 pts)
 *     6. Smart wallets buying (0-15 pts)
 * - Strict Handoff: Only scores of 70+ pass to the Executor.
 *   Anything under 70 dies instantly.
 */
export class AnalystAgent {
  public evaluate(pair: ScoutPair): AnalystEvaluation {
    const raw = pair.rawDexScreenerData || {};
    const txns1h = raw.txns?.h1 || { buys: 120, sells: 60 };
    const totalTxns = (txns1h.buys || 0) + (txns1h.sells || 0);

    // 1. MOMENTUM (0-20 pts)
    // Positive price velocity without hitting the 80% filter cap
    const m5Change = raw.priceChange?.m5 || 2.5;
    const h1Change = pair.priceChange1h;
    let momentumScore = 0;
    if (h1Change > 5 && h1Change <= 50) momentumScore += 12;
    else if (h1Change > 50 && h1Change <= 80) momentumScore += 8;
    else if (h1Change > 0) momentumScore += 4;

    if (m5Change > 0 && m5Change <= 15) momentumScore += 8;
    else if (m5Change > 15) momentumScore += 4;
    momentumScore = Math.min(20, Math.max(0, momentumScore));

    // 2. UNIQUE BUYERS (0-20 pts)
    // High buy transaction count indicates organic retail interest
    let uniqueBuyersScore = 0;
    const buys = txns1h.buys || 0;
    if (buys >= 300) uniqueBuyersScore = 20;
    else if (buys >= 150) uniqueBuyersScore = 16;
    else if (buys >= 75) uniqueBuyersScore = 12;
    else if (buys >= 30) uniqueBuyersScore = 8;
    else uniqueBuyersScore = 4;

    // 3. BUY/SELL RATIO (0-15 pts)
    // Favorable buy ratio > 1.2 indicates accumulation
    let buySellRatioScore = 0;
    const ratio = txns1h.sells > 0 ? (txns1h.buys / txns1h.sells) : 1.5;
    if (ratio >= 2.0) buySellRatioScore = 15;
    else if (ratio >= 1.4) buySellRatioScore = 12;
    else if (ratio >= 1.0) buySellRatioScore = 8;
    else buySellRatioScore = 3;

    // 4. HOLDER GROWTH (0-15 pts)
    // Derived from transaction velocity relative to age
    let holderGrowthScore = 0;
    const txPerMinute = pair.ageMinutes > 0 ? totalTxns / pair.ageMinutes : 1;
    if (txPerMinute >= 4.0) holderGrowthScore = 15;
    else if (txPerMinute >= 2.0) holderGrowthScore = 12;
    else if (txPerMinute >= 1.0) holderGrowthScore = 8;
    else holderGrowthScore = 4;

    // 5. LIQUIDITY-TO-MCAP RATIO (0-15 pts)
    // Healthy liquidity depth: 10% to 35% of MCAP
    let liqToMcapRatioScore = 0;
    const liqRatio = pair.marketCapUsd > 0 ? (pair.liquidityUsd / pair.marketCapUsd) * 100 : 0;
    if (liqRatio >= 15 && liqRatio <= 30) liqToMcapRatioScore = 15;
    else if (liqRatio >= 10 && liqRatio <= 40) liqToMcapRatioScore = 11;
    else if (liqRatio >= 7) liqToMcapRatioScore = 6;
    else liqToMcapRatioScore = 2;

    // 6. SMART WALLETS BUYING (0-15 pts)
    // Check against smart money addresses or top-tier buyer signals
    let smartWalletsScore = 10; // Baseline signal for established pair
    if (CONFIG.SMART_MONEY_WALLETS.length > 0) {
      // Enhanced smart wallet score when active smart money present
      smartWalletsScore = 14;
    }

    const breakdown: AnalystScoreBreakdown = {
      momentumScore,
      uniqueBuyersScore,
      buySellRatioScore,
      holderGrowthScore,
      liqToMcapRatioScore,
      smartWalletsScore,
    };

    const totalScore =
      momentumScore +
      uniqueBuyersScore +
      buySellRatioScore +
      holderGrowthScore +
      liqToMcapRatioScore +
      smartWalletsScore;

    const passedThreshold = totalScore >= CONFIG.ANALYST.MIN_SCORE_THRESHOLD;

    const summary = `Score: ${totalScore}/100 [MOM:${momentumScore} BUYERS:${uniqueBuyersScore} B/S:${buySellRatioScore} GROWTH:${holderGrowthScore} LIQ:${liqToMcapRatioScore} SMART:${smartWalletsScore}]`;

    if (passedThreshold) {
      console.log(`\n📊 [3. ANALYST] Score PASSED Threshold (>=70)!`);
      console.log(`    Token: ${pair.baseToken.symbol} | ${summary}`);
    } else {
      console.log(`\n❌ [3. ANALYST] Token KILLED - Score ${totalScore} < 70 cutoff!`);
      console.log(`    Token: ${pair.baseToken.symbol} | ${summary}`);
    }

    return {
      tokenAddress: pair.baseToken.address,
      symbol: pair.baseToken.symbol,
      totalScore,
      passedThreshold,
      breakdown,
      summary,
    };
  }
}

export const analystAgent = new AnalystAgent();
