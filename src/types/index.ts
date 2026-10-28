export type Chain = 'solana' | 'rbc';
export type StreamId = 'A' | 'B';

export interface TokenDetectedEvent {
  chain: Chain;
  stream: StreamId;
  tokenAddress: string;
  poolAddress: string;
  quoteAddress?: string;
  initialLiquiditySolOrEth?: number;
  initialLiquidityTokens?: number;
  source:
    | 'raydium'
    | 'pumpportal'
    | 'raydium_migration'
    | 'smart_money'
    | 'rbc_factory'
    | 'rbc_sync';
  detectedAtMs: number;
  detectedAtUs?: bigint;
  metadata?: {
    name?: string;
    symbol?: string;
    decimals?: number;
    deployer?: string;
    txHash?: string;
    smartWallet?: string;
  };
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

  // Live tracking
  peakPrice: number;
  currentPrice: number;
  unrealizedPnlPct: number;
  realizedPnl: number;

  // Take-profit triggers
  tpTriggered: boolean;
  tpTimestamp?: string;
  timeTo2xMs?: number;

  // Stop-loss tracking
  beStopActive: boolean;
  currentStopLossPrice: number;
  stopLossTriggered: boolean;
  stopLossTimestamp?: string;
  timeToStopLossMs?: number;

  // Summary
  exitTimestamp?: string;
  exitPrice?: number;
  simulatedNetPnl: number;
  simulatedNetPnlPct: number;
  status: TradeStatus;
  exitReason?: ExitReason;
  durationMs?: number;
}

// Telemetry API response shape
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
