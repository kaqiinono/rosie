import Image from 'next/image'

function HomeworkFig4() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/homework4.png"
      width={1358}
      height={498}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="例1 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}

export default HomeworkFig4
