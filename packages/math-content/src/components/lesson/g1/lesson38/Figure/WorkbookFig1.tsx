import Image from 'next/image'

export default function WorkbookFig1() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/ex1.png"
      width={1027}
      height={227}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="闯关1 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
