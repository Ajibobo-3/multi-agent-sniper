export type Chain = 'solana' | 'rbc';
export type StreamId = 'A' | 'B';

// ==========================================
// 1. SCOUT (The Watcher)
// ==========================================
export interface ScoutPair {
  id: string;
  chain: Chain;
  dexId: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    symbol: string;
  };
  pairAddress: string;
  priceUsd: number;
  priceNative: number;
  liquidityUsd: number;
  marketCapUsd: number;
  volume1hUsd: number;
  priceChange1h: number;
  pairCreatedAt: number;
  ageMinutes: number;
  rawDexScreenerData?: any;
}

// ==========================================
// 2. FILTER (The Shield - 8 Zero-Tolerance Kill Rules)
// ==========================================
export type KillRuleId =
  | 'RULE_1_AUTHORITY_NOT_REVOKED'
  | 'RULE_2_LP_NOT_BURNED_OR_LOCKED'
  | 'RULE_3_LIQUIDITY_UNDER_40K'
  | 'RULE_4_VOLUME_1H_UNDER_50K'
  | 'RULE_5_TOP10_HOLDERS_OVER_25PCT'
  | 'RULE_6_DEV_WALLET_OVER_3PCT_OR_PAST_RUGS'
  | 'RULE_7_BUNDLED_LAUNCH_OVER_10PCT'
  | 'RULE_8_ALREADY_UP_80PCT_1H';

export interface FilterChecklist {
  rule1_authorityRevoked: boolean;
  rule2_lpBurnedOrLocked: boolean;
  rule3_liquidityAtLeast40k: boolean;
  rule4_volume1hAtLeast50k: boolean;
  rule5_top10HoldersUnder25Pct: boolean;
  rule6_devWalletUnder3PctClean: boolean;
  rule7_bundledUnder10Pct: boolean;
  rule8_priceChange1hUnder80Pct: boolean;
}

export interface FilterResult {
  tokenAddress: string;
  symbol: string;
  chain: Chain;
  passed: boolean;
  killedByRule?: KillRuleId;
  killReason?: string;
  checklist: FilterChecklist;
  latencyMs: number;
  metrics: {
    liquidityUsd: number;
    volume1hUsd: number;
    priceChange1h: number;
    top10HoldersPct: number;
    devHoldingPct: number;
    bundledPct: number;
  };
}

// ==========================================
// 3. ANALYST (The Scorer)
// ==========================================
export interface AnalystScoreBreakdown {
  momentumScore: number;
  uniqueBuyersScore: number;
  buySellRatioScore: number;
  holderGrowthScore: number;
  liqToMcapRatioScore: number;
  smartWalletsScore: number;
}

export interface AnalystEvaluation {
  tokenAddress: string;
  symbol: string;
  totalScore: number;
  passedThreshold: boolean;
  breakdown: AnalystScoreBreakdown;
  summary: string;
}

// ==========================================
// 4. EXECUTOR (The Position Sizer)
// ==========================================
export interface PositionOrder {
  orderId: string;
  tokenAddress: string;
  tokenSymbol: string;
  chain: Chain;
  allocatedCapitalNative: number;
  allocatedCapitalUsd: number;
  entryPriceUsd: number;
  tokensBought: number;
  currentBalanceBeforeTrade: number;
  timestamp: string;
}

// ==========================================
// 5. RISK (The Guardian)
// ==========================================
export interface ActivePositionRisk {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  chain: Chain;
  entryPrice: number;
  currentPrice: number;
  allocatedCapital: number;
  tokensHolding: number;

  initialStopLossPrice: number;
  trailingStopActive: boolean;
  currentStopLossPrice: number;
  peakPrice: number;
  roiPct: number;

  status: 'OPEN' | 'STOPPED_OUT' | 'PROFIT_EXIT';
  exitPrice?: number;
  exitTimestamp?: string;
  exitReason?: '-6% HARD_STOP_LOSS' | '+12% TRAILING_STOP_TRIGGERED' | 'MANUAL';
  realizedPnl: number;
  realizedPnlPct: number;
}

// ==========================================
// 6. LOGGER (The Auditor)
// ==========================================
export interface KillLogRecord {
  type: 'KILL';
  timestamp: string;
  tokenAddress: string;
  symbol: string;
  chain: Chain;
  killedByRule: KillRuleId | 'ANALYST_SCORE_UNDER_70';
  details: string;
  metrics?: any;
}

export interface TradeLedgerRecord {
  type: 'TRADE';
  id: string;
  tokenAddress: string;
  symbol: string;
  chain: Chain;
  entryTimestamp: string;
  exitTimestamp?: string;
  entryPrice: number;
  exitPrice?: number;
  positionSize: number;
  analystScore: number;
  exitReason?: string;
  netPnl: number;
  netPnlPct: number;
  durationMs?: number;
}

export interface MorningRecap {
  date: string;
  totalScanned: number;
  totalPassedFilter: number;
  totalPassedAnalyst: number;
  killsByRule: Record<KillRuleId | 'ANALYST_SCORE_UNDER_70', number>;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winLossRatio: number;
  bestTradePct: number;
  worstTradePct: number;
  startingBalance: number;
  finalBalance: number;
  netProfit: number;
  netProfitPct: number;
}

// ==========================================
// BACKWARDS COMPATIBILITY FOR PREVIOUS AGENTS
// ==========================================
export interface TokenDetectedEvent {
  chain: Chain;
  stream: StreamId;
  tokenAddress: string;
  poolAddress: string;
  quoteAddress?: string;
  initialLiquiditySolOrEth?: number;
  initialLiquidityTokens?: number;
  source: string;
  detectedAtMs: number;
  detectedAtUs?: bigint;
  metadata?: any;
}

export interface AuditCheckDetails {
  mintAuthorityRevoked: boolean;
  freezeAuthorityDisabled: boolean;
  liquidityLockedOrBurned100: boolean;
  top10HoldersSharePct: number;
  top10HoldersUnder15Pct: boolean;
  isContractVerified?: boolean;
  isOwnershipRenounced?: boolean;
  rugcheckRiskLevel?: string;
}

export interface AuditResult {
  chain: Chain;
  stream: StreamId;
  tokenAddress: string;
  poolAddress: string;
  passed: boolean;
  checks: AuditCheckDetails;
  failureReasons: string[];
  latencyMs: number;
  completedAtMs: number;
}

export type TradeStatus = 'OPEN' | 'HALF_CLOSED' | 'STOPPED_OUT' | 'CLOSED';
export type ExitReason =
  | 'TP_2X'
  | 'STOP_LOSS_HARD'
  | 'STOP_LOSS_TRAILING'
  | 'STOP_LOSS_BE'
  | 'CIRCUIT_BREAKER'
  | 'MANUAL';

export interface PaperTradeRecord {
  id: string;
  chain: Chain;
  stream: StreamId;
  tokenAddress: string;
  tokenSymbol: string;
  poolAddress: string;
  detectedAtTimestamp: string;
  entryTimestamp: string;
  simulatedEntryPrice: number;
  entryCapitalInvested: number;
  tokensBought: number;
  currentTokensHolding: number;
  peakPrice: number;
  currentPrice: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  tpTriggered: boolean;
  tpTimestamp?: string;
  timeTo2xMs?: number;
  beStopActive: boolean;
  currentStopLossPrice: number;
  stopLossTriggered: boolean;
  stopLossTimestamp?: string;
  timeToStopLossMs?: number;
  exitTimestamp?: string;
  exitPrice?: number;
  simulatedNetPnl: number;
  simulatedNetPnlPct: number;
  status: TradeStatus;
  exitReason?: ExitReason;
  durationMs?: number;
}

export interface TelemetryKPIs {
  dailyPnl: number;
  dailyPnlPct: number;
  winRate: number;
  totalTrades24h: number;
  activeTrades: number;
  dailyDrawdownUsed: number;
  dailyDrawdownLimit: number;
  tradesThisHour: number;
  maxTradesPerHour: number;
  uptime: string;
  lastHeartbeat: string;
}

export interface TelemetryResponse {
  kpis: TelemetryKPIs;
  activePositions: any[];
  ledger: any[];
  engineStatus: 'RUNNING' | 'PAUSED' | 'KILLED';
}
