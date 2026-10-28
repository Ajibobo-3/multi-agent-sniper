import EventEmitter from 'eventemitter3';
import { TokenDetectedEvent, AuditResult, PaperTradeRecord } from '../types/index.js';

/**
 * Central event bus connecting all subagents in a fully decoupled,
 * non-blocking publish-subscribe architecture.
 */
export interface EventBusMap {
  // Dual-stream token detection
  'token:detected': (event: TokenDetectedEvent) => void;
  'token:detected:streamA': (event: TokenDetectedEvent) => void;
  'token:detected:streamB': (event: TokenDetectedEvent) => void;

  // Audit results
  'token:audited': (result: AuditResult) => void;
  'token:rejected': (result: AuditResult) => void;

  // Trade lifecycle
  'trade:entered': (record: PaperTradeRecord) => void;
  'trade:updated': (record: PaperTradeRecord) => void;
  'trade:closed': (record: PaperTradeRecord) => void;

  // Circuit breaker events
  'circuit:throttled': (data: { reason: string; tradesThisHour: number }) => void;
  'circuit:kill': (data: { reason: string; dailyPnl: number }) => void;

  // Errors
  error: (err: { source: string; error: Error | unknown }) => void;
}

class PipelineEventBus extends EventEmitter<EventBusMap> {
  private static instance: PipelineEventBus;

  private constructor() {
    super();
  }

  public static getInstance(): PipelineEventBus {
    if (!PipelineEventBus.instance) {
      PipelineEventBus.instance = new PipelineEventBus();
    }
    return PipelineEventBus.instance;
  }
}

export const eventBus = PipelineEventBus.getInstance();
