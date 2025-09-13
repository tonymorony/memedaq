import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids');
  const vs_currencies = searchParams.get('vs_currencies') || 'usd';
  const include_24hr_change = searchParams.get('include_24hr_change') || 'true';

  if (!ids) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 });
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vs_currencies}&include_24hr_change=${include_24hr_change}`;
    
    console.log('Fetching from CoinGecko:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MemeIndex/1.0'
      },
      // Add cache to reduce API calls
      next: { revalidate: 60 } // Cache for 60 seconds
    });

    console.log('CoinGecko response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('CoinGecko API error:', response.status, errorText);
      
      // If rate limited, return mock data instead of error
      if (response.status === 429) {
        console.log('Rate limited, returning mock data');
        const mockData: { [key: string]: any } = {};
        const coinIds = ids.split(',');
        coinIds.forEach(id => {
          mockData[id] = {
            usd: 0.01, // Mock price
            usd_24h_change: 0 // Mock change
          };
        });
        return NextResponse.json(mockData);
      }
      
      throw new Error(`CoinGecko API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('CoinGecko data received:', Object.keys(data));
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('CoinGecko API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch data from CoinGecko', details: errorMessage },
      { status: 500 }
    );
  }
}
