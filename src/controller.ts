import { sixAgentEngine } from './engine.js';
import { telemetryServer } from './server/telemetryServer.js';

export class SniperController {
  public async start(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║       6-AGENT SEQUENTIAL SOLANA & RBC TRADING DESK ENGINE              ║');
    console.log('║       Protecting Balance First. Profit Second.                         ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝');

    // 1. Start Telemetry Server for 24/7 overnight monitoring
    await telemetryServer.start();

    // 2. Start the 6-Agent Sequential Trading Engine
    await sixAgentEngine.start();
  }

  public async stop(): Promise<void> {
    console.log('[Controller] Stopping 6-agent engine...');
    sixAgentEngine.stop();
    await telemetryServer.stop();
  }
}
