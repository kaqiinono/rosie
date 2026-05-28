'use client'

type QuestionDisplayProps = {
  display: string
  hint?: string
  questionNumber: number
  totalQuestions: number
}

function QuestionDisplay({
  display,
  hint,
  questionNumber,
  totalQuestions,
}: QuestionDisplayProps) {
  return (
    <div className="relative w-full px-4 py-6">
      {/* Question counter */}
      <span className="absolute top-2 right-4 text-sm text-gray-400 font-medium">
        第 {questionNumber}/{totalQuestions} 题
      </span>

      {/* Question text */}
      <p className="text-2xl md:text-3xl font-bold text-gray-900 text-center mt-4 leading-relaxed">
        {display}
      </p>

      {/* Hint */}
      {hint && (
        <p className="mt-3 text-sm text-gray-400 text-center">
          {hint}
        </p>
      )}
    </div>
  )
}

export default QuestionDisplay
