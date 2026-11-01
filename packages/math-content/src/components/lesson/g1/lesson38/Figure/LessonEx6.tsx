import Image from 'next/image'

export default function LessonEx6() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/lesson6.png"
      width={370}
      height={330}
      sizes="(max-width: 640px) 100vw, 370px"
      alt="例6 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
