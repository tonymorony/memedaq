import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { createMint } from '@solana/spl-token';
import * as fs from 'fs';

async function main() {
  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  
  // Load wallet
  let keypairPath = process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;
  if (!fs.existsSync(keypairPath)) {
    console.error(`Keypair file not found: ${keypairPath}`);
    process.exit(1);
  }
  
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
  const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  console.log('Authority:', keypair.publicKey.toString());
  
  // Generate a temporary mint authority (we'll change it later during initialization)
  const tempMintAuthority = Keypair.generate();
  
  try {
    // Create the index mint
    console.log('Creating index mint...');
    const indexMintKeypair = Keypair.generate();
    
    const indexMint = await createMint(
      connection,
      keypair,
      tempMintAuthority.publicKey, // temporary mint authority
      null, // freeze authority
      9, // decimals
      indexMintKeypair
    );
    
    console.log('Index mint created:', indexMint.toString());
    
    // Save configuration
    const configData = {
      indexMint: indexMint.toString(),
      tempMintAuthority: tempMintAuthority.publicKey.toString(),
      tempMintAuthoritySecret: Array.from(tempMintAuthority.secretKey)
    };
    
    fs.writeFileSync('temp-index-config.json', JSON.stringify(configData, null, 2));
    console.log('Temporary configuration saved to temp-index-config.json');
    
    // Update the anchor.ts file with the real index mint
    const anchorTsPath = './apps/web/lib/anchor.ts';
    if (fs.existsSync(anchorTsPath)) {
      let anchorTs = fs.readFileSync(anchorTsPath, 'utf8');
      anchorTs = anchorTs.replace(
        /export const INDEX_MINT = new PublicKey\('[^']+'\);/,
        `export const INDEX_MINT = new PublicKey('${indexMint.toString()}');`
      );
      fs.writeFileSync(anchorTsPath, anchorTs);
      console.log('Updated anchor.ts with real index mint address');
    }
    
    console.log('\n✅ Index mint created successfully!');
    console.log('Next steps:');
    console.log('1. Deploy your anchor program: anchor deploy');
    console.log('2. Initialize the index using the program');
    console.log('3. Transfer mint authority to the program');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);
