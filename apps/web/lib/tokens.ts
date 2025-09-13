const TOKEN_LIST_URL = 'https://tokens.jup.ag/tokens?tags=verified';

export type TokenInfo = { address: string; symbol: string; name: string; decimals: number };

let cache: TokenInfo[] | null = null;

export async function fetchTokenList(): Promise<TokenInfo[]> {
	if (cache) return cache;
	const res = await fetch(TOKEN_LIST_URL);
	if (!res.ok) throw new Error('Failed to fetch token list');
	const list = await res.json();
	cache = list;
	return list;
}

export async function resolveMintBySymbol(symbol: string): Promise<string | null> {
	const list = await fetchTokenList();
	const token = list.find((t: any) => t.symbol.toUpperCase() === symbol.toUpperCase());
	return token?.address ?? null;
}
