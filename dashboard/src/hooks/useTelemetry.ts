"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { TelemetryResponse } from "@/types/telemetry";

export type ConnectionStatus = "connected" | "disconnected" | "error";

interface UseTelemetryReturn {
  data: TelemetryResponse | null;
  status: ConnectionStatus;
  lastUpdate: Date | null;
  error: string | null;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || "sniper-dev-token-2024";
const POLL_INTERVAL = 2500;

export function useTelemetry(): UseTelemetryReturn {
  const [data, setData] = useState<TelemetryResponse | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const consecutiveErrors = useRef(0);

  const fetchTelemetry = useCallback(async () => {
    // 1. Try external backend URL if specified
    if (BACKEND_URL) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/telemetry`, {
          headers: {
            Authorization: `Bearer ${API_TOKEN}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });

        if (res.ok) {
          const json: TelemetryResponse = await res.json();
          setData(json);
          setStatus("connected");
          setLastUpdate(new Date());
          setError(null);
          consecutiveErrors.current = 0;
          return;
        }
      } catch {
        // Fallback to internal same-origin route below
      }
    }

    // 2. Fetch from same-origin internal Next.js telemetry route
    try {
      const res = await fetch("/api/telemetry", {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json: TelemetryResponse = await res.json();
      setData(json);
      setStatus("connected");
      setLastUpdate(new Date());
      setError(null);
      consecutiveErrors.current = 0;
    } catch (err) {
      consecutiveErrors.current += 1;
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);

      if (consecutiveErrors.current >= 3) {
        setStatus("error");
      } else {
        setStatus("disconnected");
      }
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  return { data, status, lastUpdate, error };
}
