import FlipbookLayoutEffects from '@/components/flipbook/FlipbookLayoutEffects'

export default function FlipbookLayout({ children }: { children: React.ReactNode }) {
  return (
    <FlipbookLayoutEffects>
      <div className="flipbook-module min-h-screen text-[15px] text-[var(--flipbook-fg)]">
        {children}
      </div>
    </FlipbookLayoutEffects>
  )
}
