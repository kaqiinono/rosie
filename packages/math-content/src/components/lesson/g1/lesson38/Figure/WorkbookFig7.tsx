import Image from 'next/image'

export default function WorkbookFig7() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/ex7.png"
      width={390}
      height={326}
      sizes="(max-width: 640px) 100vw, 390px"
      alt="闯关7 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
