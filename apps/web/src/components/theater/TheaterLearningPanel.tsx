'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { supabase, type WordEntry } from '@rosie/core'
import { WordPopup } from '@rosie/english'
import { StickerCard } from '@rosie/ui'
import { Button, Flex, Heading, Spinner, Text, TextArea } from '@rosie/ui/themes'
import { theaterTime } from '@/lib/theater/subtitle-timeline'
import type { TheaterCue, TheaterStudyItem } from '@/lib/theater/types'

type Lookup = { cueId: string; word: string; headwordId: string | null; entry?: WordEntry }
type Props = {
  userId: string
  filmId: string
  cue?: TheaterCue
  onPause: () => void
  onReview: (item: TheaterStudyItem) => void
}

const wordPattern = /([\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*)/u
const fields = 'kind,item_key,position_ms,cue_text,detail,headword_id'
const itemIdentity = (item: TheaterStudyItem) => item.kind + ':' + item.item_key
const itemLabels = { favorite: '收藏', note: '笔记', word: '生词' }

export default function TheaterLearningPanel({ userId, filmId, cue, onPause, onReview }: Props) {
  const noteId = useId()
  const [items, setItems] = useState<TheaterStudyItem[] | null>(null)
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null)
  const [lookupResult, setLookup] = useState<Lookup | null>(null)
  const lookup = lookupResult?.cueId === cue?.id ? lookupResult : null
  const [pending, setPending] = useState<'read' | 'lookup' | 'write' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [limit, setLimit] = useState(20)
  const activeRequest = useRef<AbortController | null>(null)
  const favorite = items?.find(item => item.kind === 'favorite' && item.item_key === cue?.id)
  const note = items?.find(item => item.kind === 'note' && item.item_key === cue?.id)
  const currentNote = draft?.id === cue?.id ? draft?.text ?? '' : note?.detail ?? ''

  async function run(operation: NonNullable<typeof pending>, work: (signal: AbortSignal) => Promise<void>) {
    if (activeRequest.current) return
    const controller = new AbortController()
    activeRequest.current = controller
    setPending(operation)
    setError('')
    setNotice('')
    try {
      const { data } = await supabase.auth.getSession()
      if (controller.signal.aborted) return
      if (data.session?.user.id !== userId) throw Error('请重新登录。')
      await work(controller.signal)
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : '操作未完成，请重试。')
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null
        setPending(null)
      }
    }
  }

  function load() {
    void run('read', async signal => {
      const { data, error } = await supabase.from('theater_study_items').select(fields)
        .eq('user_id', userId).eq('film_id', filmId).order('created_at', { ascending: false })
        .abortSignal(signal)
      if (signal.aborted) return
      if (error) throw Error('暂时无法读取学习记录。')
      setItems(data as TheaterStudyItem[])
    })
  }

  useEffect(() => {
    load()
    return () => {
      activeRequest.current?.abort()
      activeRequest.current = null
    }
    // This component is keyed by its owner and film.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function lookupWord(word: string) {
    if (!cue) return
    const cueId = cue.id
    onPause()
    setLookup(null)
    void run('lookup', async signal => {
      const { data: headwordId, error } = await supabase.rpc('find_vocabulary_headword', { p_word: word })
        .abortSignal(signal)
      if (signal.aborted) return
      if (error) throw Error('暂时无法查词，请重试。')
      if (typeof headwordId !== 'string') { setLookup({ cueId, word, headwordId: null }); return }
      const result = await supabase.from('vocabulary_search').select('id,word,stage,unit,lesson,ipa,example,shared_explanation,shared_chinese_def')
        .eq('headword_id', headwordId).abortSignal(signal).maybeSingle()
      if (signal.aborted) return
      if (result.error) throw Error('暂时无法读取词义，请重试。')
      const row = result.data
      setLookup({
        cueId, word, headwordId,
        entry: row ? {
          id: row.id, headwordId, word: row.word, stage: row.stage ?? undefined,
          unit: row.unit, lesson: row.lesson, ipa: row.ipa?.trim() || undefined,
          example: row.example ?? undefined, explanation: row.shared_explanation ?? '',
          chineseDef: row.shared_chinese_def ?? undefined,
        } : undefined,
      })
    })
  }

  function storeItem(item: TheaterStudyItem, remove = false) {
    void run('write', async signal => {
      const table = supabase.from('theater_study_items')
      const result = await (remove
        ? table.delete().eq('user_id', userId).eq('film_id', filmId).eq('kind', item.kind).eq('item_key', item.item_key)
        : table.upsert({ ...item, user_id: userId, film_id: filmId }, { onConflict: 'user_id,film_id,kind,item_key' }))
        .abortSignal(signal)
      if (signal.aborted) return
      if (result.error) throw Error('学习记录未保存，请重试。')
      setItems(current => {
        const rest = (current ?? []).filter(existing => itemIdentity(existing) !== itemIdentity(item))
        return remove ? rest : [item, ...rest]
      })
      if (item.kind === 'note') setDraft(null)
      setNotice(remove ? '已移除' + itemLabels[item.kind] : '已保存' + itemLabels[item.kind])
    })
  }

  function cueItem(kind: TheaterStudyItem['kind'], detail = '', word?: Lookup): TheaterStudyItem | null {
    if (!cue) return null
    return {
      kind, item_key: word ? word.word.toLowerCase() : cue.id, position_ms: cue.startMs,
      cue_text: [cue.en, cue.zh].filter(Boolean).join('\n').slice(0, 4000), detail,
      headword_id: word?.headwordId ?? null,
    }
  }

  function saveNote(event: FormEvent) {
    event.preventDefault()
    const item = cueItem('note', currentNote.trim())
    if (item?.detail) storeItem(item)
  }

  const lookupItem = lookup ? cueItem('word', lookup.word, lookup) : null
  const lookupSaved = lookupItem && items?.some(item => itemIdentity(item) === itemIdentity(lookupItem))
  const saveWord = lookupItem && (
    <Button type="button" variant="soft" disabled={pending !== null || items === null || !!lookupSaved}
      onClick={() => storeItem(lookupItem)}>{lookupSaved ? '已存入生词' : '存入生词'}</Button>
  )

  return (
    <StickerCard as="section" aria-label="台词学习">
      <Flex direction="column" gap="3">
        <Heading as="h2" size="4">台词学习</Heading>
        {error && <Text role="alert" color="red" size="2">{error}</Text>}
        {notice && <Text role="status" size="2">{notice}</Text>}
        {pending === 'read' && <Text role="status" size="2"><Spinner /> 正在读取学习记录…</Text>}
        {items === null && pending === null && <Button onClick={load} variant="soft">重新读取记录</Button>}
        {cue ? (
          <>
            <div className="whitespace-pre-wrap break-words leading-loose">
              {cue.en?.split(wordPattern).map((part, index) => index % 2 === 1 && part.length <= 120 ? (
                <Button key={index} type="button" variant="ghost" disabled={pending !== null}
                  onClick={() => lookupWord(part)} aria-label={'查询 ' + part}>{part}</Button>
              ) : <span key={index}>{part}</span>)}
              {cue.zh && <Text as="div" size="2" color="gray">{cue.zh}</Text>}
            </div>
            {pending === 'lookup' && <Text role="status" size="2"><Spinner /> 正在查词…</Text>}
            {lookup?.entry && <WordPopup entry={lookup.entry} mastery={undefined} showMastery={false}
              sourceContext={cue.en ? { title: '影片台词', sentence: cue.en, matchedForm: lookup.word } : undefined}
              onClose={() => setLookup(null)}
              actions={<Flex direction="column" gap="2" align="start">
                {error && <Text role="alert" color="red" size="2">{error}</Text>}
                {saveWord}
              </Flex>} />}
            {lookup && !lookup.entry && <StickerCard size="sm" tone="paper" elevation="flat">
              <Flex direction="column" gap="2">
                <Text weight="bold">{lookup.word}</Text>
                <Text size="2" color="gray">共享词库暂未收录这个词的释义。</Text>
                <Flex gap="2" wrap="wrap">
                  {saveWord}
                  <Button type="button" variant="ghost" onClick={() => setLookup(null)}>关闭释义</Button>
                </Flex>
              </Flex>
            </StickerCard>}
            <Flex gap="2" wrap="wrap">
              <Button type="button" variant="soft" disabled={pending !== null || items === null}
                onClick={() => {
                  onPause()
                  const item = favorite ?? cueItem('favorite')
                  if (item) storeItem(item, Boolean(favorite))
                }}>{favorite ? '取消收藏' : '收藏此句'}</Button>
            </Flex>
            <form onSubmit={saveNote}>
              <Flex direction="column" gap="2">
                <Text as="label" htmlFor={noteId} size="2">这句的笔记</Text>
                <TextArea id={noteId} value={currentNote} maxLength={2000} onFocus={onPause}
                  onChange={event => setDraft({ id: cue.id, text: event.target.value })} />
                <Flex gap="2" wrap="wrap">
                  <Button type="submit" disabled={pending !== null || items === null || !currentNote.trim() || currentNote === note?.detail}>
                    保存笔记
                  </Button>
                  {note && <Button type="button" variant="soft" disabled={pending !== null}
                    onClick={() => storeItem(note, true)}>移除笔记</Button>}
                </Flex>
              </Flex>
            </form>
          </>
        ) : <Text size="2" color="gray">选择一句字幕，就可以查词、收藏和记笔记。</Text>}
        <Heading as="h3" size="3">本片学习记录</Heading>
        {items?.length === 0 && <Text size="2" color="gray">还没有学习记录。</Text>}
        {items?.slice(0, limit).map(item => (
          <StickerCard key={itemIdentity(item)} size="sm" elevation="flat" tone="paper">
            <Flex direction="column" gap="2">
              <Text size="2" weight="bold">{itemLabels[item.kind]} · {theaterTime(item.position_ms)}</Text>
              <Text size="2" className="whitespace-pre-wrap break-words">{item.cue_text}</Text>
              {item.detail && <Text size="2" className="whitespace-pre-wrap break-words">{item.detail}</Text>}
              <Flex gap="2" wrap="wrap">
                <Button type="button" variant="soft" onClick={() => { setLookup(null); onReview(item) }}>回到原句复读</Button>
                <Button type="button" variant="ghost" disabled={pending !== null}
                  onClick={() => storeItem(item, true)}>移除{itemLabels[item.kind]}</Button>
              </Flex>
            </Flex>
          </StickerCard>
        ))}
        {items && items.length > limit && <Button variant="soft" onClick={() => setLimit(value => value + 20)}>显示更多</Button>}
      </Flex>
    </StickerCard>
  )
}
