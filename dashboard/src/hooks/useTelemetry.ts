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

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:7777";
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN ?? "";
const POLL_INTERVAL = 3000;

export function useTelemetry(): UseTelemetryReturn {
  const [data, setData] = useState<TelemetryResponse | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const consecutiveErrors = useRef(0);

  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/telemetry`, {
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

      // After 3 consecutive failures, mark as error; otherwise show as disconnected (reconnecting)
      if (consecutiveErrors.current >= 3) {
        setStatus("error");
      } else {
        setStatus("disconnected");
      }
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchTelemetry();

    // Set up polling interval
    const interval = setInterval(fetchTelemetry, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  return { data, status, lastUpdate, error };
}
