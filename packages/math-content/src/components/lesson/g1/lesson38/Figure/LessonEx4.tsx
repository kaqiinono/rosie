import Image from 'next/image'

export default function LessonEx4() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/lesson4.png"
      width={1332}
      height={302}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="例4 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
