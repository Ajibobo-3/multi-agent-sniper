import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
  EXECUTION_MODE: (process.env.EXECUTION_MODE || 'PAPER') as 'PAPER' | 'LIVE',

  // 1. SCOUT SETTINGS
  SCOUT: {
    MIN_AGE_MINUTES: 30,
    MAX_AGE_HOURS: 72,
    MIN_MCAP_USD: 300_000,
    MAX_MCAP_USD: 20_000_000,
    POLL_INTERVAL_MS: 15_000,
  },

  // 2. FILTER SETTINGS (8 Zero-Tolerance Rules)
  FILTER: {
    MIN_LIQUIDITY_USD: 40_000,
    MIN_VOLUME_1H_USD: 50_000,
    MAX_TOP10_HOLDERS_PCT: 25.0,
    MAX_DEV_WALLET_PCT: 3.0,
    MAX_BUNDLED_LAUNCH_PCT: 10.0,
    MAX_PRICE_CHANGE_1H_PCT: 80.0,
  },

  // 3. ANALYST SETTINGS
  ANALYST: {
    MIN_SCORE_THRESHOLD: 70,
  },

  // 4. EXECUTOR SETTINGS
  EXECUTOR: {
    MAX_POSITION_PCT_OF_BALANCE: 0.08,
    DEFAULT_PAPER_BALANCE_SOL: 0.016, // ~$3 bankroll
    SOL_PRICE_ESTIMATE_USD: 185.0,
  },

  // 5. RISK SETTINGS
  RISK: {
    HARD_STOP_LOSS_PCT: 0.06,
    TRAILING_STOP_TRIGGER_PCT: 0.12,
    TRAILING_DRAWDOWN_PCT: 0.04,
    // Backwards compatibility
    TP_50_50_THRESHOLD: 2.0,
    TRAILING_BE_THRESHOLD: 1.5,
    HARD_FLOOR_STOP_LOSS: 0.20,
    MAX_TRAILING_DRAWDOWN: 0.20,
  },

  // 6. LOGGER & TELEMETRY
  LOGS: {
    PAPER_TRADES_PATH: process.env.PAPER_TRADES_LOG_FILE || './logs/paper_trades.jsonl',
    MORNING_RECAP_PATH: './logs/morning_recap.json',
  },

  CIRCUIT: {
    DAILY_KILL_SWITCH_USD: parseFloat(process.env.DAILY_KILL_SWITCH_USD || '-1.00'),
    MAX_TRADES_PER_HOUR: parseInt(process.env.MAX_TRADES_PER_HOUR || '3', 10),
  },

  SOLANA: {
    RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    WSS_URL: process.env.SOLANA_WSS_URL || 'wss://api.mainnet-beta.solana.com',
    HELIUS_API_KEY: process.env.HELIUS_API_KEY || '',
    PUMP_PORTAL_WSS: process.env.PUMP_PORTAL_WSS || 'wss://pumpportal.fun/api/data',
    RAYDIUM_AMM_PROGRAM_ID:
      process.env.RAYDIUM_AMM_PROGRAM_ID || '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    BUY_AMOUNT_SOL: parseFloat(process.env.SOLANA_BUY_AMOUNT || '0.005'),
    RUGCHECK_API_URL: 'https://api.rugcheck.xyz/v1/tokens',
    PRIVATE_KEY: process.env.SOLANA_PRIVATE_KEY || '',
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

  SMART_MONEY_WALLETS: (process.env.SMART_MONEY_WALLETS || '').split(',').filter(Boolean),

  TELEMETRY: {
    PORT: parseInt(process.env.TELEMETRY_PORT || '7777', 10),
    BEARER_TOKEN: process.env.TELEMETRY_BEARER_TOKEN || 'sniper-dev-token-2024',
  },
};
