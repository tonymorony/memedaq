### Web app

- Network: mainnet-beta (wallet adapter).
- Uses Jupiter quote/swap API for SOL↔basket swaps.
- Resolves mints by symbol using Jupiter token list; replace with fixed mints for safety.

Env (optional):
- None required for Jupiter public API. If you deploy a custom RPC, set it in `providers.tsx`.

Next steps:
- Provide index program ID, index mint, and vault authority details to wire on-chain `deposit_and_mint`/`redeem_to_basket`.
- Replace dynamic symbol→mint resolution with your curated list in `apps/web/public/assets.testnet.json`.
