import { SolanaAuditor } from './solanaAuditor.js';
import { RbcAuditor } from './rbcAuditor.js';
import { eventBus } from '../../bus/eventBus.js';
import { TokenDetectedEvent, AuditResult } from '../../types/index.js';

/**
 * Auditor Agent (The Shield)
 *
 * Listens for incoming token detections from both streams (A and B).
 * Executes strict sub-second heuristic checks before passing to execution:
 *   - Solana: RugCheck API (requires riskLevel: "good") + fallback on-chain RPC checks
 *   - RBC: Bytecode static analysis for mint/freeze selectors + LP lock/burn
 *   - Global: Mint authority revoked, freeze disabled, 100% LP locked/burned, top 10 < 15%
 */
export class AuditorAgent {
  private solanaAuditor: SolanaAuditor;
  private rbcAuditor: RbcAuditor;

  constructor() {
    this.solanaAuditor = new SolanaAuditor();
    this.rbcAuditor = new RbcAuditor();
  }

  public start(): void {
    console.log('═══════════════════════════════════════════════════════');
    console.log(' 🛡️ AUDITOR AGENT (THE SHIELD) — SUB-SECOND HEURISTICS');
    console.log('   Solana: RugCheck (riskLevel: "good") + RPC Gate');
    console.log('   RBC: Bytecode static inspection + LP burn');
    console.log('═══════════════════════════════════════════════════════');

    // Asynchronously audit incoming tokens without blocking the event loop
    eventBus.on('token:detected', (event: TokenDetectedEvent) => {
      this.processToken(event).catch((err) => {
        console.error(`[AuditorAgent] Unexpected audit failure for ${event.tokenAddress}:`, err);
      });
    });
  }

  public async processToken(event: TokenDetectedEvent): Promise<AuditResult> {
    const streamName = event.stream === 'A' ? 'Trenches' : 'Alpha';
    console.log(
      `🛡️ [AuditorAgent] [Stream ${event.stream}: ${streamName}] Auditing ${event.chain.toUpperCase()} token: ${event.tokenAddress}...`
    );

    let result: AuditResult;
    if (event.chain === 'solana') {
      result = await this.solanaAuditor.auditToken(event);
    } else {
      result = await this.rbcAuditor.auditToken(event);
    }

    if (result.passed) {
      console.log(
        `✅ [AuditorAgent] Token PASSED safety heuristics in ${result.latencyMs}ms: ${event.tokenAddress}`
      );
      eventBus.emit('token:audited', result);
    } else {
      console.log(
        `❌ [AuditorAgent] Token REJECTED in ${result.latencyMs}ms: ${event.tokenAddress}`
      );
      console.log(`   Failure reasons: ${result.failureReasons.join(' | ')}`);
      eventBus.emit('token:rejected', result);
    }

    return result;
  }
}
