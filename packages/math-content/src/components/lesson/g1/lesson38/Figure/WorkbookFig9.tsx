import Image from 'next/image'

export default function WorkbookFig9() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/ex9.png"
      width={889}
      height={581}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="闯关9 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
