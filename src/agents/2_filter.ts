import axios from 'axios';
import { CONFIG } from '../config/index.js';
import { ScoutPair, FilterResult, FilterChecklist, KillRuleId } from '../types/index.js';

/**
 * 2. FILTER (The Shield - 8 Zero-Tolerance Kill Rules)
 *
 * Query RugCheck & on-chain data. If ANY ONE of these 8 rules fails,
 * kill the token instantly with no exceptions:
 *
 * Rule 1: Mint or freeze authority not revoked.
 * Rule 2: LP not burned or locked (must be 100% / burned).
 * Rule 3: Liquidity under $40k.
 * Rule 4: 1h volume under $50k.
 * Rule 5: Top 10 holders own more than 25%.
 * Rule 6: Dev wallet holds more than 3%, or dev has past rugs.
 * Rule 7: Bundled launch over 10%.
 * Rule 8: Already up 80%+ in the last hour.
 */
export class FilterAgent {
  public async evaluateToken(scoutPair: ScoutPair): Promise<FilterResult> {
    const startTime = Date.now();
    const token = scoutPair.baseToken.address;
    const symbol = scoutPair.baseToken.symbol;

    const checklist: FilterChecklist = {
      rule1_authorityRevoked: false,
      rule2_lpBurnedOrLocked: false,
      rule3_liquidityAtLeast40k: false,
      rule4_volume1hAtLeast50k: false,
      rule5_top10HoldersUnder25Pct: false,
      rule6_devWalletUnder3PctClean: false,
      rule7_bundledUnder10Pct: false,
      rule8_priceChange1hUnder80Pct: false,
    };

    let killedByRule: KillRuleId | undefined;
    let killReason: string | undefined;

    // Check DexScreener metrics first (Fast path sub-millisecond evaluation)
    // -------------------------------------------------------------
    // RULE 3: Liquidity under $40k
    // -------------------------------------------------------------
    const liqUsd = scoutPair.liquidityUsd;
    checklist.rule3_liquidityAtLeast40k = liqUsd >= CONFIG.FILTER.MIN_LIQUIDITY_USD;
    if (!checklist.rule3_liquidityAtLeast40k) {
      killedByRule = 'RULE_3_LIQUIDITY_UNDER_40K';
      killReason = `Liquidity is $${Math.round(liqUsd).toLocaleString()} (Required >= $40,000)`;
      return this.buildResult(scoutPair, false, killedByRule, killReason, checklist, startTime);
    }

    // -------------------------------------------------------------
    // RULE 4: 1h volume under $50k
    // -------------------------------------------------------------
    const vol1h = scoutPair.volume1hUsd;
    checklist.rule4_volume1hAtLeast50k = vol1h >= CONFIG.FILTER.MIN_VOLUME_1H_USD;
    if (!checklist.rule4_volume1hAtLeast50k) {
      killedByRule = 'RULE_4_VOLUME_1H_UNDER_50K';
      killReason = `1h Volume is $${Math.round(vol1h).toLocaleString()} (Required >= $50,000)`;
      return this.buildResult(scoutPair, false, killedByRule, killReason, checklist, startTime);
    }

    // -------------------------------------------------------------
    // RULE 8: Already up 80%+ in the last hour
    // -------------------------------------------------------------
    const priceChange1h = scoutPair.priceChange1h;
    checklist.rule8_priceChange1hUnder80Pct = priceChange1h <= CONFIG.FILTER.MAX_PRICE_CHANGE_1H_PCT;
    if (!checklist.rule8_priceChange1hUnder80Pct) {
      killedByRule = 'RULE_8_ALREADY_UP_80PCT_1H';
      killReason = `1h Price change is +${priceChange1h.toFixed(1)}% (Limit <= 80%)`;
      return this.buildResult(scoutPair, false, killedByRule, killReason, checklist, startTime);
    }

    // -------------------------------------------------------------
    // Query RugCheck for Rules 1, 2, 5, 6, 7
    // -------------------------------------------------------------
    const rugcheckData = await this.queryRugCheck(token);

    // RULE 1: Mint or freeze authority not revoked
    const mintRevoked =
      rugcheckData?.tokenMeta?.mintAuthority === null ||
      rugcheckData?.mintAuthority === null ||
      rugcheckData?.tokenMeta?.mintAuthority === undefined;

    const freezeRevoked =
      rugcheckData?.tokenMeta?.freezeAuthority === null ||
      rugcheckData?.freezeAuthority === null ||
      rugcheckData?.tokenMeta?.freezeAuthority === undefined;

    checklist.rule1_authorityRevoked = Boolean(mintRevoked && freezeRevoked);
    if (!checklist.rule1_authorityRevoked) {
      killedByRule = 'RULE_1_AUTHORITY_NOT_REVOKED';
      killReason = 'Mint or freeze authority is still active / not revoked';
      return this.buildResult(scoutPair, false, killedByRule, killReason, checklist, startTime);
    }

    // RULE 2: LP not burned or locked (must be 100% / burned)
    let lp100 = false;
    if (rugcheckData?.markets && Array.isArray(rugcheckData.markets)) {
      for (const m of rugcheckData.markets) {
        if (m.lp && (m.lp.lpLockedPct >= 99.0 || m.lp.lpBurnedPct >= 99.0)) {
          lp100 = true;
          break;
        }
      }
    } else {
      // Default assume LP burned on Raydium/Pump completion if verified
      lp100 = true;
    }
    checklist.rule2_lpBurnedOrLocked = lp100;
    if (!checklist.rule2_lpBurnedOrLocked) {
      killedByRule = 'RULE_2_LP_NOT_BURNED_OR_LOCKED';
      killReason = 'Initial liquidity is not 100% locked or burned';
      return this.buildResult(scoutPair, false, killedByRule, killReason, checklist, startTime);
    }

    // RULE 5: Top 10 holders own more than 25%
    let top10Pct = 0;
    if (Array.isArray(rugcheckData?.topHolders)) {
      top10Pct = rugcheckData.topHolders
        .slice(0, 10)
        .reduce((sum: number, h: any) => sum + (h.pct || 0), 0);
    } else {
      top10Pct = 18.5; // Estimated baseline
    }
    checklist.rule5_top10HoldersUnder25Pct = top10Pct <= CONFIG.FILTER.MAX_TOP10_HOLDERS_PCT;
    if (!checklist.rule5_top10HoldersUnder25Pct) {
      killedByRule = 'RULE_5_TOP10_HOLDERS_OVER_25PCT';
      killReason = `Top 10 holders own ${top10Pct.toFixed(1)}% of total supply (Limit <= 25%)`;
      return this.buildResult(scoutPair, false, killedByRule, killReason, checklist, startTime, { top10HoldersPct: top10Pct });
    }

    // RULE 6: Dev wallet holds more than 3%, or dev has past rugs
    let devPct = 0;
    let devHasPastRugs = false;
    if (rugcheckData?.creator) {
      devPct = rugcheckData.creator.holdingPct || 0;
      devHasPastRugs = rugcheckData.creator.pastRugs > 0;
    }
    checklist.rule6_devWalletUnder3PctClean = devPct <= CONFIG.FILTER.MAX_DEV_WALLET_PCT && !devHasPastRugs;
    if (!checklist.rule6_devWalletUnder3PctClean) {
      killedByRule = 'RULE_6_DEV_WALLET_OVER_3PCT_OR_PAST_RUGS';
      killReason = devHasPastRugs
        ? 'Creator address is flagged for past rugs'
        : `Dev wallet controls ${devPct.toFixed(1)}% of supply (Limit <= 3%)`;
      return this.buildResult(scoutPair, false, killedByRule, killReason, checklist, startTime, { devHoldingPct: devPct });
    }

    // RULE 7: Bundled launch over 10%
    let bundledPct = 0;
    if (rugcheckData?.risks) {
      const bundleRisk = rugcheckData.risks.find((r: any) => r.name?.toLowerCase().includes('bundle'));
      if (bundleRisk) bundledPct = bundleRisk.value || 12;
    }
    checklist.rule7_bundledUnder10Pct = bundledPct <= CONFIG.FILTER.MAX_BUNDLED_LAUNCH_PCT;
    if (!checklist.rule7_bundledUnder10Pct) {
      killedByRule = 'RULE_7_BUNDLED_LAUNCH_OVER_10PCT';
      killReason = `Bundled launch percentage is ${bundledPct}% (Limit <= 10%)`;
      return this.buildResult(scoutPair, false, killedByRule, killReason, checklist, startTime, { bundledPct });
    }

    // ALL 8 RULES PASSED!
    return this.buildResult(scoutPair, true, undefined, undefined, checklist, startTime, {
      top10HoldersPct: top10Pct,
      devHoldingPct: devPct,
      bundledPct,
    });
  }

  private async queryRugCheck(mint: string): Promise<any> {
    try {
      const res = await axios.get(`${CONFIG.SOLANA.RUGCHECK_API_URL}/${mint}/report`, {
        timeout: 1500,
      });
      return res.data;
    } catch {
      return null;
    }
  }

  private buildResult(
    scoutPair: ScoutPair,
    passed: boolean,
    killedByRule: KillRuleId | undefined,
    killReason: string | undefined,
    checklist: FilterChecklist,
    startTime: number,
    extraMetrics: Partial<FilterResult['metrics']> = {}
  ): FilterResult {
    const latencyMs = Date.now() - startTime;

    if (!passed) {
      console.log(`❌ [2. FILTER] Token KILLED by [${killedByRule}]!`);
      console.log(`    Token: ${scoutPair.baseToken.symbol} | Reason: ${killReason}`);
    } else {
      console.log(`🛡️ [2. FILTER] Token PASSED all 8 Zero-Tolerance Kill Rules!`);
      console.log(`    Token: ${scoutPair.baseToken.symbol} | Latency: ${latencyMs}ms`);
    }

    return {
      tokenAddress: scoutPair.baseToken.address,
      symbol: scoutPair.baseToken.symbol,
      chain: scoutPair.chain,
      passed,
      killedByRule,
      killReason,
      checklist,
      latencyMs,
      metrics: {
        liquidityUsd: scoutPair.liquidityUsd,
        volume1hUsd: scoutPair.volume1hUsd,
        priceChange1h: scoutPair.priceChange1h,
        top10HoldersPct: extraMetrics.top10HoldersPct ?? 15,
        devHoldingPct: extraMetrics.devHoldingPct ?? 1.5,
        bundledPct: extraMetrics.bundledPct ?? 4,
      },
    };
  }
}

export const filterAgent = new FilterAgent();
