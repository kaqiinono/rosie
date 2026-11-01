import Image from 'next/image'

// Three figures for homework 1: judge which can be drawn in one stroke
// Figure 1 (Saturn-like): ✗ | Figure 2 (linked loops): ✗ | Figure 3 (diamond+rect): ✓
function HomeworkFig1() {
  return (
    <Image
      loading="eager"
      src="/img/math/lesson38/homework1.png"
      width={995}
      height={328}
      sizes="(max-width: 640px) 100vw, 768px"
      alt="例1 图示"
      className="mx-auto h-auto max-h-60 w-auto max-w-full object-contain"
    />
  )
}

export default HomeworkFig1
