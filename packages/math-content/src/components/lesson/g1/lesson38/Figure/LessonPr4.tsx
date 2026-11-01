import Image from 'next/image'

export default function LessonPr4() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/lesson4.1.png"
      width={1012}
      height={458}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="练4 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}
