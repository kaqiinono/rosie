import Image from 'next/image'

export default function LessonPr6() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/lesson6.1.png"
      width={354}
      height={368}
      sizes="(max-width: 640px) 100vw, 354px"
      alt="练6 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
