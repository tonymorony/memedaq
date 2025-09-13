import './globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import Providers from './providers'

export const metadata: Metadata = {
	title: 'MEMEDAQ Index',
	description: 'Index of top Solana meme coins',
}

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				<Providers>
					{children}
				</Providers>
			</body>
		</html>
	)
}
