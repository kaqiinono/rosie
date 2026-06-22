import type { Metadata, Viewport } from 'next'
import ServiceWorkerRegistrar from '@/components/shared/ServiceWorkerRegistrar'
import { AuthProvider } from '@rosie/core'
import { ImmersiveProvider } from '@/contexts/ImmersiveContext'
import TopRightBar from '@/components/shared/TopRightBar'
import AuthGuard from '@/components/shared/AuthGuard'
import { StarHudProvider } from '@rosie/rewards'
import { StarBurst as StarBurstOverlay } from '@rosie/rewards'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rosie 的学习乐园',
  description: '数学和英语互动学习平台',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/icons/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rosie学习',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f0f4ff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen font-sans text-text-primary antialiased">
        <AuthProvider>
          <ImmersiveProvider>
            <ServiceWorkerRegistrar />
            <AuthGuard>
              <StarHudProvider>
                <TopRightBar />
                {children}
                <StarBurstOverlay />
              </StarHudProvider>
            </AuthGuard>
          </ImmersiveProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
