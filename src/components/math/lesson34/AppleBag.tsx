'use client'

interface AppleBagProps {
  price: number
  colorClass?: 'blue' | 'pink'
  emoji: string
  delay?: number
  animClass?: string
}

const bagColorMap = {
  blue: 'bg-gradient-to-br from-blue-200 to-blue-500 border-blue-700 before:bg-blue-500 before:border-blue-700',
  pink: 'bg-gradient-to-br from-pink-100 to-pink-500 border-pink-700 before:bg-pink-500 before:border-pink-700',
  default: 'bg-gradient-to-br from-amber-200 to-amber-500 border-amber-600 before:bg-amber-500 before:border-amber-600',
}

export default function AppleBag({ price, colorClass, emoji, delay = 0, animClass = 'animate-fly-in' }: AppleBagProps) {
  const colors = colorClass ? bagColorMap[colorClass] : bagColorMap.default

  return (
    <div
      className={`flex w-[46px] flex-col items-center gap-0.5 transition-all duration-600 ease-[cubic-bezier(.34,1.56,.64,1)] hover:scale-110 hover:-rotate-2 ${animClass}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`relative flex h-[46px] w-[42px] items-center justify-center rounded-[7px_7px_12px_12px] border-[2.5px] shadow-[0_3px_8px_rgba(217,119,6,.2)] before:absolute before:-top-[7px] before:left-1/2 before:-translate-x-1/2 before:h-2.5 before:w-6 before:rounded-t-[5px] before:border-[2.5px] before:border-b-0 before:content-[''] ${colors}`}
      >
        <span className="text-lg">{emoji}</span>
      </div>
      <div className="whitespace-nowrap rounded-[5px] border border-amber-400 bg-amber-50 px-1 text-[10px] font-bold text-amber-800">
        {price}元
      </div>
    </div>
  )
}
