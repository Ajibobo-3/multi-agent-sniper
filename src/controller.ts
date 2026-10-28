import { ListenerAgent } from './agents/listener/index.js';
import { AuditorAgent } from './agents/auditor/index.js';
import { ExecutionAgent } from './agents/execution/index.js';
import { telemetryServer } from './server/telemetryServer.js';

export class SniperController {
  private listener: ListenerAgent;
  private auditor: AuditorAgent;
  private execution: ExecutionAgent;

  constructor() {
    this.listener = new ListenerAgent();
    this.auditor = new AuditorAgent();
    this.execution = new ExecutionAgent();
  }

  public async start(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║     MULTI-AGENT ON-CHAIN SNIPER & RISK ENGINE v2.0 (SOLANA & RBC)      ║');
    console.log('║     Streams: A (The Trenches) & B (The Alpha Hunters)                  ║');
    console.log('║     Mode: TELEMETRY & PAPER TRADING WITH AUTONOMOUS CIRCUIT BREAKER    ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝');

    // 1. Start Telemetry Server for Frontend Bridge
    await telemetryServer.start();

    // 2. Start Execution & Dynamic Risk Engine
    this.execution.start();

    // 3. Start Auditor Agent (The Shield)
    this.auditor.start();

    // 4. Start Dual-Stream Listener Agent (The Ear)
    await this.listener.start();

    console.log('\n🚀 [Controller] Full multi-agent pipeline and telemetry server are live.');
  }

  public async stop(): Promise<void> {
    console.log('[Controller] Shutting down sniper pipeline...');
    await Promise.all([this.listener.stop(), telemetryServer.stop()]);
  }
}
