import Image from 'next/image'

export default function WorkbookFig2() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/ex2.png"
      width={1097}
      height={226}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="闯关2 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
