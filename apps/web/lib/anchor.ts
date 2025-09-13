import { AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { WalletAdapter } from '@solana/wallet-adapter-base';

// Program ID from Anchor.toml
export const PROGRAM_ID_STRING = 'BKrYs7V1WMXEHYxr61FdUK9wHKrBqrzSzYmNRegts1mG';
export const PROGRAM_ID = new PublicKey(PROGRAM_ID_STRING);

// IDL for the program
export const IDL = {
  "version": "0.1.0",
  "name": "meme_index",
  "instructions": [
    {
      "name": "initializeIndex",
      "accounts": [
        {
          "name": "authority",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "indexMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "assets",
          "type": {
            "array": [
              "publicKey",
              5
            ]
          }
        },
        {
          "name": "numAssets",
          "type": "u8"
        },
        {
          "name": "exitFeeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "depositAndMint",
      "accounts": [
        {
          "name": "depositor",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "indexMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "indexMintAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "depositorIndexAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "associatedTokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amounts",
          "type": {
            "vec": "u64"
          }
        }
      ]
    },
    {
      "name": "redeemToBasket",
      "accounts": [
        {
          "name": "depositor",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "indexMint",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "indexMintAuthority",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "depositorIndexAta",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "sharesIn",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "Config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "indexMint",
            "type": "publicKey"
          },
          {
            "name": "exitFeeBps",
            "type": "u16"
          },
          {
            "name": "numAssets",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "totalShares",
            "type": "u64"
          },
          {
            "name": "assetsMints",
            "type": {
              "array": [
                "publicKey",
                5
              ]
            }
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidNumAssets",
      "msg": "Invalid number of assets"
    },
    {
      "code": 6001,
      "name": "BumpNotFound",
      "msg": "Bump not found"
    },
    {
      "code": 6002,
      "name": "InvalidArrayLen",
      "msg": "Mismatched array length"
    },
    {
      "code": 6003,
      "name": "AccountsMismatch",
      "msg": "Remaining accounts malformed"
    },
    {
      "code": 6004,
      "name": "MintOrderMismatch",
      "msg": "Mint order mismatch"
    },
    {
      "code": 6005,
      "name": "MathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6006,
      "name": "ZeroDeposit",
      "msg": "Zero deposit"
    },
    {
      "code": 6007,
      "name": "InvalidPerShareUnits",
      "msg": "Per-share units invalid"
    },
    {
      "code": 6008,
      "name": "InsufficientProportions",
      "msg": "Deposit not proportional to basket"
    },
    {
      "code": 6009,
      "name": "Internal",
      "msg": "Internal error"
    },
    {
      "code": 6010,
      "name": "InvalidShareAmount",
      "msg": "Invalid share amount"
    }
  ],
  "metadata": {
    "address": "BKrYs7V1WMXEHYxr61FdUK9wHKrBqrzSzYmNRegts1mG"
  }
};

// Asset mints from your config
export const ASSET_MINTS = [
  new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'), // BONK
  new PublicKey('EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'), // WIF
  new PublicKey('HaP8r3ksG76PhQLTqR8FYBeNiQpejcFbQmiHbg787Ut1'), // TRUMP
  new PublicKey('7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr'), // POPCAT
  new PublicKey('ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82')  // BOME
];

// Index mint (you'll need to create this)
export const INDEX_MINT = new PublicKey('39VQAzk3GFhKUzyYSBNXu1Zqqh5FxNJegcFyNjEiQyL8'); // Placeholder - replace with actual mint

export class MemeIndexClient {
  public program: Program;
  public provider: AnchorProvider;

  constructor(connection: Connection, wallet: WalletAdapter) {
    console.log('MemeIndexClient constructor called with:', {
      connection: !!connection,
      wallet: !!wallet,
      publicKey: wallet?.publicKey?.toString(),
      hasSignTransaction: !!wallet?.signTransaction,
      hasSignAllTransactions: !!wallet?.signAllTransactions,
      hasSendTransaction: !!wallet?.sendTransaction
    });
    
    // Check if wallet is properly connected
    if (!wallet.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    // Check if wallet has required methods
    if (!wallet.sendTransaction) {
      throw new Error('Wallet does not support transaction sending');
    }
    
    // Check if wallet has signing methods
    if (!wallet.signTransaction && !wallet.signAllTransactions) {
      throw new Error('Wallet does not support transaction signing');
    }
    
    // Create a proper wallet adapter for Anchor
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

  // Get vault authority PDA
  getVaultAuthorityPDA(config: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vault_authority'), config.toBuffer()],
      PROGRAM_ID
    );
  }

  // Get vault ATA for an asset
  async getVaultATA(assetMint: PublicKey, vaultAuthority: PublicKey): Promise<PublicKey> {
    return await getAssociatedTokenAddress(assetMint, vaultAuthority, true);
  }

  // Get user's index token ATA
  async getUserIndexATA(userPubkey: PublicKey, indexMint: PublicKey): Promise<PublicKey> {
    return await getAssociatedTokenAddress(indexMint, userPubkey);
  }

  // Get user's asset token ATA
  async getUserAssetATA(userPubkey: PublicKey, assetMint: PublicKey): Promise<PublicKey> {
    return await getAssociatedTokenAddress(assetMint, userPubkey);
  }

  // Deposit and mint index shares
  async depositAndMint(
    userPubkey: PublicKey,
    indexMint: PublicKey,
    amounts: number[]
  ) {
    // Check if index is initialized
    const config = await this.getConfig(indexMint);
    if (!config) {
      throw new Error('Index not initialized yet. Please initialize the index first.');
    }

    const [configPDA] = this.getConfigPDA(indexMint);
    const [vaultAuthority] = this.getVaultAuthorityPDA(configPDA);
    const userIndexATA = await this.getUserIndexATA(userPubkey, indexMint);

    // Prepare remaining accounts (user ATAs, vault ATAs, mints for each asset)
    const remainingAccounts = [];
    for (const assetMint of ASSET_MINTS) {
      const userAssetATA = await this.getUserAssetATA(userPubkey, assetMint);
      const vaultAssetATA = await this.getVaultATA(assetMint, vaultAuthority);
      
      remainingAccounts.push(
        { pubkey: userAssetATA, isSigner: false, isWritable: true },
        { pubkey: vaultAssetATA, isSigner: false, isWritable: true },
        { pubkey: assetMint, isSigner: false, isWritable: false }
      );
    }

    return await this.program.methods
      .depositAndMint(amounts.map(a => new BN(a)))
      .accounts({
        depositor: userPubkey,
        config: configPDA,
        indexMint,
        indexMintAuthority: vaultAuthority,
        depositorIndexAta: userIndexATA,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remainingAccounts)
      .rpc();
  }

  // Redeem index shares to basket
  async redeemToBasket(
    userPubkey: PublicKey,
    indexMint: PublicKey,
    sharesAmount: number
  ) {
    // Check if index is initialized
    const config = await this.getConfig(indexMint);
    if (!config) {
      throw new Error('Index not initialized yet. Please initialize the index first.');
    }

    const [configPDA] = this.getConfigPDA(indexMint);
    const [vaultAuthority] = this.getVaultAuthorityPDA(configPDA);
    const userIndexATA = await this.getUserIndexATA(userPubkey, indexMint);

    // Prepare remaining accounts (user ATAs, vault ATAs for each asset)
    const remainingAccounts = [];
    for (const assetMint of ASSET_MINTS) {
      const userAssetATA = await this.getUserAssetATA(userPubkey, assetMint);
      const vaultAssetATA = await this.getVaultATA(assetMint, vaultAuthority);
      
      remainingAccounts.push(
        { pubkey: userAssetATA, isSigner: false, isWritable: true },
        { pubkey: vaultAssetATA, isSigner: false, isWritable: true }
      );
    }

    return await this.program.methods
      .redeemToBasket(new BN(sharesAmount))
      .accounts({
        depositor: userPubkey,
        config: configPDA,
        indexMint,
        indexMintAuthority: vaultAuthority,
        depositorIndexAta: userIndexATA,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(remainingAccounts)
      .rpc();
  }

  // Get config account data
  async getConfig(indexMint: PublicKey) {
    const [config] = this.getConfigPDA(indexMint);
    try {
      return await (this.program.account as any).config.fetch(config);
    } catch (error) {
      console.log('Config not found, may need initialization');
      return null;
    }
  }

  // Get user's index token balance
  async getUserIndexBalance(userPubkey: PublicKey, indexMint: PublicKey): Promise<number> {
    try {
      const userIndexATA = await this.getUserIndexATA(userPubkey, indexMint);
      const accountInfo = await this.provider.connection.getTokenAccountBalance(userIndexATA);
      return accountInfo.value.uiAmount || 0;
    } catch (error) {
      console.log('User index ATA not found or empty');
      return 0;
    }
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
        balances[assetMint.toString()] = 0;
      }
    }
    
    return balances;
  }
}
