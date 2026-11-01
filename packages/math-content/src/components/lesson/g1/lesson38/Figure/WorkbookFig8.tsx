import Image from 'next/image'

export default function WorkbookFig8() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/ex8.png"
      width={777}
      height={641}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="闯关8 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
