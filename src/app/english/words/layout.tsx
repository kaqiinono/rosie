'use client'

import { useState, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { WordsProvider, useWordsContext } from '@/contexts/WordsContext'
import AppHeader from '@/components/english/words/AppHeader'
import ImportModal from '@/components/english/words/ImportModal'
import ImmersiveMode from '@/components/english/words/ImmersiveMode'
import type { WordEntry } from '@/utils/type'

function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { vocab, setVocab, filteredWords, setSelUnits, setSelLessons, setSelWords, practiceTypes } = useWordsContext()

  const [importOpen, setImportOpen] = useState(false)
  const [immersiveOpen, setImmersiveOpen] = useState(false)
  const [immersiveMode, setImmersiveMode] = useState<'vocab' | 'practice'>('vocab')
  const [isImmersive, setIsImmersive] = useState(false)

  useEffect(() => {
    if (!pathname.includes('/daily')) setIsImmersive(false)
  }, [pathname])

  useEffect(() => {
    if (isImmersive) document.body.classList.add('words-immersive')
    else document.body.classList.remove('words-immersive')
    return () => document.body.classList.remove('words-immersive')
  }, [isImmersive])

  useEffect(() => {
    const handle = () => setIsImmersive(false)
    window.addEventListener('exit-words-immersive', handle)
    return () => window.removeEventListener('exit-words-immersive', handle)
  }, [])

  const handleImport = useCallback((words: WordEntry[]) => {
    void setVocab(words)
    setSelUnits(new Set())
    setSelLessons(new Set())
    setSelWords(new Set())
  }, [setVocab, setSelUnits, setSelLessons, setSelWords])

  const handleExport = useCallback(async () => {
    const xlsx = await import('xlsx')
    const { utils, writeFile } = xlsx.default || xlsx
    const wb = utils.book_new()
    const headers = ['Unit', 'Lesson', '单词 (word)', '释义 (explanation)', '音标 (ipa)', '例句 (example)']
    const rows = [headers, ...vocab.map(v => [v.unit, v.lesson, v.word, v.explanation, v.ipa || '', v.example || ''])]
    const ws = utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 45 }, { wch: 18 }, { wch: 50 }]
    utils.book_append_sheet(wb, ws, '单词数据')
    writeFile(wb, 'RosieFun_词库.xlsx')
  }, [vocab])

  const enterImmersive = useCallback(() => {
    if (pathname.includes('/daily')) {
      setIsImmersive(true)
      return
    }
    if (!filteredWords.length) {
      alert('请先筛选单词！')
      return
    }
    setImmersiveMode(pathname.includes('/practice') ? 'practice' : 'vocab')
    setImmersiveOpen(true)
  }, [filteredWords, pathname])

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
      />
      <ImmersiveMode
        open={immersiveOpen}
        words={filteredWords}
        allWords={vocab}
        mode={immersiveMode}
        practiceTypes={practiceTypes}
        onClose={() => setImmersiveOpen(false)}
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
