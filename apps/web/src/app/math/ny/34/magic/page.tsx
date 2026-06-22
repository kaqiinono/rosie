'use client'

import { useState, useCallback } from 'react'
import type { FruitItem, Lesson34Mode } from '@/utils/type'
import { FRUIT_ITEMS, PRICES, SMALL_NUMS } from '@/utils/constant'
import { getSteps } from '@/utils/lesson34'
import { launchConfetti, pickDifferent } from '@/utils/confetti'
import ModeBar from '@/components/math/lesson34/ModeBar'
import StoryBox from '@/components/math/lesson34/StoryBox'
import StageArea from '@/components/math/lesson34/StageArea'
import MathFormula from '@/components/math/lesson34/MathFormula'
import SummaryCard from '@/components/math/lesson34/SummaryCard'
import Controls from '@/components/math/lesson34/Controls'

export default function Lesson34Page() {
  const [mode, setMode] = useState<Lesson34Mode>('merge')
  const [step, setStep] = useState(0)
  const [A, setA] = useState(4)
  const [B, setB] = useState(9)
  const [P, setP] = useState(25)
  const [fruit, setFruit] = useState<FruitItem>(FRUIT_ITEMS[0])

  const steps = getSteps(mode, A, B, P, fruit)
  const currentStep = steps[step]
  const isLast = step >= steps.length - 1

  const stageLabel = (() => {
    const isMerge = mode === 'merge'
    if (isMerge) {
      if (step === 0) return `${fruit.emoji} ${fruit.name}店`
      if (step === 1) return '妈妈来买啦！'
      if (step === 2) return '爸爸也来买啦！'
      if (step === 3) return '分开算钱'
      if (step === 4) return '想一想……'
      if (step === 5) return '合在一起！对比看！'
      if (step === 6) return '合起来算钱！'
      return '🎉 恭喜你发现了秘密！'
    }
    if (step === 0) return `${fruit.emoji} 一大堆${fruit.name}`
    if (step === 1) return `${A + B} 袋${fruit.name}`
    if (step === 2) return '先算总价'
    if (step === 3) return '想一想……拆成两份？'
    if (step === 4) return '拆成两份！对比看！'
    if (step === 5) return '分开算钱'
    return '🎉 又发现了秘密！'
  })()

  const goToStep = useCallback((s: number) => {
    setStep(s)
    if (s >= steps.length - 1) {
      launchConfetti()
    }
  }, [steps.length])

  const handleNext = useCallback(() => {
    if (step < steps.length - 1) {
      goToStep(step + 1)
    }
  }, [step, steps.length, goToStep])

  const handleReset = useCallback(() => {
    goToStep(0)
  }, [goToStep])

  const handleRandom = useCallback(() => {
    const newA = pickDifferent(SMALL_NUMS, A)
    const newB = pickDifferent(SMALL_NUMS.filter(v => v !== newA), B)
    const newP = pickDifferent(PRICES, P)
    const newFruit = pickDifferent(FRUIT_ITEMS, fruit)
    setA(newA)
    setB(newB)
    setP(newP)
    setFruit(newFruit)
    setStep(0)
  }, [A, B, P, fruit])

  const handleModeSwitch = useCallback((m: Lesson34Mode) => {
    setMode(m)
    setStep(0)
  }, [])

  const avatar = mode === 'merge' ? '🧒' : '🤔'

  return (
    <div className="min-h-screen animate-bg-shift bg-gradient-to-br from-sky-100 via-amber-50 via-35% to-pink-100 to-70% bg-[length:400%_400%]">
      <div className="mx-auto flex min-h-screen max-w-[960px] flex-col gap-3.5 px-3.5 py-4 pb-10">
        {/* Hero */}
        <div className="rounded-[20px] border-2 border-white/60 bg-white/85 px-3 py-3.5 text-center shadow-[0_8px_32px_rgba(0,0,0,.08)]">
          <h1 className="mb-1 text-2xl font-bold text-red-600 max-[600px]:text-xl">买苹果学数学</h1>
          <p className="text-[13px] text-slate-500">合在一起算 和 分开算，结果一样多！</p>
        </div>

        <ModeBar mode={mode} onSwitch={handleModeSwitch} />

        <StoryBox avatar={avatar} html={currentStep.story} />

        <StageArea
          stageLabel={stageLabel}
          emoji={fruit.emoji}
          price={P}
          A={A}
          B={B}
          mode={mode}
          step={step}
          totalSteps={steps.length}
        />

        <MathFormula mode={mode} step={step} A={A} B={B} P={P} />

        <SummaryCard
          visible={isLast}
          emoji={fruit.emoji}
          A={A}
          B={B}
          P={P}
          mode={mode}
        />

        <Controls
          mode={mode}
          step={step}
          totalSteps={steps.length}
          btnText={currentStep.btn}
          isLast={isLast}
          onNext={handleNext}
          onReset={handleReset}
          onRandom={handleRandom}
        />
      </div>
    </div>
  )
}
