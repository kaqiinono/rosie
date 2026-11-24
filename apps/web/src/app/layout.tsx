import { Theme } from '@rosie/ui/themes'
import type { Metadata, Viewport } from 'next'
import { ServiceWorkerRegistrar } from '@rosie/ui'
import BaiduAudioSessionCleanup from '@/components/BaiduAudioSessionCleanup'
import ExamSessionLifecycle from '@/components/exams/ExamSessionLifecycle'
import { AuthProvider, ImmersiveProvider } from '@rosie/core'
import AppContent from '@/components/AppContent'
import { OfflineAccount } from '@/components/offline/OfflineEntry'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rosie 的炸弹乐园',
  description: '数学和英语互动学习平台',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
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
      <body className="text-text-primary min-h-screen font-sans antialiased">
        <Theme
          appearance="light"
          accentColor="amber"
          grayColor="sand"
          radius="full"
          panelBackground="solid"
          hasBackground={false}
        >
          <AuthProvider>
            <OfflineAccount />
            <BaiduAudioSessionCleanup />
            <ExamSessionLifecycle />
            <ImmersiveProvider>
              <ServiceWorkerRegistrar />
              <AppContent>{children}</AppContent>
            </ImmersiveProvider>
          </AuthProvider>
        </Theme>
      </body>
    </html>
  )
}
