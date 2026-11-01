import Image from 'next/image'

export default function LessonPr3() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/lesson3.1.png"
      width={1062}
      height={336}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="练3 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
