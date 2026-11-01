import Image from 'next/image'

export default function WorkbookFig12() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/ex12.png"
      width={754}
      height={508}
      sizes="(max-width: 640px) 100vw, 754px"
      alt="闯关12 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
