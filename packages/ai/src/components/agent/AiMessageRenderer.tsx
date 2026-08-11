'use client'

import type { ReactNode } from 'react'
import type { AgentAction, AgentBlock } from '../../types'
import AnalysisImage from '@rosie/ui/AnalysisImage'
import ProblemSolutionView from '@rosie/ui/ProblemSolutionView'
import AgentActionBar from './AgentActionBar'

function WordCard({ block }: { block: Extract<AgentBlock, { type: 'word_card' }> }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
      <div className="text-2xl font-bold text-emerald-900">{block.word}</div>
      {block.ipa ? <div className="mt-1 text-sm text-emerald-700">{block.ipa}</div> : null}
      <div className="mt-2 text-base text-emerald-900">{block.chineseDef}</div>
      {block.example ? (
        <div className="mt-2 text-sm text-emerald-800 italic">{block.example}</div>
      ) : null}
    </div>
  )
}

function CharCard({ block }: { block: Extract<AgentBlock, { type: 'char_card' }> }) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
      <div className="text-4xl font-bold text-amber-900">{block.char}</div>
      <div className="mt-1 text-sm text-amber-800">{block.pinyin}</div>
      {block.phrases.length > 0 ? (
        <div className="mt-2 text-sm text-amber-900">
          组词：{block.phrases.slice(0, 5).join('、')}
        </div>
      ) : null}
    </div>
  )
}

function PassageBlock({ block }: { block: Extract<AgentBlock, { type: 'passage_excerpt' }> }) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
      <div className="text-base font-bold text-violet-900">《{block.title}》</div>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-violet-950">
        {block.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  )
}

function MathSolutionBlock({ block }: { block: Extract<AgentBlock, { type: 'math_solution' }> }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-bold text-indigo-950">{block.title}</div>
      <ProblemSolutionView
        analysis={block.steps}
        variant="yellow"
        image={
          block.analysisImageUrl ? (
            <AnalysisImage src={block.analysisImageUrl} alt={`${block.title}题解图`} />
          ) : undefined
        }
      />
      {block.finalAnswer ? (
        <div className="mt-2 text-sm font-semibold text-indigo-800">答案：{block.finalAnswer}</div>
      ) : null}
    </div>
  )
}

type AiMessageRendererProps = {
  text: string
  blocks: AgentBlock[]
  actions: AgentAction[]
  role: 'user' | 'assistant'
  renderMathProblem?: (problemId: string) => ReactNode
  renderWordCard?: (block: Extract<AgentBlock, { type: 'word_card' }>) => ReactNode
  renderCharCard?: (block: Extract<AgentBlock, { type: 'char_card' }>) => ReactNode
  renderPoemRecite?: (block: Extract<AgentBlock, { type: 'poem_recite' }>) => ReactNode
  renderPassage?: (block: Extract<AgentBlock, { type: 'passage_excerpt' }>) => ReactNode
  renderLearningStatus?: (block: Extract<AgentBlock, { type: 'learning_status' }>) => ReactNode
  renderTodayTasks?: (block: Extract<AgentBlock, { type: 'today_tasks' }>) => ReactNode
}

export default function AiMessageRenderer({
  text,
  blocks,
  actions,
  role,
  renderMathProblem,
  renderWordCard,
  renderCharCard,
  renderPoemRecite,
  renderPassage,
  renderLearningStatus,
  renderTodayTasks,
}: AiMessageRendererProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser ? (
        <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 text-base shadow-sm">
          🤖
        </div>
      ) : null}
      <div
        className={`max-w-[88%] px-4 py-3 sm:max-w-[82%] ${
          isUser
            ? 'rounded-[20px_20px_6px_20px] bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-[0_7px_18px_rgba(99,102,241,0.18)]'
            : 'rounded-[20px_20px_20px_6px] bg-white text-slate-800 shadow-[0_6px_22px_rgba(51,65,85,0.07)] ring-1 ring-slate-100'
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed">{text}</p>
        ) : (
          <div className="space-y-3">
            {blocks.length > 0 ? (
              blocks.map((block, index) => {
                if (block.type === 'word_card')
                  return (
                    <div key={index}>{renderWordCard?.(block) ?? <WordCard block={block} />}</div>
                  )
                if (block.type === 'char_card')
                  return (
                    <div key={index}>{renderCharCard?.(block) ?? <CharCard block={block} />}</div>
                  )
                if (block.type === 'passage_excerpt')
                  return (
                    <div key={index}>
                      {renderPassage?.(block) ?? <PassageBlock block={block} />}
                    </div>
                  )
                if (block.type === 'math_solution')
                  return <MathSolutionBlock key={index} block={block} />
                if (block.type === 'math_problem') {
                  return (
                    <div key={index} className="min-w-0 overflow-hidden rounded-2xl">
                      {renderMathProblem ? (
                        renderMathProblem(block.problemId)
                      ) : (
                        <div className="rounded-2xl bg-indigo-50 p-4 text-sm font-semibold text-indigo-800 ring-1 ring-indigo-100">
                          《{block.title}》可在学习页面的浮层中直接作答。
                        </div>
                      )}
                    </div>
                  )
                }
                if (block.type === 'poem_recite') {
                  return (
                    <div key={index} className="min-w-0 overflow-hidden rounded-2xl">
                      {renderPoemRecite?.(block) ?? (
                        <div className="rounded-2xl bg-violet-50 p-4 text-sm font-semibold text-violet-800 ring-1 ring-violet-100">
                          《{block.title}》背诵练习可在学习页面的浮层中完成。
                        </div>
                      )}
                    </div>
                  )
                }
                if (block.type === 'learning_status') {
                  return (
                    <div key={index}>
                      {renderLearningStatus?.(block) ?? (
                        <div className="rounded-2xl bg-sky-50 p-4 text-sm font-semibold text-sky-800 ring-1 ring-sky-100">
                          学习状态可在学习页面的浮层中查看。
                        </div>
                      )}
                    </div>
                  )
                }
                if (block.type === 'today_tasks') {
                  return (
                    <div key={index}>
                      {renderTodayTasks?.(block) ?? (
                        <div className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 ring-1 ring-amber-100">
                          今日任务可在学习页面的浮层中查看。
                        </div>
                      )}
                    </div>
                  )
                }
                if (block.type === 'text') {
                  return (
                    <p key={index} className="text-sm leading-relaxed">
                      {block.content}
                    </p>
                  )
                }
                return null
              })
            ) : (
              <p className="text-sm leading-relaxed">{text}</p>
            )}
            {!isUser ? <AgentActionBar actions={actions} /> : null}
          </div>
        )}
      </div>
    </div>
  )
}
