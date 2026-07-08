import type { Metadata } from 'next'
import { Fraunces, Inter_Tight, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['opsz'],
})

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-inter-tight',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'Houses of Thought — Structured, Defensible Reasoning',
  description:
    'Build the reasoning, not just the answer. Houses of Thought turns a question into structured, defensible reasoning, with AI that guides instead of deciding.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${interTight.variable} ${geistMono.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
