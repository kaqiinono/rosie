'use client'

import type { ReactNode } from 'react'
import type { AgentAction, AgentBlock } from '../../types'
import RosieAssistantAvatar from '../RosieAssistantAvatar'
import AnalysisImage from '@rosie/ui/AnalysisImage'
import ProblemSolutionView from '@rosie/ui/ProblemSolutionView'
import AgentActionBar from './AgentActionBar'

/** Lightweight HTML sanitizer for admin-authored note content (no <script>, no event handlers). */
function sanitizeNoteHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
}

function LessonNotesCards({ notes }: { notes: Array<{ title: string | null; bodyHtml: string }> }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-bold text-violet-900">
        📝 本讲笔记
        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
          {notes.length} 条
        </span>
      </div>
      {notes.map((note, i) => (
        <div
          key={i}
          className="rounded-xl border border-violet-100 bg-[#faf9ff] p-3"
        >
          {note.title ? (
            <div className="mb-1 text-[12px] font-bold text-violet-800">{note.title}</div>
          ) : null}
          <div
            className="text-[12px] leading-relaxed text-slate-700 [&_strong]:font-bold [&_strong]:text-slate-900 [&_ul]:my-0.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-0.5 [&_p:last-child]:mb-0 [&_img]:max-w-full [&_img]:rounded-lg"
            dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(note.bodyHtml) }}
          />
        </div>
      ))}
    </div>
  )
}

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
  const isSimilar = block.title.startsWith('相似例题')

  if (isSimilar && block.steps.length > 1) {
    // Similar problem: first step is the problem text, rest are solution steps
    const [problemText, ...solutionSteps] = block.steps
    return (
      <div className="space-y-2">
        <div className="text-sm font-bold text-indigo-950">{block.title}</div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-bold text-slate-600 mb-1">📝 题目</div>
          <div className="text-sm leading-relaxed text-slate-800">{problemText}</div>
        </div>
        <ProblemSolutionView
          analysis={solutionSteps}
          heading="解题过程"
          headingIcon="💡"
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

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs font-medium text-slate-400">正在思考</span>
      <span className="flex items-end gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-[5px] rounded-full bg-slate-400"
            style={{
              animation: 'ai-typing-bounce 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </span>
    </div>
  )
}

function StreamingCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-4 w-[2px] translate-y-[2px] rounded-full bg-violet-400"
      style={{ animation: 'ai-cursor-blink 1s step-end infinite' }}
    />
  )
}

type AiMessageRendererProps = {
  text: string
  blocks: AgentBlock[]
  actions: AgentAction[]
  role: 'user' | 'assistant'
  streaming?: boolean
  renderMathProblem?: (problemId: string, renderRemainingActions?: () => ReactNode) => ReactNode
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
  streaming,
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
        <RosieAssistantAvatar className="size-8 rounded-xl shadow-sm ring-1 ring-rose-100" />
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
            {streaming && !text && blocks.length === 0 ? (
              <TypingIndicator />
            ) : blocks.length > 0 ? (
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
                if (block.type === 'lesson_notes') {
                  return <LessonNotesCards key={index} notes={block.notes} />
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
              <p className="text-sm leading-relaxed">
                {text}
                {streaming ? <StreamingCursor /> : null}
              </p>
            )}
            {!isUser ? <AgentActionBar actions={actions} renderMathProblem={renderMathProblem} /> : null}
          </div>
        )}
      </div>
    </div>
  )
}
