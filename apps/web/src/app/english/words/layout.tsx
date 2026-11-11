'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { WordsProvider, useWordsContext, useBaiduReadingAudio } from '@rosie/english'
import { useAuth, useImmersive } from '@rosie/core'
import { DarkScope } from '@rosie/ui'
import { AppHeader } from '@rosie/english'
import { ImmersiveMode } from '@rosie/english'

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  useBaiduReadingAudio(user)
  const pathname = usePathname()
  const {
    vocab,
    filteredWords,
    practiceTypes,
    recordBatch,
    previewCards,
    setPreviewCards,
    practiceButtonStyle,
  } = useWordsContext()
  const { isImmersive, setIsImmersive } = useImmersive()

  useEffect(() => {
    setIsImmersive(false)
    setPreviewCards(false)
  }, [pathname, setIsImmersive, setPreviewCards])

  const isPracticePage = pathname.includes('/practice')
  const isPrintPage = pathname.endsWith('/print')
  const isDaily = pathname.includes('/daily')
  const isWeeklyPage = pathname.includes('/weekly/')
  const isAdaptivePage = pathname.includes('/adaptive/')
  const isReading = pathname.includes('/reading')
  // Plan sessions own their own study/quiz UI; do not open the global ImmersiveMode overlay.
  const suppressGlobalImmersive =
    isDaily || isWeeklyPage || isAdaptivePage || isReading || isPrintPage
  const immersiveMode = isPracticePage && !isPrintPage && !previewCards ? 'practice' : 'vocab'

  // Print pages need dark ink on white; do not inherit the immersive dark-theme
  // text color (#f0f0ff). Never mount the fixed pink/blue glow layer on print
  // routes — iOS Safari paints position:fixed decorations onto page 1 of PDFs.
  return (
    <DarkScope appearance={isPrintPage ? 'light' : 'dark'}>
      <div
        className={`font-nunito min-h-screen ${isPrintPage ? 'en-words-print-layout' : ''}`}
        style={
          isPrintPage
            ? { background: '#ffffff', color: '#1c1917' }
            : { background: 'var(--wm-bg)', color: 'var(--wm-text)' }
        }
      >
        {(!isImmersive || isReading) && !isPrintPage && <AppHeader />}
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
    </DarkScope>
  )
}

export default function WordsLayout({ children }: { children: React.ReactNode }) {
  return (
    <WordsProvider vocabScope="stage">
      <LayoutInner>{children}</LayoutInner>
    </WordsProvider>
  )
}
