"use client";

import { useState } from "react";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import type { LedgerEntry } from "@/types/telemetry";
import { cn } from "@/lib/utils";

interface ExecutionLedgerProps {
  ledger: LedgerEntry[];
}

const PAGE_SIZE = 10;

function formatPrice(price: number): string {
  if (price < 0.001) return price.toExponential(2);
  if (price < 1) return price.toFixed(6);
  return price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

function getExitReasonBadge(reason: string): {
  label: string;
  className: string;
} {
  const normalized = reason.toLowerCase();
  if (normalized.includes("tp") || normalized.includes("take profit")) {
    return {
      label: reason,
      className: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
    };
  }
  if (normalized.includes("sl") || normalized.includes("stop loss")) {
    return {
      label: reason,
      className: "bg-red-500/10 text-red-400 ring-red-500/30",
    };
  }
  if (normalized.includes("be") || normalized.includes("breakeven")) {
    return {
      label: reason,
      className: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
    };
  }
  if (normalized.includes("trail")) {
    return {
      label: reason,
      className: "bg-blue-500/10 text-blue-400 ring-blue-500/30",
    };
  }
  return {
    label: reason,
    className: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };
}

export function ExecutionLedger({ ledger }: ExecutionLedgerProps) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(ledger.length / PAGE_SIZE));
  const paginatedLedger = ledger.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900">
      {/* Section Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800">
        <ScrollText className="h-4 w-4 text-blue-500" />
        <h2 className="text-sm font-semibold text-slate-50">Trade History</h2>
        <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-700">
          {ledger.length}
        </span>
      </div>

      {/* Table */}
      {ledger.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <ScrollText className="h-8 w-8 mb-3 text-slate-600" />
          <p className="text-sm">No trade history</p>
          <p className="text-xs text-slate-500 mt-1">
            Completed trades will appear here
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    Chain
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    Token
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                    Entry
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                    Exit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                    Net P&L
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                    P&L %
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-400">
                    Exit Reason
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {paginatedLedger.map((entry) => {
                  const badge = getExitReasonBadge(entry.exitReason);
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Time */}
                      <td className="px-4 py-3 text-xs text-slate-400 tabular-nums whitespace-nowrap">
                        {formatTimestamp(entry.exitTimestamp)}
                      </td>

                      {/* Chain */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                            entry.chain === "solana"
                              ? "bg-purple-500/10 text-purple-400 ring-purple-500/30"
                              : "bg-blue-500/10 text-blue-400 ring-blue-500/30"
                          )}
                        >
                          {entry.chain === "solana" ? "SOL" : "RBC"}
                        </span>
                      </td>

                      {/* Token */}
                      <td className="px-4 py-3 font-medium text-slate-50">
                        {entry.tokenSymbol}
                      </td>

                      {/* Entry */}
                      <td className="px-4 py-3 text-right font-mono text-slate-300 tabular-nums">
                        ${formatPrice(entry.entryPrice)}
                      </td>

                      {/* Exit */}
                      <td className="px-4 py-3 text-right font-mono text-slate-300 tabular-nums">
                        ${formatPrice(entry.exitPrice)}
                      </td>

                      {/* Net P&L */}
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-mono font-semibold tabular-nums",
                          entry.netPnl >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        )}
                      >
                        {entry.netPnl >= 0 ? "+" : ""}$
                        {Math.abs(entry.netPnl).toFixed(2)}
                      </td>

                      {/* P&L % */}
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-mono tabular-nums",
                          entry.netPnlPct >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        )}
                      >
                        {entry.netPnlPct >= 0 ? "+" : ""}
                        {entry.netPnlPct.toFixed(2)}%
                      </td>

                      {/* Exit Reason */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3 text-right text-xs text-slate-400 tabular-nums">
                        {entry.duration}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800">
            <p className="text-xs text-slate-400">
              Showing {page * PAGE_SIZE + 1}–
              {Math.min((page + 1) * PAGE_SIZE, ledger.length)} of{" "}
              {ledger.length} trades
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  page === 0
                    ? "text-slate-600 cursor-not-allowed"
                    : "text-slate-300 hover:bg-slate-800 hover:text-slate-50"
                )}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span className="text-xs text-slate-400 tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={page >= totalPages - 1}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  page >= totalPages - 1
                    ? "text-slate-600 cursor-not-allowed"
                    : "text-slate-300 hover:bg-slate-800 hover:text-slate-50"
                )}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
