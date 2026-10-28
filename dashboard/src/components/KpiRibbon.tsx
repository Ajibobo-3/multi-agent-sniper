"use client";

import {
  DollarSign,
  TrendingUp,
  BarChart3,
  ShieldAlert,
  Cpu,
} from "lucide-react";
import type { KPIs } from "@/types/telemetry";
import { cn } from "@/lib/utils";

interface KpiRibbonProps {
  kpis: KPIs;
  engineStatus: "RUNNING" | "PAUSED" | "KILLED";
}

export function KpiRibbon({ kpis, engineStatus }: KpiRibbonProps) {
  const pnlPositive = kpis.dailyPnl >= 0;
  const drawdownPct =
    kpis.dailyDrawdownLimit > 0
      ? (kpis.dailyDrawdownUsed / kpis.dailyDrawdownLimit) * 100
      : 0;
  const drawdownSeverity =
    drawdownPct >= 80 ? "critical" : drawdownPct >= 50 ? "warning" : "normal";

  const statusConfig = {
    RUNNING: { label: "Running", className: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30" },
    PAUSED: { label: "Paused", className: "bg-amber-500/15 text-amber-400 ring-amber-500/30" },
    KILLED: { label: "Killed", className: "bg-red-500/15 text-red-400 ring-red-500/30" },
  };

  const statusCfg = statusConfig[engineStatus];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Card 1: Net P&L */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Net P&L (24h)
          </span>
        </div>
        <p
          className={cn(
            "text-2xl font-bold tabular-nums",
            pnlPositive ? "text-emerald-400" : "text-red-400"
          )}
        >
          {pnlPositive ? "+" : ""}${kpis.dailyPnl.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <p
          className={cn(
            "text-xs mt-1 tabular-nums",
            pnlPositive ? "text-emerald-400/70" : "text-red-400/70"
          )}
        >
          {pnlPositive ? "+" : ""}
          {kpis.dailyPnlPct.toFixed(2)}%
        </p>
      </div>

      {/* Card 2: Win Rate */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Win Rate
          </span>
        </div>
        <p className="text-2xl font-bold tabular-nums text-slate-50">
          {kpis.winRate.toFixed(1)}%
        </p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800">
          <div
            className={cn(
              "h-1.5 rounded-full transition-all duration-500",
              kpis.winRate >= 60
                ? "bg-emerald-500"
                : kpis.winRate >= 40
                ? "bg-amber-500"
                : "bg-red-500"
            )}
            style={{ width: `${Math.min(kpis.winRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Card 3: Active Trades */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Active Trades
          </span>
        </div>
        <p className="text-2xl font-bold tabular-nums text-slate-50">
          {kpis.activeTrades}
        </p>
        <p className="text-xs text-slate-400 mt-1 tabular-nums">
          {kpis.tradesThisHour} / {kpis.maxTradesPerHour} this hour
        </p>
      </div>

      {/* Card 4: Drawdown */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Drawdown
          </span>
        </div>
        <p className="text-2xl font-bold tabular-nums text-slate-50">
          ${kpis.dailyDrawdownUsed.toFixed(2)}
          <span className="text-sm font-normal text-slate-400 ml-1">
            / ${kpis.dailyDrawdownLimit.toFixed(2)}
          </span>
        </p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800">
          <div
            className={cn(
              "h-1.5 rounded-full transition-all duration-500",
              drawdownSeverity === "critical"
                ? "bg-red-500"
                : drawdownSeverity === "warning"
                ? "bg-amber-500"
                : "bg-emerald-500"
            )}
            style={{ width: `${Math.min(drawdownPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Card 5: Engine Status */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Engine Status
          </span>
        </div>
        <div className="mt-1">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2.5 py-1 text-sm font-semibold ring-1 ring-inset",
              statusCfg.className
            )}
          >
            {statusCfg.label}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-2 tabular-nums">
          Uptime: {kpis.uptime}
        </p>
      </div>
    </div>
  );
}
