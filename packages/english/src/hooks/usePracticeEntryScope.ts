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

  // Decide during render so the outcome latches without an effect setState;
  // the effect below only performs the selection side effects.
  if (signature && stage && result.signature !== signature) {
    let error = ''
    let decided = true
    if (entryScopeError) error = '词库读取失败，请刷新页面重试。'
    else if (!entryScopeIndexReady) decided = false
    else if (!availableStages.includes(stage)) error = '入口指定的词库不存在，请在入口管理中更新内容。'
    else if (selStage !== stage || isVocabLoading || !entryScopeReady) decided = false
    else {
      const requestedUnits = units.split(',').filter(Boolean)
      const requestedLessons = lessons.split(',').filter(Boolean)
      const current = vocab.filter((word) => word.stage === stage)
      if (!current.length || requestedUnits.some((unit) => !current.some((word) => word.unit === unit)) ||
        requestedLessons.some((lesson) => !current.some((word) => `${word.unit}::${word.lesson}` === lesson))) {
        error = '入口指定的课程暂无单词，请在入口管理中更新内容。'
      }
    }
    if (decided) setResult({ signature, error })
  }

  useEffect(() => {
    if (!signature) { applied.current = ''; return }
    if (applied.current === signature) return
    if (result.signature === signature) {
      applied.current = signature
      if (result.error) return
      setSelUnits(new Set(units.split(',').filter(Boolean)))
      setSelLessons(new Set(lessons.split(',').filter(Boolean)))
      setSelWords(new Set()); setMasteryFilter(null); setSelVocabTypes(new Set(['Target', 'Context', 'Extension']))
      return
    }
    if (!entryScopeError && entryScopeIndexReady && stage && availableStages.includes(stage) && selStage !== stage) {
      setSelStage(stage)
    }
  }, [signature, stage, units, lessons, result, selStage, availableStages, entryScopeError, entryScopeIndexReady,
    setSelStage, setSelUnits, setSelLessons, setSelWords, setMasteryFilter, setSelVocabTypes])
  return { pending: !!signature && (result.signature !== signature || (isVocabLoading && !result.error)), error: result.signature === signature ? result.error : '' }
}