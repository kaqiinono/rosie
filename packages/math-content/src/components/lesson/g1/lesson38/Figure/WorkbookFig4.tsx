import Image from 'next/image'

export default function WorkbookFig4() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/ex4.png"
      width={1014}
      height={287}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="闯关4 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
