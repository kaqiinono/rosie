import Image from 'next/image'

export default function LessonPr1() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/lesson1-1.png"
      width={792}
      height={280}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="练1 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
