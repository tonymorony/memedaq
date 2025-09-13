# MEMEDAQ Index

*Like NASDAQ, but for Solana degens*

This is an equal-weight index fund containing the top 5 Solana meme tokens. You deposit SOL, get exposure to the whole basket, and can redeem anytime. Built during the Solana Day hackathon by Decentrathon & Solana Superteam Kazakhstan.

**Currently deployed on Devnet only**

## What's in here

This repo contains everything needed to run the index:

**programs/meme_index/** - The Solana program (written in Anchor)
- Handles deposits and withdrawals
- Mints/burns index tokens representing your share
- Charges 0.5% fee when you exit
- Manages the token vault

**apps/web/** - The web interface 
- Connect your wallet, see prices, trade
- Uses Jupiter for all the token swaps
- Gets live prices from CoinGecko
- Talks directly to our Solana program

**Key addresses:**
- Index token: `39VQAzk3GFhKUzyYSBNXu1Zqqh5FxNJegcFyNjEiQyL8`
- Program: `ktxbiTFN7oCBThyRz4L4sKDhSNvguVJguzsod1x8sdi`

## How it works

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           🚀 MEMEDAQ INDEX FLOW                               │
└─────────────────────────────────────────────────────────────────────────────────┘

💰 DEPOSIT FLOW:
┌─────────┐    ┌──────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  User   │───▶│   Program    │───▶│   Jupiter DEX   │───▶│   Token Vault   │
│ (SOL)   │    │              │    │                 │    │ (BONK,WIF,etc.) │
└─────────┘    └──────────────┘    └─────────────────┘    └─────────────────┘
     │                │                        │                     │
     │                ▼                        │                     │
     │         ┌──────────────┐                │                     │
     │         │ Mint INDEX   │◀───────────────┘                     │
     │         │   Tokens     │                                      │
     │         └──────────────┘                                      │
     │                │                                              │
     │                ▼                                              │
     └─────────▶ 📊 INDEX TOKENS                                     │
               (Your share of basket)                                │
                                                                     │
🔄 REDEEM FLOW:                                                      │
┌─────────┐    ┌──────────────┐    ┌─────────────────┐              │
│  User   │◀───│   Program    │◀───│   Jupiter DEX   │◀─────────────┘
│ (SOL)   │    │              │    │                 │
└─────────┘    └──────────────┘    └─────────────────┘
     ▲                ▲                        ▲
     │                │                        │
     │         ┌──────────────┐                │
     │         │ Burn INDEX   │                │
     │         │   Tokens     │────────────────┘
     │         └──────────────┘
     │                ▲
     │                │
     └─────────── 📊 INDEX TOKENS
                (Burned for redemption)

📊 BASKET COMPOSITION (Equal Weight):
┌─────────────────────────────────────────────────────────────┐
│  🐕 BONK (20%)  │  🐶 WIF (20%)   │  🇺🇸 TRUMP (20%)      │
│  🐱 POPCAT (20%) │  📚 BOME (20%)  │                      │
└─────────────────────────────────────────────────────────────┘

💡 KEY FEATURES:
• 🔄 Auto-rebalancing on every deposit/withdrawal
• 💰 0.5% exit fee (protocol revenue)
• 🏪 Built on Jupiter for best swap prices
• 🔒 Decentralized vault (no admin keys)
• ⚡ Instant liquidity via Solana
```

**Depositing:**
1. You send SOL
2. We swap it into equal amounts of all 5 meme tokens using Jupiter
3. Those tokens get locked in the program vault
4. You get index tokens back representing your share of the basket

**Redeeming:**
1. Send your index tokens to the program
2. Get back your proportional share of all the vault tokens
3. We automatically swap those back to SOL for you
4. Pay 0.5% exit fee (goes to the protocol)

**The basket contains:**
- BONK
- WIF
- TRUMP
- POPCAT
- BOME

Each token gets exactly 20% allocation, rebalanced on every deposit/withdrawal.

## Running it locally

You'll need Node.js 18+, a Solana wallet (Phantom works), and some devnet SOL.

```bash
git clone <this-repo>
cd solana-meme-index
npm install --legacy-peer-deps
cd apps/web && npm install --legacy-peer-deps
npm run dev
```

Open http://localhost:3000, connect your wallet, switch to Devnet, and you're good to go.

If you want to mess with the Solana program:

```bash
anchor build
anchor deploy  # deploys to devnet
npm run init-index  # sets up the index
```

Make sure your wallet is set to devnet and has some SOL. You can get devnet SOL from any faucet.

**Note:** Use `--legacy-peer-deps` flag due to some dependency conflicts with Solana wallet adapters.

## Testing the app

1. Make sure you have a Solana wallet extension (Phantom recommended)
2. Switch your wallet to **Devnet** 
3. Get some devnet SOL from a faucet (search "solana devnet faucet")
4. Open http://localhost:3000
5. Connect your wallet
6. Try depositing a small amount (like 0.1 SOL)

**Current status:** The app will swap SOL to meme tokens via Jupiter, but the on-chain index program needs to be initialized first. You'll see an error "Index not initialized yet" when trying to deposit.

## Tech stack

**Blockchain stuff:**
- Solana (obviously)
- Anchor framework for the program
- SPL tokens

**Frontend:**
- Next.js 14 + TypeScript
- Solana wallet adapter for connecting wallets

**External APIs:**
- Jupiter for all token swaps (they have the best routes)
- CoinGecko for live price data

The whole thing is pretty straightforward - we're not trying to reinvent the wheel, just put together existing pieces in a useful way.

## Why we built this

This was our entry for the Solana Day hackathon (Decentrathon + Solana Superteam Kazakhstan). 

The idea came from seeing how hard it is to get balanced exposure to meme tokens. You either have to:
1. Buy each token individually (expensive, time-consuming)
2. Try to maintain equal weights yourself (impossible)
3. Miss out on the action entirely

With this index, you just send SOL and get instant diversified exposure. When you want out, everything gets converted back to SOL automatically.

We wanted to show that you can build useful DeFi products on Solana without overcomplicating things. Sometimes the simplest solution is the best one.

## What's next

Right now this works on devnet. Next steps:
- Get the program fully initialized and tested
- Deploy to mainnet
- Maybe add more tokens to the basket
- Could add a governance token later
- Auto-rebalancing based on market cap changes

## Contributing

Found a bug? Have an idea? Open an issue or send a PR.

## License

MIT - do whatever you want with this code.
