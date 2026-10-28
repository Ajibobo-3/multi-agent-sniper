"use client";

import { Crosshair, Clock } from "lucide-react";
import type { ActivePosition } from "@/types/telemetry";
import { cn } from "@/lib/utils";

interface OperationsMatrixProps {
  positions: ActivePosition[];
}

function formatPrice(price: number): string {
  if (price < 0.001) return price.toExponential(2);
  if (price < 1) return price.toFixed(6);
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatTimeSince(timestamp: string): string {
  try {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "<1m";
    if (diffMin < 60) return `${diffMin}m`;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return `${hours}h ${mins}m`;
  } catch {
    return "—";
  }
}

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function OperationsMatrix({ positions }: OperationsMatrixProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900">
      {/* Section Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800">
        <Crosshair className="h-4 w-4 text-blue-500" />
        <h2 className="text-sm font-semibold text-slate-50">Open Positions</h2>
        <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-700">
          {positions.length}
        </span>
      </div>

      {/* Table */}
      {positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <Crosshair className="h-8 w-8 mb-3 text-slate-600" />
          <p className="text-sm">No active positions</p>
          <p className="text-xs text-slate-500 mt-1">
            Positions will appear here when the engine opens trades
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  Chain
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  Stream
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  Token
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                  Entry Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                  Current Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                  ROI %
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                  Stop Loss
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                  Time Open
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {positions.map((pos) => (
                <tr
                  key={pos.id}
                  className="hover:bg-slate-800/50 transition-colors"
                >
                  {/* Chain */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                        pos.chain === "solana"
                          ? "bg-purple-500/10 text-purple-400 ring-purple-500/30"
                          : "bg-blue-500/10 text-blue-400 ring-blue-500/30"
                      )}
                    >
                      {pos.chain === "solana" ? "SOL" : "RBC"}
                    </span>
                  </td>

                  {/* Stream */}
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                        pos.stream === "A"
                          ? "bg-slate-500/10 text-slate-300 ring-slate-500/30"
                          : "bg-blue-500/10 text-blue-400 ring-blue-500/30"
                      )}
                    >
                      {pos.stream === "A" ? "Trenches" : "Alpha"}
                    </span>
                  </td>

                  {/* Token */}
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-50">
                        {pos.tokenSymbol}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        {truncateAddress(pos.tokenAddress)}
                      </p>
                    </div>
                  </td>

                  {/* Entry Price */}
                  <td className="px-4 py-3 text-right font-mono text-slate-300 tabular-nums">
                    ${formatPrice(pos.entryPrice)}
                  </td>

                  {/* Current Price */}
                  <td className="px-4 py-3 text-right font-mono text-slate-300 tabular-nums">
                    ${formatPrice(pos.currentPrice)}
                  </td>

                  {/* ROI % */}
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-mono font-semibold tabular-nums",
                      pos.roiPct >= 0 ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {pos.roiPct >= 0 ? "+" : ""}
                    {pos.roiPct.toFixed(2)}%
                  </td>

                  {/* Stop Loss */}
                  <td className="px-4 py-3 text-right font-mono text-slate-400 tabular-nums">
                    ${formatPrice(pos.stopLossPrice)}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                        pos.status === "OPEN"
                          ? "bg-blue-500/10 text-blue-400 ring-blue-500/30"
                          : "bg-amber-500/10 text-amber-400 ring-amber-500/30"
                      )}
                    >
                      {pos.status === "HALF_CLOSED" ? "Half Closed" : "Open"}
                    </span>
                  </td>

                  {/* Time Open */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 text-slate-400">
                      <Clock className="h-3 w-3" />
                      <span className="text-xs tabular-nums">
                        {formatTimeSince(pos.entryTimestamp)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
