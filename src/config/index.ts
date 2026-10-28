import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  EXECUTION_MODE: (process.env.EXECUTION_MODE || 'PAPER') as 'PAPER' | 'LIVE',

  SOLANA: {
    RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    WSS_URL: process.env.SOLANA_WSS_URL || 'wss://api.mainnet-beta.solana.com',
    HELIUS_API_KEY: process.env.HELIUS_API_KEY || '',
    PUMP_PORTAL_WSS: process.env.PUMP_PORTAL_WSS || 'wss://pumpportal.fun/api/data',
    RAYDIUM_AMM_PROGRAM_ID:
      process.env.RAYDIUM_AMM_PROGRAM_ID || '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    BUY_AMOUNT_SOL: parseFloat(process.env.SOLANA_BUY_AMOUNT || '0.05'),
    RUGCHECK_API_URL: 'https://api.rugcheck.xyz/v1/tokens',
  },

  RBC: {
    CHAIN_ID: parseInt(process.env.RBC_CHAIN_ID || '4663', 10),
    RPC_URL: process.env.RBC_RPC_URL || 'https://rpc.robinhood.chain',
    WSS_URL: process.env.RBC_WSS_URL || 'wss://rpc.robinhood.chain/ws',
    DEX_FACTORY_ADDRESS: (process.env.RBC_DEX_FACTORY_ADDRESS ||
      '0x0000000000000000000000000000000000000000') as `0x${string}`,
    WRAPPED_NATIVE_TOKEN: (process.env.RBC_WRAPPED_NATIVE_TOKEN ||
      '0x0000000000000000000000000000000000000000') as `0x${string}`,
    BUY_AMOUNT_ETH: parseFloat(process.env.RBC_BUY_AMOUNT_ETH || '0.01'),
  },

  RISK: {
    TP_50_50_THRESHOLD: parseFloat(process.env.TP_50_50_THRESHOLD || '2.0'),
    TRAILING_BE_THRESHOLD: parseFloat(process.env.TRAILING_BE_THRESHOLD || '1.5'),
    HARD_FLOOR_STOP_LOSS: parseFloat(process.env.HARD_FLOOR_STOP_LOSS || '0.20'),
    MAX_TRAILING_DRAWDOWN: parseFloat(process.env.MAX_TRAILING_DRAWDOWN || '0.20'),
  },

  CIRCUIT: {
    DAILY_KILL_SWITCH_USD: parseFloat(process.env.DAILY_KILL_SWITCH_USD || '-3.00'),
    MAX_TRADES_PER_HOUR: parseInt(process.env.MAX_TRADES_PER_HOUR || '3', 10),
  },

  SMART_MONEY_WALLETS: (process.env.SMART_MONEY_WALLETS || '').split(',').filter(Boolean),

  TELEMETRY: {
    PORT: parseInt(process.env.TELEMETRY_PORT || '7777', 10),
    BEARER_TOKEN: process.env.TELEMETRY_BEARER_TOKEN || 'sniper-dev-token-2024',
  },

  LOGS: {
    PAPER_TRADES_PATH: process.env.PAPER_TRADES_LOG_FILE || './logs/paper_trades.jsonl',
  },
};
