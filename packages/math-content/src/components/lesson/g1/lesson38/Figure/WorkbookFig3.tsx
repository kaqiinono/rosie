import Image from 'next/image'

export default function WorkbookFig3() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/ex3.png"
      width={976}
      height={240}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="闯关3 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
