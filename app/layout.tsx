import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'AeroStage',
  description: 'Weekly swipe-only music-video events for musicians.',
  themeColor: '#7cc7ff',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>
        <div className="pointer-events-none fixed inset-0 aero-spotlight opacity-60 animate-shimmer" />
        {children}
      </body>
    </html>
  )
}
