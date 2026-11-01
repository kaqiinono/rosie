import Image from 'next/image'

export default function LessonEx2() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/lesson2.png"
      width={576}
      height={438}
      sizes="(max-width: 640px) 100vw, 576px"
      alt="例2 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
