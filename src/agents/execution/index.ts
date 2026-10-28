import { paperEngine, PaperExecutionEngine } from './paperExecutor.js';

export { paperEngine, PaperExecutionEngine };

export class ExecutionAgent {
  private engine: PaperExecutionEngine;

  constructor() {
    this.engine = paperEngine;
  }

  public start(): void {
    this.engine.start();
  }

  public getEngine(): PaperExecutionEngine {
    return this.engine;
  }
}
