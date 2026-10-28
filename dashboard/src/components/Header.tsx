"use client";

import { Activity, Wifi, WifiOff, AlertCircle } from "lucide-react";
import type { ConnectionStatus } from "@/hooks/useTelemetry";
import { cn } from "@/lib/utils";

interface HeaderProps {
  status: ConnectionStatus;
  lastHeartbeat: string | null;
}

export function Header({ status, lastHeartbeat }: HeaderProps) {
  const statusConfig = {
    connected: {
      dotClass: "bg-emerald-400",
      label: "Live",
      icon: Wifi,
      pulse: true,
    },
    disconnected: {
      dotClass: "bg-amber-400",
      label: "Reconnecting",
      icon: Activity,
      pulse: true,
    },
    error: {
      dotClass: "bg-red-400",
      label: "Offline",
      icon: WifiOff,
      pulse: false,
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const formatHeartbeat = (ts: string | null) => {
    if (!ts) return "—";
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return "—";
    }
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
      {/* Left: Branding */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          <h1 className="text-lg font-bold tracking-tight text-slate-50">
            SNIPER ENGINE
          </h1>
        </div>
        <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-700">
          v2.0
        </span>
      </div>

      {/* Right: Connection status */}
      <div className="flex items-center gap-4">
        {/* Last heartbeat */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
          <span>Last heartbeat:</span>
          <span className="font-mono text-slate-300">
            {formatHeartbeat(lastHeartbeat)}
          </span>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-4 w-px bg-slate-700" />

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                config.dotClass,
                config.pulse && "animate-pulse"
              )}
            />
          </div>
          <StatusIcon className="h-3.5 w-3.5 text-slate-400" />
          <span
            className={cn(
              "text-xs font-medium",
              status === "connected" && "text-emerald-400",
              status === "disconnected" && "text-amber-400",
              status === "error" && "text-red-400"
            )}
          >
            {config.label}
          </span>
        </div>
      </div>
    </header>
  );
}
