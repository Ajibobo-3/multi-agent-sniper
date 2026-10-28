"use client";

import { useTelemetry } from "@/hooks/useTelemetry";
import { Header } from "@/components/Header";
import { KpiRibbon } from "@/components/KpiRibbon";
import { OperationsMatrix } from "@/components/OperationsMatrix";
import { ExecutionLedger } from "@/components/ExecutionLedger";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { data, status, lastUpdate, error } = useTelemetry();

  return (
    <div className="min-h-screen bg-slate-950">
      <Header
        status={status}
        lastHeartbeat={data?.kpis.lastHeartbeat ?? null}
      />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Loading state */}
        {!data && status !== "error" && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
            <p className="text-sm">Connecting to engine...</p>
          </div>
        )}

        {/* Error state */}
        {!data && status === "error" && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-6 py-4 text-center">
              <p className="text-sm text-red-400 font-medium">
                Connection Failed
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {error ?? "Unable to reach the engine backend"}
              </p>
            </div>
          </div>
        )}

        {/* Dashboard content */}
        {data && (
          <>
            <KpiRibbon kpis={data.kpis} engineStatus={data.engineStatus} />
            <OperationsMatrix positions={data.activePositions} />
            <ExecutionLedger ledger={data.ledger} />

            {/* Footer timestamp */}
            <div className="text-center">
              <p className="text-xs text-slate-600">
                Last updated:{" "}
                {lastUpdate
                  ? lastUpdate.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                    })
                  : "—"}
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
