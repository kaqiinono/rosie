import Image from 'next/image'

function HomeworkFig6() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/homework6.png"
      width={801}
      height={654}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="例1 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}

export default HomeworkFig6
