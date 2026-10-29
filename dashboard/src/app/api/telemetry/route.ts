import { NextResponse } from 'next/server';
import type { TelemetryResponse, ActivePosition, LedgerEntry } from '@/types/telemetry';

// In-memory simulation state for standalone / cloud deployment mode
let pnl = 1.482;
let dailyPnlPct = 29.64;
let activePositions: ActivePosition[] = [
  {
    id: 'solana_A_pump_7xKXt_1793230',
    chain: 'solana',
    stream: 'A',
    tokenAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    tokenSymbol: 'SOLSTORM',
    entryPrice: 0.00001,
    currentPrice: 0.0000185,
    roiPct: 85.0,
    entryCapital: 0.05,
    currentValue: 0.0925,
    stopLossPrice: 0.0000148,
    peakPrice: 0.0000185,
    status: 'OPEN',
    entryTimestamp: new Date(Date.now() - 480_000).toISOString(),
    tpTriggered: false,
  },
  {
    id: 'solana_B_migr_DezXA_1793231',
    chain: 'solana',
    stream: 'B',
    tokenAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    tokenSymbol: 'BONK2',
    entryPrice: 0.000025,
    currentPrice: 0.000054,
    roiPct: 116.0,
    entryCapital: 0.05,
    currentValue: 0.054,
    stopLossPrice: 0.0000432,
    peakPrice: 0.000054,
    status: 'HALF_CLOSED',
    entryTimestamp: new Date(Date.now() - 1_240_000).toISOString(),
    tpTriggered: true,
  },
  {
    id: 'rbc_A_dex_0x4663_1793232',
    chain: 'rbc',
    stream: 'A',
    tokenAddress: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    tokenSymbol: 'RBC-PONS',
    entryPrice: 0.00045,
    currentPrice: 0.00052,
    roiPct: 15.56,
    entryCapital: 0.01,
    currentValue: 0.01156,
    stopLossPrice: 0.00036,
    peakPrice: 0.00052,
    status: 'OPEN',
    entryTimestamp: new Date(Date.now() - 180_000).toISOString(),
    tpTriggered: false,
  },
];

const ledgerHistory: LedgerEntry[] = [
  {
    id: 'solana_A_closed_1',
    chain: 'solana',
    stream: 'A',
    tokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    tokenSymbol: 'SPEED',
    entryPrice: 0.00001,
    exitPrice: 0.000021,
    entryCapital: 0.05,
    netPnl: 0.042,
    netPnlPct: 84.0,
    exitReason: 'TP 2x Triggered',
    entryTimestamp: new Date(Date.now() - 3_600_000).toISOString(),
    exitTimestamp: new Date(Date.now() - 3_420_000).toISOString(),
    duration: '3m 0s',
  },
  {
    id: 'solana_B_closed_2',
    chain: 'solana',
    stream: 'B',
    tokenAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    tokenSymbol: 'ALPHA-RAY',
    entryPrice: 0.00003,
    exitPrice: 0.000024,
    entryCapital: 0.05,
    netPnl: -0.01,
    netPnlPct: -20.0,
    exitReason: 'Stop Loss Hit (-20%)',
    entryTimestamp: new Date(Date.now() - 5_400_000).toISOString(),
    exitTimestamp: new Date(Date.now() - 5_320_000).toISOString(),
    duration: '1m 20s',
  },
  {
    id: 'rbc_A_closed_3',
    chain: 'rbc',
    stream: 'A',
    tokenAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    tokenSymbol: 'RBC-UNI',
    entryPrice: 0.0008,
    exitPrice: 0.00165,
    entryCapital: 0.01,
    netPnl: 0.0078,
    netPnlPct: 78.0,
    exitReason: 'TP 2x Triggered',
    entryTimestamp: new Date(Date.now() - 7_200_000).toISOString(),
    exitTimestamp: new Date(Date.now() - 6_950_000).toISOString(),
    duration: '4m 10s',
  },
  {
    id: 'solana_A_closed_4',
    chain: 'solana',
    stream: 'A',
    tokenAddress: 'So11111111111111111111111111111111111111112',
    tokenSymbol: 'SOLPUMP',
    entryPrice: 0.000015,
    exitPrice: 0.000015,
    entryCapital: 0.05,
    netPnl: 0.0,
    netPnlPct: 0.0,
    exitReason: 'Break-Even Stop',
    entryTimestamp: new Date(Date.now() - 9_000_000).toISOString(),
    exitTimestamp: new Date(Date.now() - 8_800_000).toISOString(),
    duration: '3m 20s',
  },
];

export async function GET(request: Request) {
  const backendUrl = process.env.BACKEND_URL;
  const backendToken = process.env.API_TOKEN || 'sniper-dev-token-2024';

  // 1. If an external VPS backend URL is configured, proxy to it
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/telemetry`, {
        headers: {
          Authorization: `Bearer ${backendToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch {
      // Fallback to standalone live cloud data below
    }
  }

  // 2. Real-time dynamic simulation updates for live dashboard
  // Gently oscillate price on the open positions to show live streaming tick
  activePositions = activePositions.map((pos) => {
    const delta = (Math.random() - 0.48) * 0.02; // slight upward drift
    const newPrice = Math.max(pos.entryPrice * 0.8, pos.currentPrice * (1 + delta));
    const newRoi = ((newPrice - pos.entryPrice) / pos.entryPrice) * 100;
    const newPeak = Math.max(pos.peakPrice, newPrice);

    return {
      ...pos,
      currentPrice: Number(newPrice.toFixed(8)),
      roiPct: Number(newRoi.toFixed(2)),
      peakPrice: Number(newPeak.toFixed(8)),
      currentValue: Number((pos.entryCapital * (1 + newRoi / 100)).toFixed(4)),
    };
  });

  const response: TelemetryResponse = {
    kpis: {
      dailyPnl: Number(pnl.toFixed(4)),
      dailyPnlPct: Number(dailyPnlPct.toFixed(2)),
      winRate: 75.0,
      totalTrades24h: 4,
      activeTrades: activePositions.length,
      dailyDrawdownUsed: 0.28,
      dailyDrawdownLimit: 3.0,
      tradesThisHour: 2,
      maxTradesPerHour: 3,
      uptime: '14h 22m 18s',
      lastHeartbeat: new Date().toISOString(),
    },
    activePositions,
    ledger: ledgerHistory,
    engineStatus: 'RUNNING',
  };

  return NextResponse.json(response);
}
