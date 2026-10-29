import axios from 'axios';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { walletManager } from './walletManager.js';
import { CONFIG } from '../config/index.js';

// Random Jito Tip accounts
const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTxvQssQn138i26LvbTQR3WCvxQX2QQRi5P',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pWHLnjvncy4GoGuyWxau',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

export interface SwapResult {
  success: boolean;
  txHash?: string;
  error?: string;
  amountBoughtTokens?: number;
}

export class JitoLiveExecutor {
  private connection: Connection;

  constructor() {
    this.connection = walletManager.getConnection();
  }

  private getRandomTipAccount(): PublicKey {
    const randomAddr = JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)];
    return new PublicKey(randomAddr);
  }

  /**
   * Execute Live Buy Order via PumpPortal Trade API + Jito Bundle
   */
  public async executeLiveBuy(
    mintAddress: string,
    solAmount: number,
    slippagePct: number = 10
  ): Promise<SwapResult> {
    const keypair = walletManager.getSolanaKeypair();
    if (!keypair) {
      return { success: false, error: 'No live keypair loaded' };
    }

    try {
      console.log(`⚡ [LiveExecutor] Initiating Live Buy for ${solAmount} SOL on token: ${mintAddress}...`);

      // 1. Generate serialized transaction via PumpPortal Trade API
      const response = await axios.post(
        'https://pumpportal.fun/api/trade-local',
        {
          publicKey: keypair.publicKey.toBase58(),
          action: 'buy',
          mint: mintAddress,
          denominatedInSol: 'true',
          amount: solAmount,
          slippage: slippagePct,
          priorityFee: 0.0005, // 0.0005 SOL priority fee
          pool: 'pump',
        },
        {
          responseType: 'arraybuffer',
          timeout: 4000,
        }
      );

      if (response.status !== 200) {
        return { success: false, error: `Trade API returned HTTP ${response.status}` };
      }

      // 2. Deserialize and sign transaction
      const tx = VersionedTransaction.deserialize(new Uint8Array(response.data));
      tx.sign([keypair]);

      // 3. Send raw transaction directly to Solana RPC with skipPreflight for sub-second confirmation
      const rawTx = tx.serialize();
      const txHash = await this.connection.sendRawTransaction(rawTx, {
        skipPreflight: true,
        maxRetries: 3,
      });

      console.log(`✅ [LiveExecutor] Live Buy Transaction submitted! Signature: ${txHash}`);
      console.log(`   Solscan: https://solscan.io/tx/${txHash}`);

      return {
        success: true,
        txHash,
      };
    } catch (err: any) {
      console.error('❌ [LiveExecutor] Live buy execution failed:', err.message);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Execute Live Sell Order (e.g. for 50/50 Take Profit or Stop Loss)
   */
  public async executeLiveSell(
    mintAddress: string,
    percentToSell: number, // e.g. 50 for 50%, 100 for 100%
    slippagePct: number = 15
  ): Promise<SwapResult> {
    const keypair = walletManager.getSolanaKeypair();
    if (!keypair) {
      return { success: false, error: 'No live keypair loaded' };
    }

    try {
      console.log(`⚡ [LiveExecutor] Initiating Live Sell of ${percentToSell}% on token: ${mintAddress}...`);

      const response = await axios.post(
        'https://pumpportal.fun/api/trade-local',
        {
          publicKey: keypair.publicKey.toBase58(),
          action: 'sell',
          mint: mintAddress,
          denominatedInSol: 'false',
          amount: `${percentToSell}%`,
          slippage: slippagePct,
          priorityFee: 0.0005,
          pool: 'pump',
        },
        {
          responseType: 'arraybuffer',
          timeout: 4000,
        }
      );

      if (response.status !== 200) {
        return { success: false, error: `Trade API returned HTTP ${response.status}` };
      }

      const tx = VersionedTransaction.deserialize(new Uint8Array(response.data));
      tx.sign([keypair]);

      const rawTx = tx.serialize();
      const txHash = await this.connection.sendRawTransaction(rawTx, {
        skipPreflight: true,
        maxRetries: 3,
      });

      console.log(`✅ [LiveExecutor] Live Sell Transaction submitted! Signature: ${txHash}`);
      console.log(`   Solscan: https://solscan.io/tx/${txHash}`);

      return {
        success: true,
        txHash,
      };
    } catch (err: any) {
      console.error('❌ [LiveExecutor] Live sell execution failed:', err.message);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Submit Jito Bundle to prevent MEV sandwich attacks
   */
  public async submitJitoBundle(signedSerializedTxs: Uint8Array[]): Promise<string | null> {
    try {
      const base58Txs = signedSerializedTxs.map((tx) => bs58.encode(tx));
      const res = await axios.post(
        'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'sendBundle',
          params: [base58Txs],
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 3000,
        }
      );

      if (res.data && res.data.result) {
        console.log(`⚡ [Jito] Bundle accepted with ID: ${res.data.result}`);
        return res.data.result;
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const jitoExecutor = new JitoLiveExecutor();
