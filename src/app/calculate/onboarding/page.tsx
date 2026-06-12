'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useCalculateSettings } from '@/hooks/useCalculateSettings'
import ChoiceGrid from '@/components/calculate/ChoiceGrid'
import NumberPad from '@/components/calculate/NumberPad'
import { generateQuestions } from '@/utils/calculate-generator'
import type { CalculateQuestion, LevelId, TreeId } from '@/utils/calculate-types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

const PROBE_LEVELS: LevelId[] = ['NS-1', 'AS-1', 'AS-3', 'MU-1', 'MU-5', 'DI-4', 'MX-1', 'FR-1']
const MIN_QUESTIONS = 6
const MAX_QUESTIONS = 10
const INITIAL_THETA = 0.5

function recommendLevel(theta: number): { level: LevelId; reason: string } {
  if (theta < 0.25) return { level: 'NS-1', reason: '基础数感和加减法从头建立' }
  if (theta < 0.45) return { level: 'AS-1', reason: '加减法基础具备，从口算开始' }
  if (theta < 0.6) return { level: 'AS-3', reason: '中等水平，从进退位开始' }
  if (theta < 0.75) return { level: 'MU-5', reason: '乘除法掌握，向括号过渡' }
  return { level: 'MX-1', reason: '运算顺序和混合运算' }
}

export default function OnboardingPage() {
  const { user } = useAuth()
  const { update: updateSettings } = useCalculateSettings(user)
  const router = useRouter()

  const [step, setStep] = useState<'intro' | 'probing' | 'done'>('intro')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [theta, setTheta] = useState(INITIAL_THETA)
  const [results, setResults] = useState<boolean[]>([])
  const [inputValue, setInputValue] = useState('')
  const [skipsUsed, setSkipsUsed] = useState(0)

  const questions = useMemo<CalculateQuestion[]>(() => {
    if (step === 'intro') return []
    const today = new Date().toISOString().slice(0, 10)
    const generated: CalculateQuestion[] = []
    for (const levelId of PROBE_LEVELS) {
      const qs = generateQuestions({
        levelId,
        theta: 0.3,
        count: 1,
        topicStates: [],
        today,
        tier: 'beginner',
      })
      if (qs.length > 0) generated.push(qs[0])
      if (generated.length >= MAX_QUESTIONS) break
    }
    return generated
  }, [step])

  const recommendation = useMemo(() => recommendLevel(theta), [theta])

  const currentQ = questions[currentIdx]
  const isChoice = currentQ?.type === 'choice'

  const handleAnswer = useCallback(
    (answer: string) => {
      if (!currentQ) return
      const correct = answer === currentQ.answer
      const newResults = [...results, correct]
      setResults(newResults)

      // Update theta every 2 questions
      if (newResults.length % 2 === 0) {
        const lastTwo = newResults.slice(-2)
        const correctCount = lastTwo.filter(Boolean).length
        let newTheta = theta
        if (correctCount === 2) newTheta = Math.min(0.9, theta + 0.2)
        else if (correctCount === 0) newTheta = Math.max(0.1, theta - 0.2)
        setTheta(newTheta)
      }

      // Check stop conditions
      if (newResults.length >= MIN_QUESTIONS) {
        const last2Theta = newResults.length >= 4 ? Math.abs(theta - 0.5) : 1
        if (last2Theta < 0.05 || newResults.length >= MAX_QUESTIONS) {
          setStep('done')
          return
        }
      }

      // No more questions left in the probe bank — finish instead of getting
      // stuck on the loading screen.
      if (currentIdx + 1 >= questions.length) {
        setStep('done')
        return
      }

      setCurrentIdx((i) => i + 1)
      setInputValue('')
    },
    [currentQ, results, theta, currentIdx, questions.length],
  )

  const handleSkip = useCallback(() => {
    setSkipsUsed((s) => s + 1)
    setCurrentIdx((i) => i + 1)
    setInputValue('')
    if (currentIdx + 1 >= questions.length) {
      setStep('done')
    }
  }, [currentIdx, questions.length])

  const handleFinish = useCallback(() => {
    const rec = recommendLevel(theta)
    const tree = rec.level.split('-')[0] as TreeId
    updateSettings({
      thetaPerTree: { [tree]: theta } as Record<TreeId, number>,
    })
    router.push(`/calculate/level/${rec.level}`)
  }, [theta, updateSettings, router])

  if (step === 'intro') {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 pt-12">
        <div className="mb-6 text-center">
          <div className="mb-3 text-5xl">🎯</div>
          <h1 className="mb-2 text-2xl font-bold text-white">能力评估</h1>
          <p className="text-sm text-white/60">
            我们会出 6-10 道题快速摸底，找到最适合你的起点
          </p>
        </div>

        <div className="mb-6 rounded-2xl bg-white/[0.06] p-4">
          <div className="mb-2 text-sm font-medium text-white">📝 评估说明</div>
          <ul className="space-y-1.5 text-xs text-white/60">
            <li>· 不显示对错，专注作答即可</li>
            <li>· 遇到没学过的可以「跳过」</li>
            <li>· 大约需要 5 分钟</li>
            <li>· 评估结果仅作推荐，不强制锁定</li>
          </ul>
        </div>

        <div className="mt-auto flex flex-col gap-3 pb-8">
          <button
            onClick={() => setStep('probing')}
            className="rounded-xl bg-blue-600 py-4 text-base font-bold text-white hover:bg-blue-500"
          >
            开始评估 →
          </button>
          <Link
            href="/calculate"
            className="text-center text-sm text-white/40 hover:text-white/60"
          >
            跳过，直接进入
          </Link>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 pt-12">
        <div className="mb-6 text-center">
          <div className="mb-3 text-5xl">✨</div>
          <h1 className="mb-2 text-2xl font-bold text-white">评估完成</h1>
          <p className="text-sm text-white/60">为你推荐的起点关卡</p>
        </div>

        <div className="mb-6 rounded-2xl bg-blue-500/10 p-6 text-center">
          <div className="text-3xl font-bold text-blue-300">{recommendation.level}</div>
          <div className="mt-2 text-sm text-white/80">{recommendation.reason}</div>
        </div>

        <div className="mb-6 rounded-2xl bg-white/[0.06] p-4">
          <div className="mb-2 text-xs font-medium text-white/40">本次摸底</div>
          <div className="flex justify-between text-sm text-white/70">
            <span>答题数: {results.length}</span>
            <span>跳过: {skipsUsed}</span>
            <span>能力值: {theta.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-auto pb-8">
          <button
            onClick={handleFinish}
            className="w-full rounded-xl bg-blue-600 py-4 text-base font-bold text-white hover:bg-blue-500"
          >
            开始练习 →
          </button>
        </div>
      </div>
    )
  }

  if (!currentQ) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white/60">
        加载中...
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs text-white/40">
          第 {results.length + 1} 题 (最少 {MIN_QUESTIONS} 题)
        </div>
        <button onClick={handleSkip} className="text-xs text-white/50 hover:text-white">
          我还没学到这里 →
        </button>
      </div>

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${((results.length + 1) / MAX_QUESTIONS) * 100}%` }}
        />
      </div>

      <div className="my-12 text-center">
        <div className="mb-3 text-3xl font-bold text-white">{currentQ.display}</div>
        {currentQ.hint && <div className="text-sm text-white/40">{currentQ.hint}</div>}
      </div>

      <div className="mt-auto pb-6">
        {isChoice && currentQ.options ? (
          <ChoiceGrid
            options={currentQ.options}
            onSelect={(opt) => handleAnswer(opt.value)}
            selectedValue={null}
            correctValue={null}
            showResult={false}
            disabled={false}
          />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-center">
              <div className="min-h-[48px] min-w-[120px] rounded-xl border-2 border-white/20 bg-white/[0.05] px-4 py-2 text-center text-2xl font-bold text-white">
                {inputValue || '...'}
              </div>
            </div>
            <NumberPad
              onInput={(d) => setInputValue((prev) => (prev.length < 8 ? prev + d : prev))}
              onDelete={() => setInputValue((prev) => prev.slice(0, -1))}
              onConfirm={() => {
                if (inputValue) handleAnswer(inputValue)
              }}
              disabled={false}
            />
          </>
        )}
      </div>
    </div>
  )
}
