export default function CalcLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen text-[15px]"
      style={{
        background: '#06071a',
        fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        colorScheme: 'dark',
      }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            // visual-ok: 深色背景点阵纹理
            backgroundImage: 'radial-gradient(circle, #a78bfa 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>
      <div className="relative">{children}</div>
    </div>
  )
}
