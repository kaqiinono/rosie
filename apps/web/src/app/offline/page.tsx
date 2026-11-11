'use client'

import { Button } from '@rosie/ui/themes'

export default function OfflinePage() {
  return (
    <div className="bg-kid-paper flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-6xl">📡</div>
      <h1 className="text-2xl font-bold text-slate-800">哎呀，没有网络</h1>
      <p className="max-w-sm text-sm leading-relaxed text-slate-500">
        当前没有网络连接。请检查网络设置后重试。
        <br />
        已缓存的页面仍可正常访问。
      </p>
      <Button
        onClick={() => window.location.reload()}
        variant="solid"
        color="blue"
        size="2"
        className="mt-2"
      >
        重试
      </Button>
    </div>
  )
}
