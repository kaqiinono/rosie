'use client'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-50 to-blue-50 px-6 text-center">
      <div className="text-6xl">📡</div>
      <h1 className="text-2xl font-bold text-slate-800">哎呀，没有网络</h1>
      <p className="max-w-sm text-sm leading-relaxed text-slate-500">
        当前没有网络连接。请检查网络设置后重试。
        <br />
        已缓存的页面仍可正常访问。
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 rounded-xl bg-blue-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-blue-600 active:scale-95"
      >
        重试
      </button>
    </div>
  )
}
