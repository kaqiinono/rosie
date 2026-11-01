import Image from 'next/image'

export default function WorkbookFig5() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/ex5.png"
      width={817}
      height={351}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="闯关5 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
