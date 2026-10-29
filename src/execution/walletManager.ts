import bs58 from 'bs58';
import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { CONFIG } from '../config/index.js';

export class WalletManager {
  private static instance: WalletManager;
  private solanaKeypair: Keypair | null = null;
  private connection: Connection;

  private constructor() {
    this.connection = new Connection(CONFIG.SOLANA.RPC_URL, 'confirmed');
    this.loadSolanaWallet();
  }

  public static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager();
    }
    return WalletManager.instance;
  }

  private loadSolanaWallet(): void {
    const rawKey = process.env.SOLANA_PRIVATE_KEY?.trim();
    if (!rawKey) {
      console.log('ℹ️ [WalletManager] No SOLANA_PRIVATE_KEY configured. Running in Paper Mode.');
      return;
    }

    try {
      let cleanKey = rawKey;
      if (
        (cleanKey.startsWith('"') && cleanKey.endsWith('"')) ||
        (cleanKey.startsWith("'") && cleanKey.endsWith("'"))
      ) {
        cleanKey = cleanKey.slice(1, -1);
      }

      // Check if it's JSON array format [12,34,...] or Base58 string
      if (cleanKey.startsWith('[') && cleanKey.endsWith(']')) {
        const arr = JSON.parse(cleanKey);
        this.solanaKeypair = Keypair.fromSecretKey(Uint8Array.from(arr));
      } else {
        const decoded = bs58.decode(cleanKey);
        this.solanaKeypair = Keypair.fromSecretKey(decoded);
      }

      console.log('═══════════════════════════════════════════════════════');
      console.log(' 🔑 LIVE SOLANA WALLET LOADED');
      console.log(`    Address: ${this.solanaKeypair.publicKey.toBase58()}`);
      console.log('═══════════════════════════════════════════════════════');
    } catch (err: any) {
      console.error('❌ [WalletManager] Failed to parse SOLANA_PRIVATE_KEY:', err.message);
    }
  }

  public getSolanaKeypair(): Keypair | null {
    return this.solanaKeypair;
  }

  public getSolanaPublicKey(): PublicKey | null {
    return this.solanaKeypair ? this.solanaKeypair.publicKey : null;
  }

  public async getSolanaBalance(): Promise<number> {
    if (!this.solanaKeypair) return 0;
    try {
      const lamports = await this.connection.getBalance(this.solanaKeypair.publicKey, 'confirmed');
      return lamports / LAMPORTS_PER_SOL;
    } catch {
      return 0;
    }
  }

  public getConnection(): Connection {
    return this.connection;
  }
}

export const walletManager = WalletManager.getInstance();
