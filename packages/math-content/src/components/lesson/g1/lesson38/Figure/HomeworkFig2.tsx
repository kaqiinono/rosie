import Image from 'next/image'

// Garden watering path: rectangle with X diagonals, labeled A (right), B (bottom), C (top-left)
function HomeworkFig2() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/homework2.png"
      width={1033}
      height={636}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="例1 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}

export default HomeworkFig2
