import Image from 'next/image'

export default function WorkbookFig10() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/ex10.png"
      width={463}
      height={534}
      sizes="(max-width: 640px) 100vw, 463px"
      alt="闯关10 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
