import Image from 'next/image'

export default function LessonPr2() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/lesson2.1.png"
      width={622}
      height={400}
      sizes="(max-width: 640px) 100vw, 622px"
      alt="练2 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
