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
  const isPrintPage = pathname.includes('/practice/print')
  const isDaily = pathname.includes('/daily')
  const isWeeklyPage = pathname.includes('/weekly/')
  const isAdaptivePage = pathname.includes('/adaptive/')
  const isReading = pathname.includes('/reading')
  // Plan sessions own their own study/quiz UI; do not open the global ImmersiveMode overlay.
  const suppressGlobalImmersive =
    isDaily || isWeeklyPage || isAdaptivePage || isReading || isPrintPage
  const immersiveMode =
    isPracticePage && !isPrintPage && !previewCards ? 'practice' : 'vocab'

  const enterImmersive = useCallback(() => {
    if (!filteredWords.length) {
      alert('请先筛选单词！')
      return
    }
    setIsImmersive(true)
  }, [filteredWords.length, setIsImmersive])

  // Print pages need dark ink on white; do not inherit the immersive dark-theme
  // text color (#f0f0ff). Never mount the fixed pink/blue glow layer on print
  // routes — iOS Safari paints position:fixed decorations onto page 1 of PDFs.
  return (
    <div
      className={`min-h-screen font-nunito ${isPrintPage ? 'en-words-print-layout' : ''}`}
      style={
        isPrintPage
          ? { background: '#ffffff', color: '#1c1917' }
          : { background: 'var(--wm-bg)', color: 'var(--wm-text)' }
      }
    >
      {!isPrintPage && (
        <div
          className="en-words-bg-deco en-no-print fixed inset-0 pointer-events-none z-0"
          aria-hidden
          style={{ background: 'radial-gradient(ellipse at 15% 25%, rgba(233,69,96,.07) 0, transparent 55%), radial-gradient(ellipse at 85% 75%, rgba(96,165,250,.07) 0, transparent 55%)' }}
        />
      )}
      {(!isImmersive || isReading) && !isPrintPage && (
        <AppHeader onImmersive={enterImmersive} />
      )}
      {children}
      <ImmersiveMode
        open={isImmersive && !suppressGlobalImmersive}
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
