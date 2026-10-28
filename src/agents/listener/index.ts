import { SolanaListener } from './solanaListener.js';
import { RbcListener } from './rbcListener.js';
import { eventBus } from '../../bus/eventBus.js';

/**
 * Listener Agent (The Ear)
 *
 * Orchestrates dual-stream event ingestion across Solana and RBC.
 * Stream A (The Trenches): All new pool initializations.
 * Stream B (The Alpha Hunters): Raydium migrations + Smart Money buys.
 */
export class ListenerAgent {
  private solanaListener: SolanaListener;
  private rbcListener: RbcListener;

  constructor() {
    this.solanaListener = new SolanaListener();
    this.rbcListener = new RbcListener();
  }

  public async start(): Promise<void> {
    console.log('═══════════════════════════════════════════════════════');
    console.log(' 🎧 LISTENER AGENT (THE EAR) — DUAL-STREAM ACTIVE');
    console.log('   Stream A: The Trenches — All new pool inits');
    console.log('   Stream B: Alpha Hunters — Migrations + Smart Money');
    console.log('═══════════════════════════════════════════════════════');

    await Promise.all([this.solanaListener.start(), this.rbcListener.start()]);

    console.log('✅ [ListenerAgent] Subscribed to all Solana & RBC streams.');
  }

  public async stop(): Promise<void> {
    console.log('[ListenerAgent] Shutting down all listeners...');
    await Promise.all([this.solanaListener.stop(), this.rbcListener.stop()]);
  }
}

// Standalone entrypoint for isolated testing
if (
  process.argv[1]?.endsWith('listener/index.ts') ||
  process.argv[1]?.endsWith('listener/index.js')
) {
  const listener = new ListenerAgent();

  eventBus.on('token:detected', (event) => {
    console.log(
      `[EVENT-BUS] Stream ${event.stream} | ${event.chain.toUpperCase()} | ${event.tokenAddress} via ${event.source}`
    );
  });

  listener.start().catch(console.error);

  process.on('SIGINT', async () => {
    await listener.stop();
    process.exit(0);
  });
}
