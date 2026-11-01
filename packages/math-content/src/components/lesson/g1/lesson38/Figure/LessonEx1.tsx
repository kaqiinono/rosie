import Image from 'next/image'

export default function LessonEx1() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/lesson1.png"
      width={1668}
      height={498}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="例1 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
