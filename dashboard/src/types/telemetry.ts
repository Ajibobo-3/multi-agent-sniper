export interface KPIs {
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

export interface ActivePosition {
  id: string;
  chain: 'solana' | 'rbc';
  stream: 'A' | 'B';
  tokenAddress: string;
  tokenSymbol: string;
  entryPrice: number;
  currentPrice: number;
  roiPct: number;
  entryCapital: number;
  currentValue: number;
  stopLossPrice: number;
  peakPrice: number;
  status: 'OPEN' | 'HALF_CLOSED';
  entryTimestamp: string;
  tpTriggered: boolean;
}

export interface LedgerEntry {
  id: string;
  chain: 'solana' | 'rbc';
  stream: 'A' | 'B';
  tokenAddress: string;
  tokenSymbol: string;
  entryPrice: number;
  exitPrice: number;
  entryCapital: number;
  netPnl: number;
  netPnlPct: number;
  exitReason: string;
  entryTimestamp: string;
  exitTimestamp: string;
  duration: string;
}

export interface TelemetryResponse {
  kpis: KPIs;
  activePositions: ActivePosition[];
  ledger: LedgerEntry[];
  engineStatus: 'RUNNING' | 'PAUSED' | 'KILLED';
}
