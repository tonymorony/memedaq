import { AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { WalletAdapter } from '@solana/wallet-adapter-base';

// Program ID from Anchor.toml
export const PROGRAM_ID_STRING = 'BKrYs7V1WMXEHYxr61FdUK9wHKrBqrzSzYmNRegts1mG';
export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);

// Import IDL from generated JSON
import IDL_JSON from './meme_index.json';

// IDL for the program
export const IDL = IDL_JSON;

// Asset mints - test tokens on devnet
export const ASSET_MINTS = [
  new PublicKey('BbjYpudvUZySAVXokYt1ARmiZfmvRUtB79HY4CwJz3XF'), // Test Token 1
  new PublicKey('9heNML9CuFqpyiCCaPEK13ZUCSb5Dw2piwJNdY6ZnkRB'), // Test Token 2
  new PublicKey('3kZXRr2cyBbiHzx6n7f1iWaCo4BmyXhtqQAh7vbnDGEv'), // Test Token 3
  new PublicKey('4CgrgJV7fHnF3QzJAUYCoBfWEGtngjko91TucszcRcXy'), // Test Token 4
  new PublicKey('4k6qsq5wutfzpJ8bwRSZGXta5kZyGXEkEbynGZgVgmFZ'), // Test Token 5
];

// Index mint - new one for devnet testing
export const INDEX_MINT = new PublicKey('2BJonFYA2Qd9kgX35oRe71XeU61bxhSJ39shA44EBUSu');

export class MemeIndexClient {
  provider: AnchorProvider;
  program: Program<any>;

  constructor(connection: Connection, wallet: WalletAdapter) {
    // Create wallet adapter wrapper
    const walletAdapter = {
      publicKey: wallet.publicKey,
      signTransaction: async (tx: any) => {
        if (wallet.signTransaction) {
          return await wallet.signTransaction(tx);
        }
        throw new Error('Wallet does not support signTransaction');
      },
      signAllTransactions: async (txs: any[]) => {
        if (wallet.signAllTransactions) {
          return await wallet.signAllTransactions(txs);
        }
        throw new Error('Wallet does not support signAllTransactions');
      },
    };
    
    
    this.provider = new AnchorProvider(
      connection, 
      walletAdapter as any, 
      { 
        commitment: 'confirmed',
        preflightCommitment: 'confirmed'
      }
    );
    
    try {
      console.log('=== DEBUGGING PROGRAM CREATION ===');
      console.log('PROGRAM_ID_STRING:', PROGRAM_ID_STRING);
      console.log('PROGRAM_ID:', PROGRAM_ID);
      console.log('PROGRAM_ID type:', typeof PROGRAM_ID);
      console.log('PROGRAM_ID toString:', PROGRAM_ID.toString());
      
      // Try creating PublicKey inside constructor
      const programId = new PublicKey(PROGRAM_ID_STRING);
      console.log('New PublicKey created:', programId.toString());
      
      console.log('IDL:', IDL);
      console.log('Provider:', this.provider);
      console.log('Provider connection:', this.provider.connection);
      console.log('Provider wallet:', this.provider.wallet);
      
      console.log('Creating Program...');
      // Try creating Program without programId - let Anchor get it from IDL
      try {
        this.program = new Program(IDL as any, this.provider);
        console.log('Program created without programId!');
      } catch (error1) {
        console.log('Failed without programId:', error1);
        console.log('Trying with programId as PublicKey...');
        this.program = new Program(IDL as any, programId, this.provider);
        console.log('Program created with PublicKey!');
      }
      console.log('Program created successfully!');
    } catch (error) {
      console.error('Failed to initialize Anchor program:', error);
      console.error('Error details:', error);
      console.error('Error stack:', error.stack);
      throw new Error('Failed to initialize Anchor program');
    }
  }

  // Get config PDA
  getConfigPDA(indexMint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('config'), indexMint.toBuffer()],
      PROGRAM_ID
    );
  }

  // Get index mint authority PDA
  getIndexMintAuthorityPDA(config: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vault_authority'), config.toBuffer()],
      PROGRAM_ID
    );
  }

  // Initialize index
  async initializeIndex(indexMint: PublicKey, assets: PublicKey[], numAssets: number, exitFeeBps: number): Promise<string> {
    const [config] = this.getConfigPDA(indexMint);

    const tx = await this.program.methods
      .initializeIndex(assets, numAssets, exitFeeBps)
      .accounts({
        authority: this.provider.wallet.publicKey,
        config,
        indexMint,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  // Deposit and mint index tokens
  async depositAndMint(userPubkey: PublicKey, indexMint: PublicKey, amounts: number[]): Promise<string> {
    const [config] = this.getConfigPDA(indexMint);
    const [indexMintAuthority] = this.getIndexMintAuthorityPDA(config);
    
    const depositorIndexATA = await getAssociatedTokenAddress(
      indexMint,
      userPubkey
    );

    // ATA will be created automatically by the program with init_if_needed
    console.log('ATA will be created automatically by program if needed');

    // Get config to see what assets are actually configured
    const configData = await this.getIndexConfig(indexMint);
    if (!configData || !configData.assetsMints) {
      throw new Error('Index config not found or has no assets');
    }
    
    console.log('Using assets from config:', configData.assetsMints.map((m: any) => m.toString()));

    // Get remaining accounts: for each asset we need 3 accounts
    const remainingAccounts = [];
    console.log('Building remaining accounts...');
    for (let i = 0; i < configData.assetsMints.length; i++) {
      const assetMint = configData.assetsMints[i];
      // Depositor's asset ATA (where tokens come from)
      const depositorAssetATA = await getAssociatedTokenAddress(assetMint, userPubkey);
      // Vault ATA (where tokens go) - owned by index_mint_authority (vault authority)
      const [indexMintAuthority] = this.getIndexMintAuthorityPDA(config);
      const vaultAssetATA = await getAssociatedTokenAddress(assetMint, indexMintAuthority, true); // true = allowOwnerOffCurve
      
      console.log(`Asset ${i}:`, {
        mint: assetMint.toString(),
        depositorATA: depositorAssetATA.toString(),
        vaultATA: vaultAssetATA.toString()
      });

      // Check if depositor has this asset ATA, if not create it
      try {
        await this.provider.connection.getTokenAccountBalance(depositorAssetATA);
        console.log(`Depositor ATA ${i} exists`);
      } catch (error) {
        console.log(`Depositor ATA ${i} does NOT exist - creating it...`);
        // Create ATA and mint some test tokens
        const { createAssociatedTokenAccountInstruction, createMintToInstruction } = await import('@solana/spl-token');
        const { Transaction } = await import('@solana/web3.js');
        
        // Create ATA instruction
        const createATAIx = createAssociatedTokenAccountInstruction(
          userPubkey, // payer
          depositorAssetATA, // ata
          userPubkey, // owner
          assetMint // mint
        );
        
        // For paper trading: mint some test tokens 
        // Note: This will fail if user is not mint authority, but ATA will still be created
        const mintIx = createMintToInstruction(
          assetMint, // mint
          depositorAssetATA, // destination
          userPubkey, // authority (assume user is mint authority for test tokens)
          1000 * 1e9 // amount (1000 tokens with 9 decimals)
        );
        
        const tx = new Transaction().add(createATAIx, mintIx);
        const signature = await this.provider.sendAndConfirm(tx);
        console.log(`Created ATA and minted tokens for asset ${i}:`, signature);
      }

      // Check if vault ATA exists, if not create it
      try {
        await this.provider.connection.getTokenAccountBalance(vaultAssetATA);
        console.log(`Vault ATA ${i} exists`);
      } catch (error) {
        console.log(`Vault ATA ${i} does NOT exist - creating it...`);
        const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
        const { Transaction } = await import('@solana/web3.js');
        
        // Create vault ATA instruction
        const createVaultATAIx = createAssociatedTokenAccountInstruction(
          userPubkey, // payer (user pays for creation)
          vaultAssetATA, // ata
          indexMintAuthority, // owner (vault authority)
          assetMint // mint
        );
        
        const tx = new Transaction().add(createVaultATAIx);
        const signature = await this.provider.sendAndConfirm(tx);
        console.log(`Created vault ATA for asset ${i}:`, signature);
      }
      
      remainingAccounts.push(
        { pubkey: depositorAssetATA, isWritable: true, isSigner: false },   // i * 3 + 0
        { pubkey: vaultAssetATA, isWritable: true, isSigner: false },       // i * 3 + 1  
        { pubkey: assetMint, isWritable: false, isSigner: false }           // i * 3 + 2
      );
    }

    try {
      const tx = await this.program.methods
        .depositAndMint(amounts.map(a => new BN(a)))
        .accounts({
          depositor: userPubkey,
          config,
          indexMint,
          indexMintAuthority,
          depositorIndexAta: depositorIndexATA,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .rpc();
      
      return tx;
    } catch (error: any) {
      console.error('Transaction error:', error);
      if (error.transactionLogs) {
        console.error('Transaction logs:', error.transactionLogs);
      }
      throw error;
    }

    return tx;
  }

  // Paper trading version - deposit SOL and mint index tokens (simulate token purchases)
  async depositSolAndMint(userPubkey: PublicKey, indexMint: PublicKey, solAmount: number): Promise<string> {
    const [config] = this.getConfigPDA(indexMint);
    const [indexMintAuthority] = this.getIndexMintAuthorityPDA(config);
    
    const depositorIndexATA = await getAssociatedTokenAddress(
      indexMint,
      userPubkey
    );

    console.log('Paper trading deposit:', {
      solAmount,
      config: config.toString(),
      indexMint: indexMint.toString(),
      indexMintAuthority: indexMintAuthority.toString(),
      depositorIndexATA: depositorIndexATA.toString()
    });

    // For paper trading, we don't need remaining accounts (no real token transfers)
    // We just track the SOL value and mint proportional index tokens
    
    // Get config to see how many assets we need
    const configData = await this.getIndexConfig(indexMint);
    if (!configData || !configData.assetsMints) {
      throw new Error('Index config not found or has no assets');
    }
    
    // For paper trading: distribute SOL amount equally among all assets (simulate purchases)
    const perAssetAmount = Math.floor(solAmount / configData.assetsMints.length);
    const amounts = configData.assetsMints.map(() => new BN(perAssetAmount));
    
    console.log('Paper trading amounts:', amounts.map(a => a.toString()));

    // For paper trading, use our devnet tokens as substitutes for the configured mainnet tokens
    // This allows us to test the flow without having real BONK, WIF, etc. on devnet
    const remainingAccounts = [];
    for (let i = 0; i < configData.assetsMints.length; i++) {
      // Use our devnet token as substitute for the configured mainnet token
      const substituteAssetMint = ASSET_MINTS[i] || ASSET_MINTS[0]; // fallback to first token
      const depositorAssetATA = await getAssociatedTokenAddress(substituteAssetMint, userPubkey);
      const vaultAssetATA = await getAssociatedTokenAddress(substituteAssetMint, indexMintAuthority, true);
      
      console.log(`Using substitute token ${i}:`, {
        configured: configData.assetsMints[i].toString(),
        substitute: substituteAssetMint.toString()
      });
      
      remainingAccounts.push(
        { pubkey: depositorAssetATA, isWritable: true, isSigner: false },   // i * 3 + 0
        { pubkey: vaultAssetATA, isWritable: true, isSigner: false },       // i * 3 + 1  
        { pubkey: substituteAssetMint, isWritable: false, isSigner: false } // i * 3 + 2
      );
    }

    // Paper trading version: pass amounts but they represent SOL value, not real tokens
    const tx = await this.program.methods
      .depositAndMint(amounts) // Pass correct number of amounts (representing SOL distribution)
      .accounts({
        depositor: userPubkey,
        config,
        indexMint,
        indexMintAuthority,
        depositorIndexAta: depositorIndexATA,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccounts)
      .rpc();

    return tx;
  }

  // Redeem index tokens to basket
  async redeemToBasket(userPubkey: PublicKey, indexMint: PublicKey, sharesIn: number): Promise<string> {
    const [config] = this.getConfigPDA(indexMint);
    const [indexMintAuthority] = this.getIndexMintAuthorityPDA(config);
    
    const depositorIndexATA = await getAssociatedTokenAddress(
      indexMint,
      userPubkey
    );

    const tx = await this.program.methods
      .redeemToBasket(new BN(sharesIn))
      .accounts({
        depositor: userPubkey,
        config,
        indexMint,
        indexMintAuthority,
        depositorIndexAta: depositorIndexATA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  // Get index config
  async getIndexConfig(indexMint: PublicKey) {
    const [config] = this.getConfigPDA(indexMint);
    
    try {
      return await (this.program.account as any).config.fetch(config);
    } catch (error) {
      console.error('Error fetching config:', error);
      return null;
    }
  }

  // Get user's index token balance (with demo simulation)
  async getUserIndexBalance(userPubkey: PublicKey, indexMint: PublicKey): Promise<number> {
    try {
      const userIndexATA = await getAssociatedTokenAddress(indexMint, userPubkey);
      const accountInfo = await this.provider.connection.getTokenAccountBalance(userIndexATA);
      return accountInfo.value.uiAmount || 0;
    } catch (error) {
      console.error('Error getting user index balance:', error);
      // For demo: return mock balance from localStorage
      const storageKey = `demo_index_balance_${userPubkey.toString()}`;
      const stored = localStorage.getItem(storageKey);
      const mockBalance = stored ? parseFloat(stored) : 0;
      console.log(`Demo: Returning mock index balance ${mockBalance.toFixed(4)} from localStorage`);
      return mockBalance;
    }
  }

  // Helper method to get user's asset token account
  async getUserAssetATA(userPubkey: PublicKey, assetMint: PublicKey): Promise<PublicKey> {
    return await getAssociatedTokenAddress(assetMint, userPubkey);
  }

  // Get user's asset token balances
  async getUserAssetBalances(userPubkey: PublicKey): Promise<{ [mint: string]: number }> {
    const balances: { [mint: string]: number } = {};
    
    for (const assetMint of ASSET_MINTS) {
      try {
        const userAssetATA = await this.getUserAssetATA(userPubkey, assetMint);
        const accountInfo = await this.provider.connection.getTokenAccountBalance(userAssetATA);
        balances[assetMint.toString()] = accountInfo.value.uiAmount || 0;
      } catch (error) {
        // Token account might not exist
        balances[assetMint.toString()] = 0;
      }
    }
    
    return balances;
  }
}
