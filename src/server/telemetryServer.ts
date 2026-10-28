import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Server } from 'http';
import { CONFIG } from '../config/index.js';
import { paperEngine } from '../agents/execution/paperExecutor.js';
import { circuitBreaker } from '../risk/circuitBreaker.js';
import { TelemetryResponse } from '../types/index.js';

export class TelemetryServer {
  private app: express.Application;
  private server: Server | null = null;
  private port: number;
  private bearerToken: string;

  constructor() {
    this.app = express();
    this.port = CONFIG.TELEMETRY.PORT;
    this.bearerToken = CONFIG.TELEMETRY.BEARER_TOKEN;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Enable CORS for frontend dashboard
    this.app.use(
      cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })
    );

    this.app.use(express.json());

    // Bearer token authentication middleware
    const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
      // Allow unauthenticated health check
      if (req.path === '/health') {
        next();
        return;
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or malformed Authorization header. Expected Bearer token.',
        });
        return;
      }

      const token = authHeader.split(' ')[1];
      if (token !== this.bearerToken) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Invalid bearer token.',
        });
        return;
      }

      next();
    };

    this.app.use(authMiddleware);
  }

  private setupRoutes(): void {
    // Public health probe
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * Protected Telemetry Endpoint
     * Returns: kpis, active_positions, ledger (last 50), and engineStatus
     */
    this.app.get('/api/telemetry', (_req: Request, res: Response) => {
      const isKilled = circuitBreaker.getIsKilled();
      const engineStatus = isKilled ? 'KILLED' : 'RUNNING';

      const responsePayload: TelemetryResponse = {
        kpis: paperEngine.getKPIs(),
        activePositions: paperEngine.getActivePositions(),
        ledger: paperEngine.getLedger(50),
        engineStatus,
      };

      res.json(responsePayload);
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log('═══════════════════════════════════════════════════════');
        console.log(` 📡 TELEMETRY BRIDGE ACTIVE`);
        console.log(`   Port: ${this.port} (Hidden local interface)`);
        console.log(`   Endpoint: GET http://localhost:${this.port}/api/telemetry`);
        console.log(`   Auth: Bearer ${this.bearerToken}`);
        console.log('═══════════════════════════════════════════════════════');
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[TelemetryServer] Server stopped.');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export const telemetryServer = new TelemetryServer();
