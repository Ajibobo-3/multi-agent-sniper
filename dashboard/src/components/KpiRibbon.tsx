import React from 'react';
import { TelemetryData } from '@/types/telemetry';

interface KpiRibbonProps {
  telemetry: TelemetryData;
}

export const KpiRibbon: React.FC<KpiRibbonProps> = ({ telemetry }) => {
  const { kpis, currentBalance, engineStatus } = telemetry;

  const isProfitable = kpis.dailyPnl >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
      {/* 1. Wallet Balance Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Wallet Balance</span>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-2xl font-bold text-white">{currentBalance.toFixed(4)} SOL</span>
        </div>
      </div>

      {/* 2. Net P&L (24h) Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Net P&L (24h)</span>
        <div className="flex items-baseline gap-2 mt-2">
          <span className={`text-2xl font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isProfitable ? `+$${kpis.dailyPnl.toFixed(2)}` : `-$${Math.abs(kpis.dailyPnl).toFixed(2)}`}
          </span>
          <span className={`text-xs font-medium ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isProfitable ? `+${kpis.dailyPnlPct.toFixed(2)}%` : `${kpis.dailyPnlPct.toFixed(2)}%`}
          </span>
        </div>
      </div>

      {/* 3. Win Rate Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Win Rate</span>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-2xl font-bold text-white">{kpis.winRate.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
          <div 
            className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
            style={{ width: `${Math.min(100, Math.max(0, kpis.winRate))}%` }}
          />
        </div>
      </div>

      {/* 4. Active Trades Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Trades</span>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-2xl font-bold text-white">{kpis.activeTrades}</span>
          <span className="text-xs text-slate-400">({kpis.tradesThisHour}/{kpis.maxTradesPerHour} this hour)</span>
        </div>
      </div>

      {/* 5. Drawdown Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Daily Drawdown</span>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-2xl font-bold text-rose-400">-${kpis.dailyDrawdownUsed.toFixed(2)}</span>
          <span className="text-xs text-slate-400">/ ${kpis.dailyDrawdownLimit.toFixed(2)}</span>
        </div>
      </div>

      {/* 6. Engine Status Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Engine Status</span>
        <div className="flex items-center gap-2 mt-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${engineStatus === 'RUNNING' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-lg font-semibold text-white">{engineStatus}</span>
        </div>
        <span className="text-xs text-slate-400 mt-1 truncate">{kpis.uptime}</span>
      </div>
    </div>
  );
};