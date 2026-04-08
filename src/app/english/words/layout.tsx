'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { WordsProvider, useWordsContext } from '@/contexts/WordsContext'
import { useImmersive } from '@/contexts/ImmersiveContext'
import AppHeader from '@/components/english/words/AppHeader'
import ImportModal from '@/components/english/words/ImportModal'
import ImmersiveMode from '@/components/english/words/ImmersiveMode'
import type { WordEntry } from '@/utils/type'

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { vocab, setVocab, upsertByStage, filteredWords, setSelUnits, setSelLessons, setSelWords, practiceTypes, recordBatch, previewCards, setPreviewCards } = useWordsContext()
  const { isImmersive, setIsImmersive } = useImmersive()

  const [importOpen, setImportOpen] = useState(false)

  // Reset immersive when navigating away
  useEffect(() => {
    setIsImmersive(false)
    setPreviewCards(false)
  }, [pathname, setIsImmersive, setPreviewCards])

  const isPracticePage = pathname.includes('/practice')
  const isDaily = pathname.includes('/daily')
  // When previewCards is true on the practice page, show vocab cards first; then switch to quiz
  const immersiveMode = isPracticePage && !previewCards ? 'practice' : 'vocab'

  const handleImport = useCallback((words: WordEntry[]) => {
    void setVocab(words)
    setSelUnits(new Set())
    setSelLessons(new Set())
    setSelWords(new Set())
  }, [setVocab, setSelUnits, setSelLessons, setSelWords])

  const handleAppend = useCallback((words: WordEntry[]) => {
    void upsertByStage(words)
    setSelWords(new Set())
  }, [upsertByStage, setSelWords])

  const handleExport = useCallback(async () => {
    const xlsx = await import('xlsx')
    const { utils, writeFile } = xlsx.default || xlsx
    const wb = utils.book_new()
    const headers = ['Stage', 'Unit', 'Lesson', '单词 (word)', '释义 (explanation)', '音标 (ipa)', '例句 (example)']
    const rows = [headers, ...vocab.map(v => [v.stage || '', v.unit, v.lesson, v.word, v.explanation, v.ipa || '', v.example || ''])]
    const ws = utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 45 }, { wch: 18 }, { wch: 50 }]
    utils.book_append_sheet(wb, ws, '单词数据')
    writeFile(wb, 'RosieFun_词库.xlsx')
  }, [vocab])

  const enterImmersive = useCallback(() => {
    if (!isDaily && !filteredWords.length) {
      alert('请先筛选单词！')
      return
    }
    setIsImmersive(true)
  }, [isDaily, filteredWords.length, setIsImmersive])

  return (
    <div className="min-h-screen font-nunito" style={{ background: 'var(--wm-bg)', color: 'var(--wm-text)' }}>
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse at 15% 25%, rgba(233,69,96,.07) 0, transparent 55%), radial-gradient(ellipse at 85% 75%, rgba(96,165,250,.07) 0, transparent 55%)' }}
      />
      {!isImmersive && (
        <AppHeader
          onImport={() => setImportOpen(true)}
          onExport={handleExport}
          onImmersive={enterImmersive}
        />
      )}
      {children}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        onAppend={handleAppend}
      />
      {/* ImmersiveMode opens when immersive is active on non-daily pages */}
      <ImmersiveMode
        open={isImmersive && !isDaily}
        words={filteredWords}
        allWords={vocab}
        mode={immersiveMode}
        practiceTypes={practiceTypes}
        onClose={() => {
          if (isPracticePage && previewCards) {
            // Preview done — stay immersive but switch to quiz mode
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
