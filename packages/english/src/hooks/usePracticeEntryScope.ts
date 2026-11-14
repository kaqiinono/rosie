'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useWordsContext } from '../WordsContext'

/** Apply an explicit URL scope once, after the requested textbook has loaded. */
export function usePracticeEntryScope(): { pending: boolean; error: string } {
  const query = useSearchParams()
  const stage = query.get('stage')
  const units = query.get('units') ?? ''
  const lessons = query.get('lessons') ?? ''
  const signature = stage ? JSON.stringify([stage, units, lessons]) : ''
  const applied = useRef('')
  const [result, setResult] = useState({ signature: '', error: '' })
  const { selStage, setSelStage, vocab, availableStages, isVocabLoading, entryScopeReady, entryScopeIndexReady, entryScopeError,
    setSelUnits, setSelLessons, setSelWords, setMasteryFilter, setSelVocabTypes } = useWordsContext()
  useEffect(() => {
    if (!signature) { applied.current = ''; return }
    if (applied.current === signature || !stage) return
    if (entryScopeError) {
      applied.current = signature
      setResult({ signature, error: '词库读取失败，请刷新页面重试。' }); return
    }
    if (!entryScopeIndexReady) return
    if (!availableStages.includes(stage)) {
      applied.current = signature
      setResult({ signature, error: '入口指定的词库不存在，请在入口管理中更新内容。' }); return
    }
    if (selStage !== stage) { setSelStage(stage); return }
    if (isVocabLoading || !entryScopeReady) return
    const requestedUnits = units.split(',').filter(Boolean)
    const requestedLessons = lessons.split(',').filter(Boolean)
    const current = vocab.filter((word) => word.stage === stage)
    if (!current.length || requestedUnits.some((unit) => !current.some((word) => word.unit === unit)) ||
      requestedLessons.some((lesson) => !current.some((word) => `${word.unit}::${word.lesson}` === lesson))) {
      applied.current = signature
      setResult({ signature, error: '入口指定的课程暂无单词，请在入口管理中更新内容。' }); return
    }
    setSelUnits(new Set(requestedUnits)); setSelLessons(new Set(requestedLessons))
    setSelWords(new Set()); setMasteryFilter(null); setSelVocabTypes(new Set(['Target', 'Context', 'Extension']))
    applied.current = signature
    setResult({ signature, error: '' })
  }, [signature, stage, units, lessons, selStage, availableStages, isVocabLoading, entryScopeReady, entryScopeIndexReady, entryScopeError, vocab,
    setSelStage, setSelUnits, setSelLessons, setSelWords, setMasteryFilter, setSelVocabTypes])
  return { pending: !!signature && (result.signature !== signature || (isVocabLoading && !result.error)), error: result.signature === signature ? result.error : '' }
}
