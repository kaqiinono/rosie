import Image from 'next/image'

function HomeworkFig3() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/homework3.png"
      width={670}
      height={509}
      sizes="(max-width: 640px) 100vw, 670px"
      alt="例1 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}

export default HomeworkFig3
