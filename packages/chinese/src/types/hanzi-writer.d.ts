declare module 'hanzi-writer' {
  export interface HanziCharData {
    strokes: string[]
    medians: number[][][]
    radStrokes?: number[]
  }

  export interface HanziWriterOptions {
    width?: number
    height?: number
    padding?: number
    showOutline?: boolean
    outlineColor?: string
    strokeColor?: string
    radicalColor?: string
    drawingColor?: string
    drawingWidth?: number
    showHintAfterMisses?: number | false
    highlightOnComplete?: boolean
    charDataLoader?: (
      char: string,
      onComplete: (data: HanziCharData) => void,
      onError?: (reason: unknown) => void,
    ) => void
  }

  export interface QuizSummary {
    totalMistakes: number
    character: string
  }

  export interface QuizOptions {
    onComplete?: (summary: QuizSummary) => void
    onMistake?: (strokeData: { totalMistakes: number }) => void
    showHintAfterMisses?: number | false
  }

  export default class HanziWriter {
    static create(
      element: HTMLElement | string,
      character: string,
      options?: HanziWriterOptions,
    ): HanziWriter
    animateCharacter(options?: object): void
    quiz(options?: QuizOptions): void
    cancelQuiz(): void
    hideCharacter(): void
    setCharacter(character: string): void
  }
}
