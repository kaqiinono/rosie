'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@rosie/core'
import { FormSelect, StickerCard } from '@rosie/ui'
import { Badge, Button, Checkbox, Flex, Spinner, Text, TextField } from '@rosie/ui/themes'
import type { ExamDraftInput } from '../../validation/contracts'
import type { QuestionId, VocabularyLink } from '../../types/content'
import type { ExamAdminWordChoice, ExamAdminWordSearch } from '../../types/adminWords'
import { examRequest, ExamRequestError } from '../../client/examApi'
import { DraftText } from './DraftFields'

type Props = { draft: ExamDraftInput; onChange: (draft: ExamDraftInput) => void }
type Position = { start: number; text: string; matchedForm: string; materialId: string; blockId: string }

function positions(text: string, matchedForm: string): number[] {
  if (!matchedForm.trim()) return []
  const result: number[] = []
  let from = 0
  while (from <= text.length - matchedForm.length) {
    const start = text.indexOf(matchedForm, from)
    if (start < 0) break
    result.push(start)
    from = start + 1
  }
  return result
}

function localLinkId(draft: ExamDraftInput): string {
  const ids = new Set<string>()
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(collect)
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (key === 'id' && typeof item === 'string') ids.add(item)
        else collect(item)
      }
    }
  }
  collect(draft)
  let id: string
  do { id = `vocab-${crypto.randomUUID()}` } while (ids.has(id))
  return id
}

function LinkEditor({ draft, existing, userId, onApply, onCancel }: {
  draft: ExamDraftInput; existing?: VocabularyLink; userId: string
  onApply: (link: VocabularyLink) => void; onCancel: () => void
}) {
  // Only the local link gets a new ID; dictionary UUIDs are selected, never invented.
  const [id] = useState(() => existing?.id ?? localLinkId(draft))
  const [query, setQuery] = useState(existing?.sourceSnapshot.word ?? '')
  const [search, setSearch] = useState<ExamAdminWordSearch | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [word, setWord] = useState<ExamAdminWordChoice | null>(() => existing ? { id: existing.wordEntryId, sourceSnapshot: existing.sourceSnapshot } : null)
  const [materialId, setMaterialId] = useState(existing?.materialId ?? '')
  const [blockId, setBlockId] = useState(existing?.blockId ?? '')
  const [matchedForm, setMatchedForm] = useState(existing?.matchedForm ?? '')
  const [contextMeaning, setContextMeaning] = useState(existing?.contextMeaning ?? '')
  const [questionIds, setQuestionIds] = useState<QuestionId[]>(() => [...(existing?.questionIds ?? [])])
  const [role, setRole] = useState<VocabularyLink['role']>(existing?.role ?? 'background')
  const [positionPage, setPositionPage] = useState(0)
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(() => {
    const block = draft.content.materials.find(material => material.id === existing?.materialId)?.blocks.find(item => item.id === existing?.blockId)
    return existing && block?.kind === 'text' ? { start: existing.textRange.start, text: block.text, matchedForm: existing.matchedForm, materialId: existing.materialId, blockId: existing.blockId } : null
  })
  const [applyError, setApplyError] = useState('')
  const searchController = useRef<AbortController | null>(null)
  useEffect(() => () => searchController.current?.abort(), [])

  const material = draft.content.materials.find(item => item.id === materialId)
  const block = material?.blocks.find(item => item.id === blockId && item.kind === 'text')
  const text = block?.kind === 'text' ? block.text : ''
  const matches = positions(text, matchedForm)
  const selectedIsCurrent = selectedPosition !== null && selectedPosition.text === text && selectedPosition.matchedForm === matchedForm
    && selectedPosition.materialId === materialId && selectedPosition.blockId === blockId && matches.includes(selectedPosition.start)
  const start = matches.length === 1 ? matches[0] : selectedIsCurrent && selectedPosition ? selectedPosition.start : null
  const questions = [...new Map(draft.content.groups.filter(group => group.materialIds.includes(materialId))
    .flatMap(group => group.questions.map(question => [question.id, question] as const))).values()]
  const chosenWords = word && !search?.items.some(item => item.id === word.id) ? [word, ...(search?.items ?? [])] : search?.items ?? []
  const page = Math.min(positionPage, Math.max(0, Math.ceil(matches.length / 20) - 1))
  const shownPositions = matches.slice(page * 20, page * 20 + 20)
  if (start !== null && !shownPositions.includes(start)) shownPositions.unshift(start)
  const positionLabel = (offset: number) => `第 ${matches.indexOf(offset) + 1} 处：${text.slice(Math.max(0, offset - 25), offset + matchedForm.length + 25).replace(/\s+/g, ' ')}`

  async function searchWords() {
    const value = query.trim()
    if (!value || query.length > 80) { setSearchError('请输入 1–80 个字符的词条搜索内容。'); return }
    searchController.current?.abort()
    const controller = new AbortController()
    searchController.current = controller
    setSearching(true); setSearchError('')
    try {
      const found = await examRequest<ExamAdminWordSearch>(userId, `/api/admin/exams/words?q=${encodeURIComponent(value)}&limit=20`, { signal: controller.signal })
      if (!controller.signal.aborted) setSearch(found)
    } catch (error) {
      if (!controller.signal.aborted) setSearchError(error instanceof ExamRequestError && error.status === 403 ? '当前账号没有管理员词条查询权限。'
        : error instanceof ExamRequestError && error.status === 401 ? '登录已过期，请重新登录。' : '词条查询未完成，请重试；本地关联输入仍保留。')
    } finally { if (searchController.current === controller) setSearching(false) }
  }

  function apply() {
    if (!word || !material || block?.kind !== 'text' || start === null || !contextMeaning.trim()
      || !questionIds.length || questionIds.some(questionId => !questions.some(question => question.id === questionId))) {
      setApplyError('请选择真实词条、材料文字块和关联题目，填写语境含义，并明确词形出现位置。'); return
    }
    if (block.text.slice(start, start + matchedForm.length) !== matchedForm) {
      setApplyError('材料文字已变化，请重新定位词形。'); return
    }
    if (draft.content.vocabularyLinks.some(link => link.id !== existing?.id && link.wordEntryId.toLowerCase() === word.id.toLowerCase()
      && link.materialId === material.id && link.blockId === block.id && link.textRange.start === start && link.textRange.end === start + matchedForm.length)) {
      setApplyError('这个词条在该位置已有候选关联，请编辑现有关联的题目范围。'); return
    }
    onApply({ id, wordEntryId: word.id, sourceSnapshot: { ...word.sourceSnapshot }, questionIds: [...questionIds], materialId: material.id, blockId: block.id,
      matchedForm, contextMeaning: contextMeaning.trim(), sentence: block.text, textRange: { start, end: start + matchedForm.length }, role, review: { status: 'pending' } })
  }

  return <StickerCard as="section" tone="paper" elevation="flat" size="lg"><Flex direction="column" gap="4">
    <Text weight="bold" size="4">{existing ? '编辑词条关联' : '新建词条关联'}</Text>
    <Text size="2">先选择现有 KET 词条和原文位置，再把关联加入本地草稿。最后仍需使用页面的保存操作；候选保持待审核。</Text>
    <Flex direction="column" gap="2"><TextField.Root aria-label="搜索现有 KET 词条" size="3" maxLength={80} value={query} placeholder="输入词条或词组"
      onChange={event => { setQuery(event.target.value); setSearchError('') }} onKeyDown={event => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void searchWords() }
      }} />
      <Flex gap="2" wrap="wrap"><Button type="button" size="3" variant="soft" loading={searching} disabled={!query.trim()} onClick={() => void searchWords()}>搜索 KET 词库</Button>
        {query && <Button type="button" size="3" variant="soft" onClick={() => { searchController.current?.abort(); setSearching(false); setQuery(''); setSearch(null); setSearchError('') }}>清除搜索</Button>}</Flex>
    </Flex>
    {searching && <Flex gap="2" align="center"><Spinner /><Text size="2" role="status">正在查询现有词条…</Text></Flex>}
    {searchError && <Text size="2" color="red" role="alert">{searchError}</Text>}
    {search && !searching && <Text size="2" color="gray">“{search.query}”找到 {search.items.length} 个当前候选{search.hasMore ? '，还有更多结果，请细化搜索' : ''}。</Text>}
    <FormSelect ariaLabel="选择真实词条" size="3" value={word?.id ?? ''} disabled={searching}
      options={[{ value: '', label: '请选择真实词条' }, ...chosenWords.map(item => ({ value: item.id, label: `${item.sourceSnapshot.word} · ${item.sourceSnapshot.stage} / ${item.sourceSnapshot.unit} / ${item.sourceSnapshot.lesson}` }))]}
      onValueChange={value => setWord(chosenWords.find(item => item.id === value) ?? null)} />
    {word && <Text size="2" color="gray" className="break-all">词条 ID：{word.id}；快照：{word.sourceSnapshot.stage} / {word.sourceSnapshot.unit} / {word.sourceSnapshot.lesson} / {word.sourceSnapshot.word}</Text>}
    <FormSelect ariaLabel="选择当前草稿材料" size="3" value={materialId} options={[{ value: '', label: '请选择材料' },
      ...draft.content.materials.filter(item => item.blocks.some(value => value.kind === 'text')).map(item => ({ value: item.id, label: `${item.title} · ${item.id}` }))]}
      onValueChange={value => { setMaterialId(value); setBlockId(''); setQuestionIds([]); setSelectedPosition(null); setPositionPage(0); setApplyError('') }} />
    <FormSelect ariaLabel="选择原文文字块" size="3" value={blockId} disabled={!material} options={[{ value: '', label: '请选择文字块' },
      ...(material?.blocks.flatMap(item => item.kind === 'text' ? [{ value: item.id, label: `${item.id} · ${item.text.slice(0, 70)}` }] : []) ?? [])]}
      onValueChange={value => { setBlockId(value); setSelectedPosition(null); setPositionPage(0); setApplyError('') }} />
    {block?.kind === 'text' && <Text as="p" size="2" className="whitespace-pre-wrap" lang="en">{block.text}</Text>}
    <DraftText label="原文中的匹配词形（区分大小写）" value={matchedForm} onChange={value => { setMatchedForm(value); setSelectedPosition(null); setPositionPage(0); setApplyError('') }} />
    {!!matchedForm && block?.kind === 'text' && <Text size="2" color={matches.length ? 'gray' : 'red'}>{matches.length === 0 ? '原文没有完全相同的词形，请按原文输入。' : matches.length === 1 ? '原文仅出现一次，已定位。' : `原文出现 ${matches.length} 次，请明确选择位置。`}</Text>}
    {matches.length > 1 && <Flex direction="column" gap="2"><FormSelect ariaLabel="选择词形出现位置" size="3" value={start === null ? '' : String(start)}
      options={[{ value: '', label: '请选择出现位置' }, ...shownPositions.map(offset => ({ value: String(offset), label: positionLabel(offset) }))]}
      onValueChange={value => setSelectedPosition(value === '' ? null : { start: Number(value), text, matchedForm, materialId, blockId })} />
      {matches.length > 20 && <Flex gap="2" wrap="wrap" align="center"><Button size="3" variant="soft" disabled={page === 0} onClick={() => setPositionPage(page - 1)}>上一组位置</Button>
        <Text size="2">位置第 {page + 1}/{Math.ceil(matches.length / 20)} 组</Text><Button size="3" variant="soft" disabled={(page + 1) * 20 >= matches.length} onClick={() => setPositionPage(page + 1)}>下一组位置</Button></Flex>}
    </Flex>}
    <DraftText label="该处的语境含义" value={contextMeaning} onChange={setContextMeaning} />
    <FormSelect ariaLabel="词条在题目中的作用" size="3" value={role} options={[{ value: 'background', label: '背景词：记录接触' }, { value: 'key', label: '关键考点：待审核确认' }]}
      onValueChange={value => setRole(value === 'key' ? 'key' : 'background')} />
    <Flex direction="column" gap="2"><Text size="2" weight="bold">选择实际关联题目</Text>
      {!questions.length && <Text size="2" color="gray">当前材料没有关联题目，请先选择已有题组使用的材料。</Text>}
      {questions.map(question => <Text key={question.id} as="label" size="2"><Flex gap="2" align="start"><Checkbox checked={questionIds.includes(question.id)}
        onCheckedChange={checked => setQuestionIds(previous => checked === true ? [...new Set([...previous, question.id])] : previous.filter(value => value !== question.id))} />
        <span>{question.location.sectionId} Part {question.location.partNumber} · 第 {question.location.questionNumber} 题</span></Flex></Text>)}
    </Flex>
    {applyError && <Text color="red" size="2" role="alert">{applyError}</Text>}
    <Flex gap="3" wrap="wrap"><Button size="3" disabled={!word || block?.kind !== 'text' || start === null || !contextMeaning.trim() || !questionIds.length} onClick={apply}>{existing ? '更新草稿关联' : '加入草稿关联'}</Button>
      <Button size="3" variant="soft" onClick={onCancel}>{existing ? '取消编辑' : '清空候选输入'}</Button></Flex>
  </Flex></StickerCard>
}

export function VocabularyFields({ draft, onChange }: Props) {
  const { user } = useAuth()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)
  const [notice, setNotice] = useState('')
  const existing = draft.content.vocabularyLinks.find(link => link.id === editingId)
  const reset = () => { setEditingId(null); setGeneration(value => value + 1) }
  const updateLinks = (links: readonly VocabularyLink[]) => onChange({ ...draft, content: { ...draft.content, vocabularyLinks: links } })
  return <Flex direction="column" gap="5">
    <Text as="p">词条必须来自现有词库。保存时会核对词条 ID 和来源快照；同名单词不会自动替换。</Text>
    {draft.content.vocabularyLinks.length === 0 && <Flex direction="column" gap="2"><Text as="p" color="gray">尚未建立词条关联。可在内容包中加入候选，保存后再审核。</Text>
      <Text as="p" size="2" color="gray">当前源内容包未预填真实词条 ID，请在下方从现有词库选择实际词条建立关联。</Text></Flex>}
    {user && <LinkEditor key={`${user.id}:${draft.content.id}:${editingId ?? 'new'}:${generation}`} draft={draft} existing={existing} userId={user.id}
      onApply={link => { updateLinks(existing ? draft.content.vocabularyLinks.map(item => item.id === existing.id ? link : item) : [...draft.content.vocabularyLinks, link]); reset(); setNotice('词条关联已更新到本地草稿，仍需保存整份草稿。') }}
      onCancel={() => { reset(); setNotice('') }} />}
    {notice && <Text size="2" role="status">{notice}</Text>}
    {draft.content.vocabularyLinks.map(link => <StickerCard key={link.id} as="article" elevation="flat"><Flex direction="column" gap="3">
      <Flex gap="2" wrap="wrap"><Text weight="bold">{link.sourceSnapshot.word} · {link.sourceSnapshot.stage}</Text><Badge variant="soft" radius="full">{link.role === 'key' ? '关键考点候选' : '背景词'}</Badge><Badge variant="soft" radius="full">{link.review.status === 'blocked' ? '待修正' : '待审核'}</Badge></Flex>
      <Text size="2" color="gray" className="break-all">词条 ID：{link.wordEntryId} · {link.sourceSnapshot.unit} / {link.sourceSnapshot.lesson}</Text>
      <Text as="p" size="2" className="whitespace-pre-wrap">{link.sentence}</Text>
      <Text size="2">匹配词形：{link.matchedForm}；语境含义：{link.contextMeaning}；关联 {link.questionIds.length} 题。</Text>
      <Flex gap="3" wrap="wrap"><Button size="3" variant="soft" onClick={() => { setEditingId(link.id); setNotice('') }}>编辑关联</Button>
        <Button size="3" variant="soft" color="red" onClick={() => { updateLinks(draft.content.vocabularyLinks.filter(item => item.id !== link.id)); if (editingId === link.id) reset(); setNotice('候选已从本地草稿移除，仍需保存整份草稿。') }}>移除候选</Button></Flex>
    </Flex></StickerCard>)}
  </Flex>
}
