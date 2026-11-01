import Image from 'next/image'

export default function WorkbookFig6() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/ex6.png"
      width={577}
      height={181}
      sizes="(max-width: 640px) 100vw, 577px"
      alt="闯关6 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
