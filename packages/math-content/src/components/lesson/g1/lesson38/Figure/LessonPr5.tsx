import Image from 'next/image'

export default function LessonPr5() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/lesson5.1.png"
      width={386}
      height={388}
      sizes="(max-width: 640px) 100vw, 386px"
      alt="练5 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
