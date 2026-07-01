'use client'

import { useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { WordsProvider, useWordsContext } from '@rosie/english'
import { useImmersive } from '@rosie/core'
import { AppHeader } from '@rosie/english'
import { ImmersiveMode } from '@rosie/english'

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { vocab, filteredWords, setSelUnits, setSelLessons, setSelWords, practiceTypes, recordBatch, previewCards, setPreviewCards, practiceButtonStyle } = useWordsContext()
  const { isImmersive, setIsImmersive } = useImmersive()

  useEffect(() => {
    setIsImmersive(false)
    setPreviewCards(false)
  }, [pathname, setIsImmersive, setPreviewCards])

  const isPracticePage = pathname.includes('/practice')
  const isDaily = pathname.includes('/daily')
  const isWeeklyPage = pathname.includes('/weekly/')
  const isReading = pathname.includes('/reading')
  const immersiveMode = isPracticePage && !previewCards ? 'practice' : 'vocab'

  const enterImmersive = useCallback(() => {
    if (!filteredWords.length) {
      alert('请先筛选单词！')
      return
    }
    setIsImmersive(true)
  }, [filteredWords.length, setIsImmersive])

  return (
    <div className="min-h-screen font-nunito" style={{ background: 'var(--wm-bg)', color: 'var(--wm-text)' }}>
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse at 15% 25%, rgba(233,69,96,.07) 0, transparent 55%), radial-gradient(ellipse at 85% 75%, rgba(96,165,250,.07) 0, transparent 55%)' }}
      />
      {(!isImmersive || isReading) && (
        <AppHeader onImmersive={enterImmersive} />
      )}
      {children}
      <ImmersiveMode
        open={isImmersive && !isDaily && !isWeeklyPage && !isReading}
        words={filteredWords}
        allWords={vocab}
        mode={immersiveMode}
        practiceTypes={practiceTypes}
        spellButtonStyle={practiceButtonStyle}
        onClose={() => {
          if (isPracticePage && previewCards) {
            setPreviewCards(false)
          } else {
            setIsImmersive(false)
          }
        }}
        onQuizComplete={recordBatch}
      />
    </div>
  )
}

export default function WordsLayout({ children }: { children: React.ReactNode }) {
  return (
    <WordsProvider>
      <LayoutInner>{children}</LayoutInner>
    </WordsProvider>
  )
}
