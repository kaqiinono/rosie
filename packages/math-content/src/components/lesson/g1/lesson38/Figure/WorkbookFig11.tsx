import Image from 'next/image'

export default function WorkbookFig11() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/ex11.png"
      width={346}
      height={391}
      sizes="(max-width: 640px) 100vw, 346px"
      alt="闯关11 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
