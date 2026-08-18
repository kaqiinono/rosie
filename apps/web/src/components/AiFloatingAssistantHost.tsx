'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AiChatPanel, AiFloatingAssistant, stripHtml, type AgentBlock } from '@rosie/ai'
import type { LessonNote, SimilarProblem } from '@rosie/ai'
import { getWordMasteryLevel, useAuth, type WordEntry } from '@rosie/core'
import {
  FlashCard,
  ParagraphRecallQuiz,
  PassageView,
  ReadingAudioButton,
  SpellTiles,
  findPassageByKey,
  useWordData,
  useEnglishWrong,
  useReadingPassageAudio,
  useWordMastery,
  wordKey,
} from '@rosie/english'
import {
  CharFlashCard,
  CharWriter,
  ChineseDailyCard,
  LessonPassageReader,
  PassageRecorder,
  PoemRecite,
  getBookPoems,
  getBookLessonPassages,
  isChineseBookSlug,
  poemMatchesLessonMeta,
  masteryKey,
  useCharMastery,
  useChineseCharData,
  useChineseWrong,
  useChineseRoadmapPlan,
  type ChineseWrongKind,
} from '@rosie/chinese'
import EmbeddedMathProblemSession from '@rosie/math/components/EmbeddedMathProblemSession'
import { MathDailyCard } from '@rosie/math'
import { SEA_POOL } from '@rosie/math/utils/sea-data'
import { lookupMathProblem } from '@rosie/math/utils/math-problem-lookup'
import ProblemSolutionView from '@rosie/ui/ProblemSolutionView'
import { loadLessonNotes } from '@rosie/math-kit/hooks/useMathProblemNotes'
import { useMathPracticeStats } from '@rosie/math-kit/hooks/useMathPracticeStats'
import { useMathWrong } from '@rosie/math-kit/hooks/useMathWrong'
import AdaptivePlanTodayCard from '@/components/today/AdaptivePlanTodayCard'

type WordCardBlock = Extract<AgentBlock, { type: 'word_card' }>
type CharCardBlock = Extract<AgentBlock, { type: 'char_card' }>
type PoemReciteBlock = Extract<AgentBlock, { type: 'poem_recite' }>
type PassageBlock = Extract<AgentBlock, { type: 'passage_excerpt' }>
type LearningStatusBlock = Extract<AgentBlock, { type: 'learning_status' }>
type TodayTasksBlock = Extract<AgentBlock, { type: 'today_tasks' }>

function wordEntryToBlock(entry: WordEntry): WordCardBlock {
  return {
    type: 'word_card',
    sourceRef: `word:${entry.stage ?? ''}:${entry.unit}:${entry.lesson}:${entry.word}`,
    word: entry.word,
    chineseDef: entry.chineseDef ?? entry.explanation,
    explanation: entry.explanation,
    stage: entry.stage,
    unit: entry.unit,
    lesson: entry.lesson,
    ipa: entry.ipa,
    example: entry.example,
    phonics: entry.phonics,
    syllables: entry.syllables,
    keywords: entry.keywords,
    vocabType: entry.vocabType,
    imagePath: entry.imagePath,
  }
}

function StatusMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-xl p-3 text-center ${tone}`}>
      <div className="text-xl font-black">{value}</div>
      <div className="mt-0.5 text-[11px] font-bold opacity-75">{label}</div>
    </div>
  )
}

function EnglishLearningStatus({ view }: { view: LearningStatusBlock['view'] }) {
  const { user } = useAuth()
  const [selectedWrongKey, setSelectedWrongKey] = useState<string | null>(null)
  const { masteryMap, isLoading } = useWordMastery(user)
  const { vocab } = useWordData(user)
  const { wrongKeys, rows, markResolved } = useEnglishWrong(user)
  const selectedWord = selectedWrongKey
    ? vocab.find(
        (entry) =>
          `${entry.unit}::${entry.lesson}::${entry.word}` === selectedWrongKey ||
          `${entry.stage ?? ''}::${entry.unit}::${entry.lesson}::${entry.word}` ===
            selectedWrongKey,
      )
    : undefined
  const records = Object.values(masteryMap)
  const mastered = records.filter((item) => getWordMasteryLevel(item.correct) === 3).length
  return (
    <div className="rounded-2xl bg-emerald-50/80 p-3 ring-1 ring-emerald-100">
      <h3 className="mb-2 font-bold text-emerald-900">英语</h3>
      {isLoading ? <p className="text-sm text-emerald-700">正在加载…</p> : null}
      <div className="grid grid-cols-3 gap-2">
        <StatusMetric label="已练单词" value={records.length} tone="bg-white text-emerald-800" />
        <StatusMetric label="已掌握" value={mastered} tone="bg-emerald-100 text-emerald-900" />
        <StatusMetric label="待巩固" value={wrongKeys.size} tone="bg-amber-100 text-amber-900" />
      </div>
      {view === 'mistakes' && wrongKeys.size > 0 ? (
        <div className="mt-3 rounded-xl bg-white/80 p-3">
          <p className="text-xs font-bold text-emerald-800">最近待巩固单词</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {rows
              .filter((row) => !row.resolved)
              .slice(0, 5)
              .map((row) => (
                <button
                  key={row.wordKey}
                  type="button"
                  onClick={() => setSelectedWrongKey(row.wordKey)}
                  className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800"
                >
                  {row.wordKey.split('::').at(-1)}
                </button>
              ))}
          </div>
        </div>
      ) : null}
      {selectedWord && selectedWrongKey ? (
        <div className="mt-3">
          <EmbeddedWordCard
            block={wordEntryToBlock(selectedWord)}
            onPracticeComplete={() => void markResolved(selectedWrongKey)}
          />
        </div>
      ) : null}
    </div>
  )
}

function MathLearningStatus({ view }: { view: LearningStatusBlock['view'] }) {
  const { user } = useAuth()
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null)
  const { practiceCount, correctCount, isLoading } = useMathPracticeStats(user)
  const { wrongIds } = useMathWrong(user)
  const counts = Object.values(correctCount)
  return (
    <div className="rounded-2xl bg-indigo-50/80 p-3 ring-1 ring-indigo-100">
      <h3 className="mb-2 font-bold text-indigo-900">数学</h3>
      {isLoading ? <p className="text-sm text-indigo-700">正在加载…</p> : null}
      <div className="grid grid-cols-3 gap-2">
        <StatusMetric
          label="已练题目"
          value={Object.keys(practiceCount).length}
          tone="bg-white text-indigo-800"
        />
        <StatusMetric
          label="已掌握"
          value={counts.filter((count) => count >= 3).length}
          tone="bg-indigo-100 text-indigo-900"
        />
        <StatusMetric label="待巩固" value={wrongIds.size} tone="bg-amber-100 text-amber-900" />
      </div>
      {view === 'mistakes' && wrongIds.size > 0 ? (
        <div className="mt-3 rounded-xl bg-white/80 p-3">
          <p className="text-xs font-bold text-indigo-800">选择一道错题继续练习</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...wrongIds].slice(0, 5).map((problemId) => (
              <button
                key={problemId}
                type="button"
                onClick={() => setSelectedProblemId(problemId)}
                className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700"
              >
                {problemId}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {selectedProblemId ? (
        <div className="mt-3">
          <EmbeddedMathProblemSession problemId={selectedProblemId} />
        </div>
      ) : null}
    </div>
  )
}

function ChineseLearningStatus({ view }: { view: LearningStatusBlock['view'] }) {
  const { user } = useAuth()
  const [selectedWrong, setSelectedWrong] = useState<{
    itemKey: string
    wrongKind: ChineseWrongKind
  } | null>(null)
  const { masteryMap, isLoading } = useCharMastery(user)
  const { chars } = useChineseCharData(user)
  const { unresolved, markResolved } = useChineseWrong(user)
  const selectedChar = selectedWrong
    ? chars.find(
        (entry) =>
          entry.charKey === selectedWrong.itemKey ||
          entry.char === selectedWrong.itemKey.split('::').at(-1),
      )
    : undefined
  const records = Object.values(masteryMap)
  return (
    <div className="rounded-2xl bg-orange-50/80 p-3 ring-1 ring-orange-100">
      <h3 className="mb-2 font-bold text-orange-900">语文</h3>
      {isLoading ? <p className="text-sm text-orange-700">正在加载…</p> : null}
      <div className="grid grid-cols-3 gap-2">
        <StatusMetric label="已练字项" value={records.length} tone="bg-white text-orange-800" />
        <StatusMetric
          label="已掌握"
          value={records.filter((item) => getWordMasteryLevel(item.correct) === 3).length}
          tone="bg-orange-100 text-orange-900"
        />
        <StatusMetric label="待巩固" value={unresolved.length} tone="bg-amber-100 text-amber-900" />
      </div>
      {view === 'mistakes' && unresolved.length > 0 ? (
        <div className="mt-3 rounded-xl bg-white/80 p-3">
          <p className="text-xs font-bold text-orange-800">最近待巩固内容</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unresolved.slice(0, 5).map((row) =>
              row.itemType === 'char' ? (
                <button
                  key={`${row.itemKey}-${row.wrongKind}`}
                  type="button"
                  onClick={() =>
                    setSelectedWrong({ itemKey: row.itemKey, wrongKind: row.wrongKind })
                  }
                  className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800"
                >
                  {row.itemKey.split('::').at(-1)}
                </button>
              ) : (
                <Link
                  key={`${row.itemKey}-${row.wrongKind}`}
                  href="/chinese/wrong"
                  className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800"
                >
                  {row.itemKey.split('::').at(-1)} ↗
                </Link>
              ),
            )}
          </div>
        </div>
      ) : null}
      {selectedChar && selectedWrong ? (
        <div className="mt-3">
          <EmbeddedCharCard
            block={{
              type: 'char_card',
              sourceRef: `chinese_char_entries:${selectedChar.charKey}`,
              char: selectedChar.char,
              pinyin: selectedChar.pinyin,
              phrases: selectedChar.phrases,
              radical: selectedChar.radical,
              radicalName: selectedChar.radicalName,
              structure: selectedChar.structure,
              strokeCount: selectedChar.strokeCount,
            }}
            onPracticeComplete={() =>
              void markResolved(selectedWrong.itemKey, selectedWrong.wrongKind)
            }
          />
        </div>
      ) : null}
    </div>
  )
}

function EmbeddedLearningStatus({ block }: { block: LearningStatusBlock }) {
  return (
    <div className="space-y-2">
      {(!block.subject || block.subject === 'english') && (
        <EnglishLearningStatus view={block.view} />
      )}
      {(!block.subject || block.subject === 'math') && <MathLearningStatus view={block.view} />}
      {(!block.subject || block.subject === 'chinese') && (
        <ChineseLearningStatus view={block.view} />
      )}
    </div>
  )
}

function EmbeddedTodayTasks({ block }: { block: TodayTasksBlock }) {
  const { user } = useAuth()
  return (
    <div className="space-y-3">
      {(!block.subject || block.subject === 'english') && (
        <div className="rounded-2xl bg-white p-2 ring-1 ring-slate-100">
          <AdaptivePlanTodayCard user={user} />
        </div>
      )}
      {(!block.subject || block.subject === 'math') && <MathDailyCard />}
      {(!block.subject || block.subject === 'chinese') && <ChineseDailyCard />}
    </div>
  )
}

function EmbeddedWordCard({
  block,
  onPracticeComplete,
}: {
  block: WordCardBlock
  onPracticeComplete?: () => void
}) {
  const { user } = useAuth()
  const { masteryMap } = useWordMastery(user)
  const [flipped, setFlipped] = useState(false)
  const [mode, setMode] = useState<'card' | 'spell'>('card')
  const [spellResult, setSpellResult] = useState<boolean | null>(null)
  const [spellRound, setSpellRound] = useState(0)
  const entry: WordEntry = {
    stage: block.stage,
    unit: block.unit ?? 'AI',
    lesson: block.lesson ?? '单词卡',
    word: block.word,
    explanation: block.explanation ?? block.chineseDef,
    chineseDef: block.chineseDef,
    ipa: block.ipa,
    example: block.example,
    phonics: block.phonics,
    syllables: block.syllables,
    keywords: block.keywords,
    vocabType: block.vocabType,
    imagePath: block.imagePath,
  }
  const masteryInfo = masteryMap[wordKey(entry)]

  return (
    <div className="mx-auto w-full max-w-md space-y-3">
      {mode === 'card' ? (
        <FlashCard
          entry={entry}
          flipped={flipped}
          onFlip={() => setFlipped((value) => !value)}
          index={0}
          masteryInfo={masteryInfo}
        />
      ) : (
        <div className="rounded-2xl bg-indigo-950 p-4 text-white shadow-sm">
          <p className="mb-3 text-center text-sm font-bold text-indigo-200">听读并拼出这个单词</p>
          <SpellTiles
            key={spellRound}
            word={block.word.toLowerCase()}
            answered={spellResult !== null}
            isCorrect={spellResult}
            onSubmit={(answer) => {
              const correct = answer.toLowerCase() === block.word.toLowerCase()
              setSpellResult(correct)
              if (correct) onPracticeComplete?.()
            }}
          />
          {spellResult !== null ? (
            <div className="mt-3 text-center">
              <p className={spellResult ? 'font-bold text-emerald-300' : 'font-bold text-rose-300'}>
                {spellResult ? '拼写正确！' : `再看看：${block.word}`}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSpellResult(null)
                  setSpellRound((value) => value + 1)
                }}
                className="mt-2 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white"
              >
                再练一次
              </button>
            </div>
          ) : null}
        </div>
      )}
      <button
        type="button"
        onClick={() => setMode((value) => (value === 'card' ? 'spell' : 'card'))}
        className="w-full rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 ring-1 ring-indigo-100"
      >
        {mode === 'card' ? '开始拼写练习' : '返回单词卡'}
      </button>
      {masteryInfo ? (
        <p className="text-center text-xs font-semibold text-indigo-700">
          已答对 {masteryInfo.correct} 次 · 答错 {masteryInfo.incorrect} 次
          {masteryInfo.nextReviewDate ? ` · 下次复习 ${masteryInfo.nextReviewDate}` : ''}
        </p>
      ) : null}
    </div>
  )
}

function EmbeddedCharCard({
  block,
  onPracticeComplete,
}: {
  block: CharCardBlock
  onPracticeComplete?: () => void
}) {
  const { user } = useAuth()
  const { masteryMap } = useCharMastery(user)
  const [flipped, setFlipped] = useState(false)
  const [mode, setMode] = useState<'card' | 'animate' | 'quiz'>('card')
  const [writingResult, setWritingResult] = useState<string | null>(null)
  const charKeyValue = block.sourceRef.startsWith('chinese_char_entries:')
    ? block.sourceRef.slice('chinese_char_entries:'.length)
    : null
  const recognizeInfo = charKeyValue ? masteryMap[masteryKey(charKeyValue, 'recognize')] : undefined
  const writeInfo = charKeyValue ? masteryMap[masteryKey(charKeyValue, 'write')] : undefined
  return (
    <div className="mx-auto w-full max-w-xs space-y-3">
      {mode === 'card' ? (
        <CharFlashCard
          data={{
            char: block.char,
            pinyin: block.pinyin,
            unit: block.unit ?? 0,
            lessonTitle: block.lessonTitle ?? 'AI 生字卡',
            phrases: block.phrases,
            radical: block.radical,
            radicalName: block.radicalName,
            structure: block.structure,
            strokeCount: block.strokeCount,
          }}
          flipped={flipped}
          onFlip={() => setFlipped((value) => !value)}
        />
      ) : (
        <div className="rounded-2xl bg-orange-50 p-3 text-center ring-1 ring-orange-100">
          <p className="mb-2 text-sm font-bold text-orange-800">
            {mode === 'animate' ? '笔顺演示' : '请按正确笔顺写一遍'}
          </p>
          <CharWriter
            key={mode}
            char={block.char}
            mode={mode}
            size={190}
            onQuizComplete={({ totalMistakes }) => {
              setWritingResult(
                totalMistakes === 0 ? '书写正确！' : `完成啦，提示了 ${totalMistakes} 次`,
              )
              if (totalMistakes === 0) onPracticeComplete?.()
            }}
          />
          {writingResult ? (
            <p className="mt-2 text-sm font-bold text-emerald-700">{writingResult}</p>
          ) : null}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {[
          ['card', '生字卡'],
          ['animate', '看笔顺'],
          ['quiz', '练写字'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setWritingResult(null)
              setMode(value as 'card' | 'animate' | 'quiz')
            }}
            className={`rounded-xl px-2 py-2 text-xs font-bold ring-1 ${
              mode === value
                ? 'bg-orange-500 text-white ring-orange-500'
                : 'bg-orange-50 text-orange-700 ring-orange-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {recognizeInfo || writeInfo ? (
        <p className="text-center text-xs font-semibold text-orange-700">
          认读答对 {recognizeInfo?.correct ?? 0} 次 · 书写答对 {writeInfo?.correct ?? 0} 次
        </p>
      ) : null}
    </div>
  )
}

function EmbeddedPoemRecite({ block }: { block: PoemReciteBlock }) {
  const { user } = useAuth()
  const [round, setRound] = useState(0)
  const [score, setScore] = useState<number | null>(null)
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString())
  const { lessons } = useChineseCharData(user)
  const { activePlan, appendLessonRuns } = useChineseRoadmapPlan(user)
  const poem = isChineseBookSlug(block.bookSlug)
    ? getBookPoems(block.bookSlug).find((item) => item.id === block.poemId)
    : undefined

  if (!poem) {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
        暂时无法加载《{block.title}》的背诵内容，请尝试说出完整诗名。
      </div>
    )
  }
  const matchingLesson = lessons.find((lesson) =>
    poemMatchesLessonMeta(poem, lesson.lessonKind, {
      unit: lesson.unit,
      lesson: lesson.lesson,
    }),
  )

  const recordScore = async (nextScore: number) => {
    setScore(nextScore)
    if (!activePlan || activePlan.bookSlug !== block.bookSlug || !matchingLesson) return
    const correct = nextScore >= 60 ? 1 : 0
    await appendLessonRuns(activePlan.id, [
      {
        lessonKey: matchingLesson.lessonKey,
        startedAt,
        finishedAt: new Date().toISOString(),
        completed: true,
        total: 1,
        correct,
        accuracy: nextScore,
        byType: { poems: { total: 1, correct } },
        quizTypes: ['poems'],
      },
    ])
  }

  return (
    <div className="rounded-2xl bg-violet-50/70 p-3 ring-1 ring-violet-100">
      <PoemRecite key={round} poem={poem} onComplete={(nextScore) => void recordScore(nextScore)} />
      {score !== null ? (
        <button
          type="button"
          onClick={() => {
            setScore(null)
            setRound((value) => value + 1)
            setStartedAt(new Date().toISOString())
          }}
          className="mx-auto mt-3 block rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white"
        >
          再背一次
        </button>
      ) : null}
    </div>
  )
}

function EmbeddedEnglishPassage({ block }: { block: PassageBlock }) {
  const { user } = useAuth()
  const passage = block.passageKey ? findPassageByKey(block.passageKey) : undefined
  const audioUrl = useReadingPassageAudio(user, block.passageKey ?? '')
  const { vocab, isLoading } = useWordData(user, { stage: block.stage ?? null })
  const { masteryMap, recordRecallAttempt } = useWordMastery(user)

  if (!passage) {
    return (
      <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4">
        <div className="font-bold text-violet-900">《{block.title}》</div>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-violet-950">
          {block.paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>
    )
  }

  const lessonWords = vocab.filter(
    (entry) => entry.unit === passage.unit && entry.lesson === passage.lesson,
  )

  return (
    <div className="max-h-[58vh] overflow-y-auto rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900">{passage.title}</h3>
            <p className="text-xs text-slate-500">
              {passage.stage} · {passage.unit} · {passage.lesson}
            </p>
          </div>
          <ReadingAudioButton src={audioUrl} mode="once" size="sm" />
        </div>
      </div>
      {isLoading ? (
        <p className="py-6 text-center text-sm text-slate-400">正在加载课文词汇…</p>
      ) : (
        <PassageView
          passage={passage}
          lessonWords={lessonWords}
          masteryMap={masteryMap}
          mode="focus"
          renderParagraphFooter={(paragraphIndex) => (
            <ParagraphRecallQuiz
              paragraphText={passage.paragraphs[paragraphIndex]}
              lessonWords={lessonWords}
              masteryMap={masteryMap}
              paragraphKey={`ai-${passage.key}-${paragraphIndex}`}
              onAnswer={recordRecallAttempt}
            />
          )}
        />
      )}
    </div>
  )
}

function EmbeddedChinesePassage({ block, active }: { block: PassageBlock; active: boolean }) {
  const { user } = useAuth()
  const { lessonGroups } = useChineseCharData(user)
  const group = lessonGroups.find((item) => item.lessonKey === block.lessonKey)

  if (!block.bookSlug || !isChineseBookSlug(block.bookSlug) || !block.lessonKey) {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
        暂时无法加载课文朗读信息。
      </div>
    )
  }
  const passage = getBookLessonPassages(block.bookSlug).find(
    (item) => item.lessonKey === block.lessonKey,
  )

  return (
    <div className="max-h-[62vh] overflow-y-auto rounded-2xl bg-amber-50/50 p-2 ring-1 ring-amber-100">
      <LessonPassageReader
        lessonKey={block.lessonKey}
        bookSlug={block.bookSlug}
        lessonTitle={block.title}
        unit={group?.unit ?? null}
        bookLessonNo={group?.lesson ?? null}
        paragraphs={passage?.paragraphs ?? block.paragraphs}
        recognize={group?.recognize ?? []}
        write={group?.write ?? []}
        recallPhrases={[]}
        footer={
          <PassageRecorder
            bookSlug={block.bookSlug}
            lessonKey={block.lessonKey}
            lessonTitle={block.title}
            active={active}
          />
        }
      />
    </div>
  )
}

function EmbeddedPassage({ block, active }: { block: PassageBlock; active: boolean }) {
  return block.subject === 'english' ? (
    <EmbeddedEnglishPassage block={block} />
  ) : (
    <EmbeddedChinesePassage block={block} active={active} />
  )
}

function sanitizeProblemHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '')
}

function EmbeddedMathProblemCard({
  problemId,
  renderRemainingActions,
}: {
  problemId: string
  renderRemainingActions: () => ReactNode
}) {
  const entry = useMemo(() => {
    const direct = SEA_POOL.find((item) => item.problem.id === problemId)
    if (direct) return direct
    const resolved = lookupMathProblem(problemId)
    return resolved
      ? (SEA_POOL.find((item) => item.problem.id === resolved.problemId) ?? null)
      : null
  }, [problemId])

  if (!entry) {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
        暂时无法加载这道题，请尝试输入完整题目编号。
      </div>
    )
  }

  const { problem } = entry
  const problemHtml = sanitizeProblemHtml(problem.text)
  const analysisSteps = (problem.analysis ?? []).map((s) => stripHtml(s))

  return (
    <div className="space-y-2">
      <div className="text-sm font-bold text-indigo-950">{problem.title}</div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-bold text-slate-600 mb-1">📝 题目</div>
        <div
          className="text-sm leading-relaxed text-slate-800 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-1"
          dangerouslySetInnerHTML={{ __html: problemHtml }}
        />
      </div>
      {analysisSteps.length > 0 ? (
        <ProblemSolutionView
          analysis={analysisSteps}
          heading="解题过程"
          headingIcon="💡"
          variant="yellow"
          allowTrustedHtml
        />
      ) : null}
      {renderRemainingActions()}
    </div>
  )
}

function useAiEmbeddedRenderers(contentActive = true) {
  const renderMathProblem = useCallback(
    (problemId: string, renderRemainingActions?: () => ReactNode): ReactNode => {
      if (renderRemainingActions) {
        return (
          <EmbeddedMathProblemCard
            problemId={problemId}
            renderRemainingActions={renderRemainingActions}
          />
        )
      }
      return <EmbeddedMathProblemSession problemId={problemId} />
    },
    [],
  )
  const renderWordCard = useCallback(
    (block: WordCardBlock): ReactNode => <EmbeddedWordCard block={block} />,
    [],
  )
  const renderCharCard = useCallback(
    (block: CharCardBlock): ReactNode => <EmbeddedCharCard block={block} />,
    [],
  )
  const renderPoemRecite = useCallback(
    (block: PoemReciteBlock): ReactNode => <EmbeddedPoemRecite block={block} />,
    [],
  )
  const renderPassage = useCallback(
    (block: PassageBlock): ReactNode => <EmbeddedPassage block={block} active={contentActive} />,
    [contentActive],
  )
  const renderLearningStatus = useCallback(
    (block: LearningStatusBlock): ReactNode => <EmbeddedLearningStatus block={block} />,
    [],
  )
  const renderTodayTasks = useCallback(
    (block: TodayTasksBlock): ReactNode => <EmbeddedTodayTasks block={block} />,
    [],
  )
  return {
    renderMathProblem,
    renderWordCard,
    renderCharCard,
    renderPoemRecite,
    renderPassage,
    renderLearningStatus,
    renderTodayTasks,
  }
}

export function AiEmbeddedChatPanel() {
  const renderers = useAiEmbeddedRenderers()
  return <AiChatPanel {...renderers} />
}

/**
 * Fetch lesson notes + a similar problem for the current math page.
 * loadLessonNotes uses a module-level Promise cache, so this is essentially
 * free when the page already loaded notes.
 */
function useMathEnrichment(
  pathname: string,
  activeProblemId: string | undefined,
): { lessonNotes?: LessonNote[]; similarProblem?: SimilarProblem } | undefined {
  const isMath = /^\/math\//.test(pathname) || pathname === '/math'
  // Derive lessonId synchronously from URL so we can gate the async fetch
  const lessonId = useMemo(() => {
    if (!isMath) return undefined
    const match = pathname.match(/\/math\/ny\/(\d+)\/(\d+)/)
    return match ? `${match[1]}-${match[2]}` : undefined
  }, [pathname, isMath])

  const [fetched, setFetched] = useState<{
    lessonNotes?: LessonNote[]
    similarProblem?: SimilarProblem
  } | undefined>(undefined)

  useEffect(() => {
    if (!lessonId) return

    let cancelled = false

    // Notes: cached via module-level lessonCache
    void loadLessonNotes(lessonId)
      .then((rows) => {
        if (cancelled) return
        const notes = rows.length
          ? rows.map((r) => ({ title: r.title, bodyHtml: r.bodyHtml }))
          : undefined

        // Similar problem: filter SEA_POOL for same lesson, prefer with analysis
        const sameLesson = SEA_POOL.filter(
          (sp) => sp.lessonId === lessonId && sp.problem.id !== activeProblemId,
        )
        const withAnalysis = sameLesson.filter((sp) => sp.problem.analysis?.length > 0)
        const candidate = withAnalysis[0] ?? sameLesson[0]
        const similar: SimilarProblem | undefined = candidate
          ? {
              title: candidate.problem.title,
              text: stripHtml(candidate.problem.text),
              analysis: (candidate.problem.analysis ?? []).map((s) => stripHtml(s)),
              href: candidate.href,
              problemId: candidate.problem.id,
            }
          : undefined

        setFetched({ lessonNotes: notes, similarProblem: similar })
      })
      .catch(() => {
        if (!cancelled) setFetched(undefined)
      })

    return () => {
      cancelled = true
    }
  }, [lessonId, activeProblemId])

  // Return enrichment only when on a math page with a valid lessonId
  return lessonId ? fetched : undefined
}

export default function AiFloatingAssistantHost() {
  const pathname = usePathname()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const renderers = useAiEmbeddedRenderers(assistantOpen)

  // Read the active problem from DOM when assistant opens
  const [activeProblemId, setActiveProblemId] = useState<string | undefined>()
  useEffect(() => {
    if (!assistantOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing on close
      setActiveProblemId(undefined)
      return
    }
    const el = document.querySelector<HTMLElement>('[data-ai-active-problem-id]')
    const id = el?.dataset.aiActiveProblemId
    setActiveProblemId(id)
  }, [assistantOpen, pathname])

  const mathEnrichment = useMathEnrichment(pathname, activeProblemId)

  return (
    <AiFloatingAssistant
      {...renderers}
      onVisibilityChange={setAssistantOpen}
      mathEnrichment={mathEnrichment}
    />
  )
}
