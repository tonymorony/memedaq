import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { createMint, TOKEN_PROGRAM_ID, MINT_SIZE, createInitializeMintInstruction } from '@solana/spl-token';
import { AnchorProvider, Program, BN, Wallet } from '@coral-xyz/anchor';
import * as fs from 'fs';

// Program ID from Anchor.toml
const PROGRAM_ID = new PublicKey('ktxbiTFN7oCBThyRz4L4sKDhSNvguVJguzsod1x8sdi');

// Asset mints (your 5 meme tokens)
const ASSET_MINTS = [
  new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'), // BONK
  new PublicKey('EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'), // WIF
  new PublicKey('HaP8r3ksG76PhQLTqR8FYBeNiQpejcFbQmiHbg787Ut1'), // TRUMP
  new PublicKey('7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr'), // POPCAT
  new PublicKey('ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82')  // BOME
];

// IDL (simplified for initialization)
const IDL = {
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
  ]
};

async function main() {
  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load wallet (you need to have a keypair file)
  let keypairPath = process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;
  if (!fs.existsSync(keypairPath)) {
    console.error(`Keypair file not found: ${keypairPath}`);
    console.log('Please set ANCHOR_WALLET environment variable or ensure ~/.config/solana/id.json exists');
    process.exit(1);
  }
  
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
  const wallet = new Wallet(keypair);
  
  console.log('Authority:', keypair.publicKey.toString());
  
  // Create provider and program
  const provider = new AnchorProvider(connection, wallet, {});
  const program = new Program(IDL as any, PROGRAM_ID, provider);
  
  // Generate a new keypair for the index mint
  const indexMintKeypair = Keypair.generate();
  console.log('Generated Index Mint:', indexMintKeypair.publicKey.toString());
  
  // Get config PDA
  const [config, configBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('config'), indexMintKeypair.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log('Config PDA:', config.toString());
  
  // Get vault authority PDA
  const [vaultAuthority, vaultAuthorityBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_authority'), config.toBuffer()],
    PROGRAM_ID
  );
  console.log('Vault Authority PDA:', vaultAuthority.toString());
  
  try {
    // Step 1: Create the index mint
    console.log('Creating index mint...');
    const indexMint = await createMint(
      connection,
      keypair,
      vaultAuthority, // mint authority
      null, // freeze authority
      9, // decimals
      indexMintKeypair
    );
    console.log('Index mint created:', indexMint.toString());
    
    // Step 2: Initialize the index
    console.log('Initializing index...');
    const tx = await program.methods
      .initializeIndex(
        ASSET_MINTS,
        5, // num_assets
        50 // exit_fee_bps (0.5%)
      )
      .accounts({
        authority: keypair.publicKey,
        config,
        indexMint: indexMintKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log('Index initialized! Transaction:', tx);
    
    // Save the index mint address to a file
    const configData = {
      indexMint: indexMintKeypair.publicKey.toString(),
      config: config.toString(),
      vaultAuthority: vaultAuthority.toString(),
      assetMints: ASSET_MINTS.map(mint => mint.toString()),
      programId: PROGRAM_ID.toString()
    };
    
    fs.writeFileSync('index-config.json', JSON.stringify(configData, null, 2));
    console.log('Configuration saved to index-config.json');
    
    // Update the anchor.ts file with the real index mint
    const anchorTsPath = './apps/web/lib/anchor.ts';
    if (fs.existsSync(anchorTsPath)) {
      let anchorTs = fs.readFileSync(anchorTsPath, 'utf8');
      anchorTs = anchorTs.replace(
        /export const INDEX_MINT = new PublicKey\('[^']+'\);/,
        `export const INDEX_MINT = new PublicKey('${indexMintKeypair.publicKey.toString()}');`
      );
      fs.writeFileSync(anchorTsPath, anchorTs);
      console.log('Updated anchor.ts with real index mint address');
    } else {
      console.log('anchor.ts file not found at:', anchorTsPath);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);
