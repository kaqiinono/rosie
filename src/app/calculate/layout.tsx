export default function CalculateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen text-[15px]"
      style={{
        background: 'linear-gradient(160deg, #06071a 0%, #0d0b26 40%, #120d2e 70%, #0a0918 100%)',
        fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        colorScheme: 'dark',
      }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute top-[6%] left-[8%] h-64 w-64 rounded-full blur-[80px]"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-[40%] right-[5%] h-48 w-48 rounded-full blur-[70px]"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.14) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[15%] left-[12%] h-40 w-40 rounded-full blur-[60px]"
          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.10) 0%, transparent 70%)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, #60a5fa 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>
      <div className="relative">{children}</div>
    </div>
  )
}
