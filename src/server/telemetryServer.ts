import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Server } from 'http';
import { CONFIG } from '../config/index.js';
import { executorAgent } from '../agents/4_executor.js';
import { riskAgent } from '../agents/5_risk.js';
import { loggerAgent } from '../agents/6_logger.js';

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
    this.app.use(
      cors({
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      })
    );

    this.app.use(express.json());

    // Bearer token authentication
    const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
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
    // Health probe
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        engine: '6-agent-sequential-engine',
        timestamp: new Date().toISOString(),
      });
    });

    /**
     * Protected Telemetry Endpoint (/api/telemetry)
     */
    this.app.get('/api/telemetry', (_req: Request, res: Response) => {
      const recap = loggerAgent.generateMorningRecap();
      const activePositions = riskAgent.getActivePositions();
      const recentTrades = loggerAgent.getRecentTrades();
      const recentKills = loggerAgent.getRecentKills();
      const currentBalance = executorAgent.getPaperBalance();

      // Mapped KPI format for dashboard compatibility
      const kpis = {
        dailyPnl: recap.netProfit,
        dailyPnlPct: recap.netProfitPct,
        winRate: recap.totalTrades > 0 ? (recap.winningTrades / recap.totalTrades) * 100 : 0,
        totalTrades24h: recap.totalTrades,
        activeTrades: activePositions.length,
        dailyDrawdownUsed: Math.abs(Math.min(0, recap.netProfit)),
        dailyDrawdownLimit: 1.0,
        tradesThisHour: activePositions.length,
        maxTradesPerHour: 3,
        uptime: '24/7 Overnight Autonomous',
        lastHeartbeat: new Date().toISOString(),
      };

      res.json({
        engineStatus: 'RUNNING',
        currentBalance,
        kpis,
        recap,
        activePositions,
        ledger: recentTrades,
        recentKills,
        lastHeartbeat: new Date().toISOString(),
      });
    });

    /**
     * Dedicated Morning Recap endpoint
     */
    this.app.get('/api/recap', (_req: Request, res: Response) => {
      res.json(loggerAgent.generateMorningRecap());
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log('═══════════════════════════════════════════════════════');
        console.log(` 📡 6-AGENT TELEMETRY SERVER ACTIVE`);
        console.log(`    Port: ${this.port}`);
        console.log(`    Telemetry: GET http://localhost:${this.port}/api/telemetry`);
        console.log(`    Morning Recap: GET http://localhost:${this.port}/api/recap`);
        console.log(`    Auth: Bearer ${this.bearerToken}`);
        console.log('═══════════════════════════════════════════════════════');
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[TelemetryServer] Stopped.');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export const telemetryServer = new TelemetryServer();
