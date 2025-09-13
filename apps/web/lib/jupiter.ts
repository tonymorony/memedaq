import { VersionedTransaction, PublicKey, Connection } from '@solana/web3.js';

const JUP_API = 'https://quote-api.jup.ag/v6';
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

export type Quote = any;

export async function getQuote(inputMint: string, outputMint: string, amount: number, slippageBps = 50) {
	const url = `${JUP_API}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error('Failed to fetch quote');
	return res.json();
}

export async function executeSwap(connection: Connection, wallet: any, quoteResponse: Quote) {
	const res = await fetch(`${JUP_API}/swap`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ 
			quoteResponse, 
			userPublicKey: wallet.publicKey.toBase58(), 
			wrapAndUnwrapSol: true,
			useSharedAccounts: false, // Disable shared accounts for devnet
			dynamicComputeUnitLimit: true,
			prioritizationFeeLamports: 0
		})
	});
	if (!res.ok) throw new Error('Failed to create swap tx');
	const { swapTransaction } = await res.json();
	const buf = Buffer.from(swapTransaction, 'base64');
	const tx = VersionedTransaction.deserialize(new Uint8Array(buf));
	if (!wallet.signTransaction) {
		throw new Error('Wallet does not support transaction signing');
	}
	const signed = await wallet.signTransaction(tx);
	const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true, maxRetries: 2 });
	await connection.confirmTransaction(sig, 'confirmed');
	return sig;
}
