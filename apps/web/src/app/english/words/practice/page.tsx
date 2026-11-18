'use client'

import { LoadingOverlay } from '@rosie/ui'
import { usePracticeEntryScope } from '@rosie/english'

import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@rosie/ui/themes'
import { useWordsContext } from '@rosie/english'
import { supabase, useImmersive, type WordEntry } from '@rosie/core'
import { findPassage, findPassageByKey, findSentenceForWord, findWordByKey, wordKey } from '@rosie/english'
import { FilterBar } from '@rosie/english'
import { PracticeSetup } from '@rosie/english'
import { serializePrintTypes } from '@rosie/english'
import type { SpellButtonStyle } from '@rosie/english'

export default function PracticePage() {
  const entryScope = usePracticeEntryScope()
  const {
    vocab, filteredWords, isVocabLoading, lessonStage,
    selStage, setSelStage,
    selUnits, setSelUnits,
    selLessons, setSelLessons,
    selWords, setSelWords,
    masteryFilter, setMasteryFilter,
    selVocabTypes, setSelVocabTypes,
    masteryMap,
    setPracticeTypes,
    setPracticeOverride,
    setPreviewCards,
    practiceButtonStyle,
    setPracticeButtonStyle,
  } = useWordsContext()
  const { setIsImmersive } = useImmersive()
  const searchParams = useSearchParams()
  const router = useRouter()

  // 3C: Context-practice entry from the reading page. When the URL carries
  // `?context=<passageKey>`, auto-filter to that lesson and launch immersive
  // Type-D practice without going through the manual PracticeSetup step.
  const contextPassageKey = searchParams.get('context')
  const focusWordKey = searchParams.get('focus')
  const autoLaunchedRef = useRef(false)
  const focusLaunchedRef = useRef(false)
  const senseQueueRequest = useRef<AbortController | null>(null)
  const [senseQueueLoading, setSenseQueueLoading] = useState(false)
  const [senseQueueMessage, setSenseQueueMessage] = useState('')
  useEffect(() => () => senseQueueRequest.current?.abort(), [])

  // Hard-word book: ?focus=<wordKey> → filter to one word and launch quiz.
  useEffect(() => {
    if (!focusWordKey || focusLaunchedRef.current || isVocabLoading) return
    const entry = findWordByKey(vocab, focusWordKey)
    if (!entry) {
      // The word may live in another textbook — switch to it and retry once
      // that stage's vocab finishes loading.
      const parts = focusWordKey.split('::')
      const stage = lessonStage[`${parts[0]}::${parts[1]}`]
      if (stage && stage !== selStage) setSelStage(stage)
      return
    }
    focusLaunchedRef.current = true
    if (entry.stage && entry.stage !== selStage) setSelStage(entry.stage)
    setSelUnits(new Set([entry.unit]))
    setSelLessons(new Set([`${entry.unit}::${entry.lesson}`]))
    setSelWords(new Set([wordKey(entry)]))
    setSelVocabTypes(new Set(['Target', 'Context', 'Extension']))
    setMasteryFilter(null)
    setPracticeTypes(['A', 'B', 'C'])
    setPreviewCards(false)
    setIsImmersive(true)
    router.replace('/english/words/practice')
  }, [
    focusWordKey,
    vocab,
    isVocabLoading,
    lessonStage,
    selStage,
    setSelStage,
    setSelUnits,
    setSelLessons,
    setSelWords,
    setSelVocabTypes,
    setMasteryFilter,
    setPracticeTypes,
    setPreviewCards,
    setIsImmersive,
    router,
  ])

  useEffect(() => {
    if (!contextPassageKey || autoLaunchedRef.current || isVocabLoading) return
    const passage = findPassageByKey(contextPassageKey)
    if (!passage) return
    const stage = lessonStage[`${passage.unit}::${passage.lesson}`]
    if (stage && stage !== selStage) {
      setSelStage(stage)
      return
    }
    autoLaunchedRef.current = true
    setSelUnits(new Set([passage.unit]))
    setSelLessons(new Set([`${passage.unit}::${passage.lesson}`]))
    setSelWords(new Set())
    setSelVocabTypes(new Set(['Target', 'Context', 'Extension']))
    setMasteryFilter(null)
    setPracticeTypes(['D'])
    setPreviewCards(false)
    setIsImmersive(true)
    // Drop the query so a refresh doesn't re-launch.
    router.replace('/english/words/practice')
  }, [contextPassageKey, isVocabLoading, lessonStage, selStage, setSelStage, setSelUnits, setSelLessons, setSelWords, setSelVocabTypes, setMasteryFilter, setPracticeTypes, setPreviewCards, setIsImmersive, router])

  // Type D is available whenever any filtered word's lesson has a passage
  // sentence for it — completely independent of the week-plan's ⭐ focus marker.
  const typeDAvailable = useMemo(
    () =>
      filteredWords.some((w) => {
        const passage = findPassage(w.stage, w.unit, w.lesson)
        return passage !== undefined && findSentenceForWord(passage, w) !== null
      }),
    [filteredWords],
  )

  const scopeLabel = useMemo(() => {
    const units = selUnits.size ? [...selUnits].join(', ') : '全部Unit'
    const lessons = selLessons.size
      ? [...new Set([...selLessons].map(k => k.split('::')[1]))].join(', ')
      : '全部Lesson'
    return `${units} / ${lessons}（${filteredWords.length}词）`
  }, [selUnits, selLessons, filteredWords.length])

  const startPractice = useCallback(
    (types: ('A' | 'B' | 'C' | 'D')[], preview: boolean, buttonStyle: SpellButtonStyle) => {
      if (!filteredWords.length) {
        alert('请先选择单词范围！')
        return
      }
      setPracticeOverride(null)
      setPracticeTypes(types)
      setPreviewCards(preview)
      setPracticeButtonStyle(buttonStyle)
      setIsImmersive(true)
    },
    [filteredWords.length, setPracticeOverride, setPracticeTypes, setPreviewCards, setPracticeButtonStyle, setIsImmersive],
  )

  const startSensePractice = async () => {
    const request = new AbortController()
    senseQueueRequest.current?.abort()
    senseQueueRequest.current = request
    setSenseQueueLoading(true)
    setSenseQueueMessage('')
    try {
      const visible = new Map(filteredWords.map((entry) => [entry.headwordId ?? entry.id, entry]))
      const scoped = vocab.filter((entry) => entry.id && visible.has(entry.headwordId ?? entry.id)
        && (!selUnits.size || selUnits.has(entry.unit))
        && (!selLessons.size || selLessons.has(`${entry.unit}::${entry.lesson}`))
        && (!selWords.size || selWords.has(wordKey(entry)))
        && (selVocabTypes.size === 3 || Boolean(entry.vocabType && selVocabTypes.has(entry.vocabType))))
      const byId = new Map(scoped.map((entry) => [entry.id, entry]))
      const { data, error } = await supabase.rpc('read_vocabulary_sense_queue', {
        p_positions: scoped.map((entry) => entry.id),
        p_limit: 10,
      }).abortSignal(request.signal)
      if (request.signal.aborted) return
      if (error) throw error
      const entries = (data as { word_entry_id: string; sense_id: string; written: {
        definitionEn?: string; definitionZh?: string; partOfSpeech?: string[]; example?: string
      } }[]).flatMap<WordEntry>((item) => {
        const position = byId.get(item.word_entry_id)
        if (!position) return []
        return [{
          ...position,
          practiceSenseId: item.sense_id,
          explanation: item.written.definitionEn || item.written.definitionZh || '',
          chineseDef: item.written.definitionZh,
          partOfSpeech: item.written.partOfSpeech,
          example: item.written.example,
        }]
      })
      if (!entries.length) {
        setSenseQueueMessage('当前范围没有到期或待学习的已审核义项。')
        return
      }
      setPracticeOverride(entries)
      setPracticeTypes(['B'])
      setPreviewCards(false)
      setIsImmersive(true)
    } catch {
      if (!request.signal.aborted) setSenseQueueMessage('义项复习加载失败，请重试。')
    } finally {
      if (!request.signal.aborted) setSenseQueueLoading(false)
    }
  }

  const openPrint = useCallback(
    (types: ('A' | 'B' | 'C' | 'D')[]) => {
      if (!filteredWords.length) {
        alert('请先选择单词范围！')
        return
      }
      const params = new URLSearchParams()
      params.set('stage', selStage)
      if (selUnits.size) params.set('units', [...selUnits].sort().join(','))
      if (selLessons.size) params.set('lessons', [...selLessons].join(','))
      if (selWords.size) params.set('words', [...selWords].join(','))
      if (masteryFilter !== null) params.set('mastery', String(masteryFilter))
      params.set('vocabTypes', [...selVocabTypes].join(','))
      params.set('types', serializePrintTypes(types))
      const seed = new Uint32Array(1)
      crypto.getRandomValues(seed)
      params.set('seed', String(seed[0]))
      window.open(`/english/words/practice/print?${params.toString()}`, '_blank')
    },
    [filteredWords.length, selStage, selUnits, selLessons, selWords, masteryFilter, selVocabTypes],
  )

  const toggleVocabType = useCallback((vocabType: 'Target' | 'Context' | 'Extension') => {
    setSelVocabTypes((prev) => {
      const next = new Set(prev)
      if (next.has(vocabType)) next.delete(vocabType)
      else next.add(vocabType)
      return next
    })
    setSelWords(new Set())
  }, [setSelVocabTypes, setSelWords])

  const toggleUnit = useCallback((unit: string) => {
    setSelUnits(prev => {
      const next = new Set(prev)
      if (next.has(unit)) {
        next.delete(unit)
        setSelLessons(old => new Set([...old].filter(k => !k.startsWith(`${unit}::`))))
      } else {
        next.add(unit)
      }
      setSelWords(new Set())
      return next
    })
  }, [setSelUnits, setSelLessons, setSelWords])

  const toggleLesson = useCallback((lesson: string) => {
    setSelLessons(prev => {
      const next = new Set(prev)
      if (next.has(lesson)) { next.delete(lesson) } else { next.add(lesson) }
      setSelWords(new Set())
      return next
    })
  }, [setSelLessons, setSelWords])

  const toggleWord = useCallback((word: string) => {
    setSelWords(prev => {
      const next = new Set(prev)
      if (next.has(word)) { next.delete(word) } else { next.add(word) }
      return next
    })
  }, [setSelWords])

  if (entryScope.pending) return <div className="relative min-h-[60dvh]"><LoadingOverlay visible placement="content" /></div>
  if (entryScope.error) return <p role="alert" className="p-4">{entryScope.error}</p>

  return (
    <>
      <FilterBar
        vocab={vocab}
        showStageFilter={false}
        selUnits={selUnits}
        selLessons={selLessons}
        selWords={selWords}
        filteredCount={filteredWords.length}
        onToggleUnit={toggleUnit}
        onToggleLesson={toggleLesson}
        onToggleWord={toggleWord}
        onClearWords={() => setSelWords(new Set())}
        masteryFilter={masteryFilter}
        onMasteryFilter={setMasteryFilter}
        masteryMap={masteryMap}
        selectedVocabTypes={selVocabTypes}
        onToggleVocabType={toggleVocabType}
      />
      <div className="max-w-[1280px] mx-auto px-4 py-5 relative z-[1]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--wm-text-dim)]">识词与字母砖练习，或进入 PET 语境应用。</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="soft" color="green" loading={senseQueueLoading}
              disabled={!filteredWords.length} onClick={() => void startSensePractice()}>
              按义项复习
            </Button>
            <Button asChild variant="soft" color="green">
              <Link href="/english/words/practice/pet">PET 日常与专项</Link>
            </Button>
          </div>
        </div>
        {senseQueueMessage && <p role="status" className="mb-4 text-sm">{senseQueueMessage}</p>}
        <PracticeSetup
          scopeLabel={scopeLabel}
          onStart={startPractice}
          onPrint={openPrint}
          typeDAvailable={typeDAvailable}
          initialButtonStyle={practiceButtonStyle}
        />
      </div>
    </>
  )
}
