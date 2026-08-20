'use client'

export default function LoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-black/30 backdrop-blur-sm"
    >
      <picture>
        {/* Animated WebP must stay unoptimized so the browser receives every frame. */}
        <img
          src="/brand/rosie-fun-hop.webp?v=3"
          alt="Rosie Fun"
          width={126}
          height={112}
          className="home-rosie-animation h-28 w-[126px] object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.25)] md:h-40 md:w-[180px] lg:h-48 lg:w-[216px]"
        />
        <img
          src="/brand/rosie-fun-mascot.png"
          alt="Rosie Fun"
          width={126}
          height={112}
          className="home-rosie-static hidden h-28 w-[126px] object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.25)] md:h-40 md:w-[180px] lg:h-48 lg:w-[216px]"
        />
      </picture>
      <p className="text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">加载中...</p>
    </div>
  )
}
