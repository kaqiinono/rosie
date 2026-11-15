'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FlowCheckboxCards, FlowRadioCards, LoadingOverlay, StickerCard } from '@rosie/ui'
import { Badge, Button, CheckboxCards, Flex, Heading, RadioCards, Text } from '@rosie/ui/themes'
import type { PracticeEntry, PracticeEntryRow } from '@rosie/tasks'
import EnglishPlanPicker from './EnglishPlanPicker'
import { LessonResourceLine, SelectionLessonList } from './LessonResourceTags'
import { loadScopeCatalog, sameCatalogItem, scopeNodes, type LearningMode, type ScopeNode } from './scopeCatalog'
import { generateCatalogRows, type Catalog } from './catalog'

function mergeChildren(parents: ScopeNode[]): ScopeNode[] {
  const combined = new Map<string, ScopeNode>()
  for (const parent of parents) for (const child of parent.children) {
    const previous = combined.get(child.id)
    combined.set(child.id, previous ? { ...previous, rowIds: [...previous.rowIds, ...child.rowIds] } : { ...child, rowIds: [...child.rowIds] })
  }
  return [...combined.values()]
}

function choiceLevels(roots: ScopeNode[], subject: 'math' | 'chinese' | 'english'): string[] {
  const levels: string[] = []
  let nodes = roots
  for (let index = 0; nodes.length && index < 6; index++) {
    levels.push(nodes[0].level)
    const branch = (subject === 'math' && index === 1) || (subject === 'english' && nodes[0].level === '单元')
    nodes = branch ? nodes.flatMap(node => node.children) : nodes[0].children
  }
  return levels
}

function StepTrail({ steps, depth, labels, canJump, onJump }: { steps: string[]; depth: number; labels: string[]; canJump: boolean[]; onJump: (index: number) => void }) {
  const arrow = 8
  const seam = 2
  return <Flex align="center" gap="0" role="list" aria-label="选择步骤">
    {steps.map((level, index) => {
      const done = index < depth
      const current = index === depth
      const fullLabel = labels[index] || level
      const lecture = /^第\s*(\d+)\s*讲/.exec(fullLabel)
      const label = lecture ? `第${lecture[1]}讲` : fullLabel
      const last = index === steps.length - 1
      const jump = Boolean(canJump[index]) && !current
      // 左边缺口和右边尖角都朝右，上一段的尖角嵌进下一段，中间留 seam 像素。
      const clipPath = index === 0
        ? `polygon(0 0, calc(100% - ${arrow}px) 0, 100% 50%, calc(100% - ${arrow}px) 100%, 0 100%)`
        : last
          ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${arrow}px 50%)`
          : `polygon(0 0, calc(100% - ${arrow}px) 0, 100% 50%, calc(100% - ${arrow}px) 100%, 0 100%, ${arrow}px 50%)`
      const tone = current
        ? 'bg-[var(--accent-9)] text-[var(--accent-contrast)]'
        : done || jump
          ? 'bg-[var(--accent-4)] text-[var(--accent-11)]'
          : 'bg-[var(--gray-4)] text-[var(--gray-11)]'
      const shape = { clipPath, paddingLeft: index === 0 ? 8 : arrow + 6, paddingRight: last ? 8 : arrow + 6 }
      const described = `第 ${index + 1} 步 ${fullLabel}${current ? '，当前' : jump ? '，点击进入' : ''}`
      return <Flex key={`${index}-${level}`} role="listitem" flexGrow="1" flexBasis="0" minWidth="0" style={index === 0 ? undefined : { marginLeft: -(arrow - seam) }}>
        {/* native-ok: 步骤条是嵌套箭头，不是标准按钮外形 */}
        {jump ? <button type="button" className={`flex h-6 w-full min-w-0 cursor-pointer items-center justify-center border-0 text-xs font-bold ${tone}`} style={shape} aria-label={described} onClick={() => onJump(index)}>
          <span className="min-w-0 truncate">{label}</span>
        </button> : <span className={`flex h-6 w-full min-w-0 items-center justify-center text-xs font-bold ${tone}`} style={shape} aria-current={current ? 'step' : undefined} aria-label={described}>
          <span className="min-w-0 truncate">{label}</span>
        </span>}
      </Flex>
    })}
  </Flex>
}

type Props = {
  subject: 'math' | 'chinese' | 'english'
  path: string
  rows: PracticeEntryRow[]
  footerHost: HTMLDivElement | null
  onChange: (change: Pick<PracticeEntry, 'path' | 'rows'> & { name?: string }) => void
  onBusyChange: (busy: boolean) => void
  onListVisibleChange: (visible: boolean) => void
  onPhaseChange?: (phase: 'choose' | 'review' | 'decide' | 'added') => void
  /** 新增入口写「生成清单」，编辑已有入口写「重新生成清单」。 */
  isNew?: boolean
  name: string
  disabled?: boolean
}

export default function ScopeContentBuilder({ subject, path, rows, name, footerHost, disabled = false, onChange, onBusyChange, onListVisibleChange, onPhaseChange, isNew = false }: Props) {
  const [source, setSource] = useState<'reading' | 'listening' | 'plan'>(() => rows.some(row => row.values.contentType === 'english-plan') ? 'plan' : rows.some(row => row.values.sentenceId) ? 'listening' : 'reading')
  const mode: LearningMode = source === 'listening' ? 'listening' : 'reading'
  const [planDraft, setPlanDraft] = useState<{ path: string; rows: PracticeEntryRow[]; name: string } | null>(null)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [choices, setChoices] = useState<string[]>([])
  const [depth, setDepth] = useState(0)
  const [lessonChoices, setLessonChoices] = useState<string[]>([])
  const [unitChoices, setUnitChoices] = useState<string[]>([])
  const [leaves, setLeaves] = useState<string[]>([])
  const [phase, setPhase] = useState<'choose' | 'review' | 'decide' | 'added'>(() => rows.some(row => row.values.contentType === 'english-plan') ? 'added' : 'choose')
  const [returnPhase, setReturnPhase] = useState<'choose' | 'review'>('choose')
  const [writing, setWriting] = useState<'replace' | null>(null)
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [notice, setNotice] = useState('')
  const [restoredScope, setRestoredScope] = useState('')
  const initialRows = useRef(rows)
  const restored = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const lessonListRef = useRef<HTMLDivElement>(null)
  const generation = useRef(0)
  const latest = useRef({ rows, path, name, onChange, onBusyChange })
  latest.current = { rows, path, name, onChange, onBusyChange }

  useEffect(() => {
    if (source === 'plan') {
      setLoading(false); setError(''); setCatalog(null); latest.current.onBusyChange(false)
      return
    }
    let cancelled = false
    setLoading(true); setError(''); setCatalog(null)
    latest.current.onBusyChange(true)
    void loadScopeCatalog(subject, mode).then(value => { if (!cancelled) setCatalog(value) })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : '课程目录读取失败') })
      .finally(() => { if (!cancelled) { setLoading(false); latest.current.onBusyChange(false) } })
    return () => { cancelled = true; generation.current++; latest.current.onBusyChange(false) }
  }, [subject, source, mode, attempt])
  useEffect(() => { heading.current?.focus() }, [depth, phase])
  useEffect(() => { onListVisibleChange(phase === 'added') }, [phase, onListVisibleChange])
  useEffect(() => { onPhaseChange?.(phase) }, [phase, onPhaseChange])

  const roots = useMemo(() => catalog ? scopeNodes(catalog.groups.flatMap(group => group.rows)) : [], [catalog])
  useEffect(() => {
    if (!catalog || restored.current) return
    restored.current = true
    const saved = initialRows.current
    if (!saved.length) return
    const matched = catalog.groups.flatMap(group => group.rows).filter(row => saved.some(item => sameCatalogItem(item, row)))
    const ids = new Set(matched.map(row => row.id))
    const hasSaved = (node: ScopeNode) => node.rowIds.some(id => ids.has(id))
    const complete = (node: ScopeNode) => node.rowIds.every(id => ids.has(id))
    const restoredChoices: string[] = []
    let current = roots
    let step = 0
    let partial = matched.length !== saved.length
    while (current.length) {
      const selectedNodes = current.filter(hasSaved)
      if (!selectedNodes.length) break
      if (subject === 'math' && step === 1) {
        setLessonChoices(selectedNodes.map(node => node.id))
        const values = mergeChildren(selectedNodes)
        setLeaves(values.filter(complete).map(node => node.id))
        partial ||= values.some(node => hasSaved(node) && !complete(node))
        step++
        break
      }
      if (subject === 'english' && current[0]?.level === '单元') {
        setUnitChoices(selectedNodes.map(node => node.id))
        const lessons = mergeChildren(selectedNodes)
        setLeaves(lessons.filter(complete).map(node => node.id))
        partial ||= lessons.some(node => hasSaved(node) && !complete(node))
        break
      }
      if (current.every(node => !node.children.length)) {
        setLeaves(selectedNodes.filter(complete).map(node => node.id))
        partial ||= selectedNodes.some(node => !complete(node))
        break
      }
      if (selectedNodes.length !== 1) { partial = true; break }
      restoredChoices.push(selectedNodes[0].id)
      current = selectedNodes[0].children
      step++
    }
    setChoices(restoredChoices)
    setDepth(0)
    setRestoredScope(partial ? `已保留 ${saved.length} 项原内容，并回显可匹配范围。跨范围或部分删减的内容不会自动扩选；仅在写入时更新清单。` : '已恢复上次保存的课程范围，可直接修改或保存。')
  }, [catalog, roots, subject])

  let nodes = roots
  const trail: string[] = []
  for (let i = 0; i < depth; i++) {
    if (subject === 'math' && i === 1) {
      const lessons = nodes.filter(node => lessonChoices.includes(node.id))
      trail.push(lessons.length === 1 ? lessons[0].label : `已选 ${lessons.length} 讲`)
      nodes = mergeChildren(lessons)
      continue
    }
    if (subject === 'english' && nodes[0]?.level === '单元') {
      const units = nodes.filter(node => unitChoices.includes(node.id))
      trail.push(units.length === 1 ? units[0].label : `已选 ${units.length} 个单元`)
      nodes = mergeChildren(units)
      continue
    }
    const parent = nodes.find(node => node.id === choices[i])
    if (!parent) break
    trail.push(parent.label)
    nodes = parent.children
  }
  const options = [...nodes].sort((a, b) => b.label.localeCompare(a.label, 'zh-CN', { numeric: true }))
  const terminal = options.length > 0 && options.every(node => !node.children.length)
  const lessonMulti = subject === 'math' && depth === 1
  const unitMulti = subject === 'english' && options[0]?.level === '单元' && options.some(node => node.children.length)
  const multi = terminal || lessonMulti || unitMulti
  const checked = lessonMulti ? lessonChoices : unitMulti ? unitChoices : leaves
  const setChecked = (ids: string[]) => {
    if (lessonMulti) { setLessonChoices(ids); setLeaves([]) }
    else if (unitMulti) { setUnitChoices(ids); setLeaves([]) }
    else setLeaves(ids)
  }
  const selected = nodes.find(node => node.id === choices[depth])
  const selectedLeaves = nodes.filter(node => leaves.includes(node.id))
  const level = options[0]?.level ?? '课程'
  const question = source === 'plan' && phase === 'choose' ? '选择哪个英语计划？' : level === '年级' ? '你学几年级？' : level === '教材' ? '选择哪一本书？' : level === '题目类型' ? '这次学什么？' : unitMulti ? '选择哪些单元？（可多选）' : level === '单元' ? '选择哪个单元？' : subject === 'english' && terminal ? '选择哪些课？（可多选）' : lessonMulti ? '选择要学的课程（可多选）' : '选择哪一课？'
  const allRows = catalog?.groups.flatMap(group => group.rows) ?? []
  const selectedUnitIds = new Set(mergeChildren(unitMulti ? nodes.filter(node => unitChoices.includes(node.id)) : []).flatMap(node => node.rowIds))
  const selectedUnitRows = allRows.filter(row => selectedUnitIds.has(row.id))
  const selectedUnitKey = selectedUnitRows.map(row => row.id).join('\n')
  useEffect(() => {
    if (!unitMulti || !selectedUnitKey) return
    lessonListRef.current?.scrollIntoView({ block: 'nearest' })
  }, [unitMulti, selectedUnitKey])
  const pending = allRows.filter(row => pendingIds.includes(row.id))
  const incompatible = rows.length > 0 && !!catalog && path !== catalog.path
  const groups = useMemo(() => {
    const result = new Map<string, { label: string; ids: string[] }>()
    for (const row of rows) {
      const label = row.selectionPath?.map(node => node.label).join(' · ') || row.label
      const group = result.get(label) ?? { label, ids: [] }
      group.ids.push(row.id); result.set(label, group)
    }
    return [...result.values()]
  }, [rows])

  function review(ids: string[], label: string) {
    setPendingIds(ids); setSummary(label); setError(''); setPhase('review')
  }
  function next() {
    if (terminal) {
      const ids = selectedLeaves.flatMap(node => node.rowIds)
      const label = [...trail, selectedLeaves.map(node => node.label).join('、')].join(' · ')
      void add(allRows.filter(row => ids.includes(row.id)), label)
    } else if (unitMulti && unitChoices.length) {
      keepSelectedLessons()
      setDepth(depth + 1)
    } else if (lessonMulti && lessonChoices.length) {
      setDepth(depth + 1)
    } else if (selected) {
      setDepth(depth + 1)
    }
  }
  function restart() {
    setRestoredScope(''); setPlanDraft(null); setPhase('choose'); setDepth(0); setChoices([]); setLessonChoices([]); setUnitChoices([]); setLeaves([]); setPendingIds([]); setError('')
  }
  function commitPlan(next: { path: string; rows: PracticeEntryRow[]; name: string }) {
    const previous = latest.current.rows
    const same = previous.length === next.rows.length && next.rows.every((row) => previous.some((item) => item.id === row.id)) && latest.current.path === next.path
    if (previous.length > 0 && !same) {
      setPlanDraft(next); setError(''); setPhase('decide')
      return
    }
    latest.current.onChange({ path: next.path, rows: next.rows, ...(!latest.current.name.trim() ? { name: next.name } : {}) })
    setPlanDraft(null)
    setNotice(next.rows.length ? '已按计划日期排好清单，作业会一天一天自动推进。' : '')
    if (next.rows.length) setPhase('added')
  }
  function lessonsForSelectedUnits(): ScopeNode[] {
    let cursor = roots
    if (cursor[0]?.level !== '单元') cursor = cursor.find(node => node.id === choices[0])?.children ?? []
    return mergeChildren(cursor.filter(node => node.level === '单元' && unitChoices.includes(node.id)))
  }
  function keepSelectedLessons() {
    const lessons = lessonsForSelectedUnits()
    const lessonIds = new Set(lessons.map(node => node.id))
    setLeaves(current => {
      const kept = current.filter(id => lessonIds.has(id))
      return kept.length ? kept : lessons.map(node => node.id)
    })
  }
  async function add(items = pending, label = summary, listMode?: 'replace') {
    if (!catalog || !items.length || generating) return
    const previous = latest.current.rows
    if (previous.length > 0 && !listMode) {
      const sameIds = items.length === previous.length && items.every(row => previous.some(item => item.id === row.id))
      setPendingIds(items.map(row => row.id)); setSummary(label); setError('')
      if (sameIds && path === catalog.path) {
        setNotice('')
        setPhase('added')
        return
      }
      setNotice(''); setReturnPhase(phase === 'review' ? 'review' : 'choose'); setPhase('decide')
      return
    }
    const token = ++generation.current
    const replace = listMode === 'replace'
    setGenerating(true); setWriting(listMode ?? null); setError(''); latest.current.onBusyChange(true)
    const existing = new Map(previous.map(row => [row.id, row]))
    const additions = items.filter(row => !existing.has(row.id))
    try {
      let resolved: PracticeEntryRow[]
      try { resolved = await generateCatalogRows(catalog, additions) }
      catch (cause) {
        const message = cause instanceof Error ? cause.message : '资源读取失败，请在清单中重试'
        resolved = additions.map(row => ({ ...row, resourceStatus: 'error', resourceError: message }))
      }
      if (token !== generation.current) return
      // Replace drops old list rows. Rows still in the new selection keep their saved resources.
      const selectedIds = new Set(items.map(row => row.id))
      const kept = replace ? previous.filter(row => selectedIds.has(row.id)) : previous
      const merged = [...kept, ...resolved]
      latest.current.onChange({ path: catalog.path, rows: merged, ...(!latest.current.name.trim() ? { name: label.slice(0, 120) } : {}) })
      const failed = resolved.filter(row => row.resourceStatus === 'error').length
      const outcome = replace ? `已删除旧清单，留下这次的 ${merged.length} 项` : additions.length ? `已加入 ${additions.length} 项` : '这些内容已经在清单中'
      setNotice(`${outcome}${failed ? `，其中 ${failed} 项资源未读取成功，可在清单中重试。` : kept.length && additions.length ? '，保留原有顺序，新内容按课程顺序追加。' : !kept.length && additions.length ? '，将按课程顺序学习。' : '。'}`)
      setPhase('added')
    } finally {
      if (token === generation.current) { setGenerating(false); setWriting(null); latest.current.onBusyChange(false) }
    }
  }

  const spread = !(subject === 'english' && terminal) && (level === '课程' || options.length <= 4)
  const choiceNodes = subject === 'english' && terminal ? nodes : options
  const catalogSteps = choiceLevels(roots, subject)
  const steps = catalogSteps.length ? [...catalogSteps, '清单'] : []
  const stepLabels = (() => {
    let cursor = roots
    const labels: string[] = []
    for (let i = 0; i < catalogSteps.length && cursor.length; i++) {
      if (subject === 'math' && i === 1) {
        const lessons = cursor.filter(node => lessonChoices.includes(node.id))
        if (!lessons.length) break
        labels.push(lessons.length === 1 ? lessons[0].label : `已选 ${lessons.length} 讲`)
        cursor = mergeChildren(lessons)
        continue
      }
      if (subject === 'english' && cursor[0]?.level === '单元') {
        const units = cursor.filter(node => unitChoices.includes(node.id))
        if (!units.length) break
        labels.push(units.length === 1 ? units[0].label : `已选 ${units.length} 个单元`)
        cursor = mergeChildren(units)
        continue
      }
      if (cursor.every(node => !node.children.length)) {
        const picked = cursor.filter(node => leaves.includes(node.id))
        if (!picked.length) break
        labels.push(picked.length === 1 ? picked[0].label : `已选 ${picked.length} 项`)
        break
      }
      const parent = cursor.find(node => node.id === choices[i])
      if (!parent) break
      labels.push(parent.label)
      cursor = parent.children
    }
    return labels
  })()
  const stepReachable = (index: number) => {
    if (index <= 0) return true
    if (index === steps.length - 1) return rows.length > 0 || phase === 'added'
    if (phase === 'choose' && index <= depth) return true
    if (phase === 'added') return true
    if (subject === 'math' && index === 1) return Boolean(choices[0])
    if (subject === 'math' && index === 2) return lessonChoices.length > 0
    if (subject === 'english' && steps[index] === '单元') return Boolean(choices[0])
    if (subject === 'english' && steps[index] === '课程') return unitChoices.length > 0
    return Boolean(choices[index - 1])
  }
  function goToStep(index: number) {
    if (disabled || loading || generating || !stepReachable(index)) return
    const here = phase === 'added' ? steps.length - 1 : phase === 'choose' ? depth : -1
    if (index === here) return
    setNotice('')
    if (index === steps.length - 1) { setPhase('added'); return }
    if (subject === 'english' && steps[index] === '课程') keepSelectedLessons()
    setPhase('choose')
    setDepth(index)
  }
  const selectionUnchanged = pending.length === rows.length && pending.every(row => rows.some(item => item.id === row.id)) && !incompatible
  const planChoosing = source === 'plan' && phase === 'choose'
  const actions = <fieldset disabled={disabled} className="contents"><Flex gap="2" align="stretch" wrap="wrap" width="100%" flexGrow="1" minWidth="0">
    {planChoosing ? null : phase === 'choose' ? <>
      {depth > 0 && <Button size="3" variant="soft" disabled={loading || generating} onClick={() => setDepth(depth - 1)}>上一步</Button>}
      <Flex flexGrow="1" minWidth="0"><Button size="3" className="w-full" disabled={loading || generating || (multi ? !checked.length : !selected)} loading={generating} onClick={next}>{terminal ? (isNew ? '生成清单' : '重新生成清单') : '下一步'}</Button></Flex>
    </> : phase === 'review' ? <>
      <Button size="3" variant="soft" disabled={generating} onClick={() => setPhase('choose')}>返回修改</Button>
      <Flex flexGrow="1" minWidth="0"><Button size="3" className="w-full" loading={generating} disabled={!pending.length} onClick={() => void add()}>{rows.length ? '确认清单' : `加入清单 · ${pending.length}项`}</Button></Flex>
    </> : phase === 'decide' && planDraft ? <>
      <Button size="3" variant="soft" onClick={() => { setPlanDraft(null); setPhase('choose') }}>返回修改</Button>
      <Flex flexGrow="1" minWidth="0"><Button size="3" className="w-full" variant="soft" color="red" onClick={() => {
        latest.current.onChange({ path: planDraft.path, rows: planDraft.rows, ...(!latest.current.name.trim() ? { name: planDraft.name } : {}) })
        setNotice(planDraft.rows.length ? '已删除旧清单，并按计划日期重新排列。作业会一天一天自动推进。' : '')
        const stay = planDraft.rows.length > 0
        setPlanDraft(null)
        setPhase(stay ? 'added' : 'choose')
      }}>删除旧清单</Button></Flex>
    </> : phase === 'decide' ? <>
      <Button size="3" variant="soft" disabled={generating} onClick={() => setPhase(returnPhase)}>返回修改</Button>
      {!selectionUnchanged && <Flex flexGrow="1" minWidth="0"><Button size="3" className="w-full" variant="soft" color="red" loading={writing === 'replace'} disabled={generating} onClick={() => void add(pending, summary, 'replace')}>删除旧清单</Button></Flex>}
    </> : <>
      {source !== 'plan' && <Button size="3" variant="soft" onClick={() => { setNotice(''); setPhase('choose') }}>上一步</Button>}
      <Flex flexGrow="1" minWidth="0"><Button size="3" variant="soft" className="w-full" onClick={restart}>{source === 'plan' ? '重新选择计划' : '继续添加课程'}</Button></Flex>
    </>}
  </Flex></fieldset>

  const choosing = phase === 'choose'
  return <Flex direction="column" gap="4" flexGrow={choosing ? '1' : undefined} minHeight={choosing ? '0' : undefined}>
    {phase === 'choose' && subject === 'english' && depth === 0 && <FlowRadioCards layout="equal" aria-label="学习方式" value={source === 'plan' ? 'plan' : mode} onValueChange={value => { setSource(value as 'reading' | 'listening' | 'plan'); setChoices([]); setUnitChoices([]); setLeaves([]); setPlanDraft(null) }}>
      <RadioCards.Item value="reading"><Text weight="bold">阅读课文</Text></RadioCards.Item>
      <RadioCards.Item value="listening"><Text weight="bold">逐句听记</Text></RadioCards.Item>
      <RadioCards.Item value="plan"><Text weight="bold">英语计划</Text></RadioCards.Item>
    </FlowRadioCards>}
    <Flex direction="column" gap="3" flexShrink="0">
      {phase === 'choose' || phase === 'added' ? (source === 'plan' ? null : steps.length > 0 ? <StepTrail steps={steps} depth={phase === 'added' ? steps.length - 1 : depth} labels={stepLabels} canJump={steps.map((_, index) => stepReachable(index))} onJump={goToStep} /> : <Text size="2" color="gray">第 {depth + 1} 步</Text>) : <Text size="2" color="gray">{phase === 'review' ? '确认这组内容' : '这次选择和旧清单不同'}</Text>}
      <Flex justify="between" align="center" gap="3">
        <Heading ref={heading} tabIndex={-1} as="h3" size="5">{phase === 'choose' ? question : phase === 'review' ? summary : phase === 'decide' ? '要删除旧清单吗？' : '检查并修改清单'}</Heading>
        {phase === 'choose' && !loading && multi && choiceNodes.length > 1 && <Flex flexShrink="0">
          <Button size="2" variant="soft" onClick={() => setChecked(checked.length === choiceNodes.length ? [] : choiceNodes.map(node => node.id))}>{checked.length === choiceNodes.length ? '取消全选' : '选择全部'}</Button>
        </Flex>}
      </Flex>
    </Flex>
    {phase === 'choose' ? <StickerCard as="section" tone="paper" variant="soft" size="sm" radius="md" elevation="flat" aria-label="选项列表" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      {source === 'plan' ? <EnglishPlanPicker disabled={disabled} onCommit={commitPlan} /> : loading ? <Flex direction="column" minHeight="240px"><LoadingOverlay visible placement="content" /></Flex> : <>
      {!options.length && !error && <Text>暂时没有可选课程。</Text>}
      {multi ? <FlowCheckboxCards layout={spread ? 'equal' : 'flow'} aria-label={question} value={checked} onValueChange={setChecked}>
        {choiceNodes.map(node => {
          const nodeRows = allRows.filter(row => node.rowIds.includes(row.id))
          const course = nodeRows[0]?.selectionPath?.find(part => part.level === '课程')?.label
          const unit = nodeRows[0]?.selectionPath?.find(part => part.level === '单元')?.label
          const label = subject === 'english' && terminal && unit && course ? `${unit} · ${course}` : node.label
          return <CheckboxCards.Item key={node.id} value={node.id}><Flex direction="column" gap="1" minWidth="0"><Text size="3" weight="bold" wrap="wrap">{label}</Text>{subject === 'english' && terminal ? <LessonResourceLine rows={nodeRows} /> : <Text size="2" color="gray">{unitMulti ? `${node.children.length} 课` : `${node.rowIds.length} 项内容`}</Text>}</Flex></CheckboxCards.Item>
        })}
      </FlowCheckboxCards> : <FlowRadioCards layout={spread ? 'equal' : 'flow'} aria-label={question} value={choices[depth] ?? ''} onValueChange={value => {
        if (choices[depth] !== value) { setChoices([...choices.slice(0, depth), value]); setLessonChoices([]); setUnitChoices([]); setLeaves([]) }
      }}>
        {options.map(node => <RadioCards.Item key={node.id} value={node.id}><Flex direction="column" gap="1" minWidth="0"><Text size="3" weight="bold" wrap="wrap">{node.label}</Text><Text size="2" color="gray">{node.children.length} 个{node.children[0]?.level ?? '选项'}</Text></Flex></RadioCards.Item>)}
      </FlowRadioCards>}
      {unitMulti && !!selectedUnitRows.length && <div ref={lessonListRef}><Flex direction="column" gap="3">
        <Text size="2" weight="bold">这些单元的课文</Text>
        <SelectionLessonList rows={selectedUnitRows} />
      </Flex></div>}
      {selected && subject !== 'math' && !unitMulti && depth > 0 && <Button size="3" variant="soft" onClick={() => review(selected.rowIds, [...trail, selected.label].join(' · '))}>{level === '教材' ? '整本书加入' : level === '单元' ? '整个单元加入' : '全部加入'}</Button>}
      </>}
    </StickerCard> : loading ? <Flex direction="column" minHeight="240px"><LoadingOverlay visible placement="content" /></Flex> : phase === 'decide' && planDraft ? <StickerCard tone="paper" size="md" elevation="flat"><Flex direction="column" gap="3">
      <Text size="5" weight="bold">{planDraft.rows.length ? `旧清单 ${rows.length} 项，这次 ${planDraft.rows.length} 项` : `旧清单 ${rows.length} 项`}</Text>
      <Text>{planDraft.rows.length ? '删除会去掉原来的清单，只留下这次计划。作业会按日期一天一天自动推进。' : '删除会去掉原来的清单。自适应计划没有题目清单，打开作业就直接进入练习。'}</Text>
      {!!planDraft.rows.length && <SelectionLessonList rows={planDraft.rows} />}
    </Flex></StickerCard> : phase === 'review' ? <StickerCard tone="paper" size="md" elevation="flat"><Flex direction="column" gap="3">
      <Text size="5" weight="bold">共 {pending.length} 项内容</Text>
      <Text>从「{pending[0]?.label}」开始，按课程顺序自动推进。</Text>
      <Text size="2" color="gray">{rows.length ? `当前清单已有 ${rows.length} 项。和这次选择不同时，可以删除旧清单，只留下这次的内容。` : '点击“加入清单”后读取音视频资源，已加入的内容不会重复添加。'}</Text>
      {!!pending.length && <SelectionLessonList rows={pending} />}
      {incompatible && <Text color="red">这次选择的详情地址和旧清单不同。删除旧清单后会换成这次的内容。</Text>}
      {generating && <Text role="status">正在读取这组内容的资源…</Text>}
    </Flex></StickerCard> : phase === 'decide' ? <StickerCard tone="paper" size="md" elevation="flat"><Flex direction="column" gap="3">
      <Text size="5" weight="bold">旧清单 {rows.length} 项，这次 {pending.length} 项</Text>
      <Text>删除会去掉原来的清单，只留下这次选择。不删除的话，当前清单保持不变，可以直接保存。</Text>
      {!!pending.length && <SelectionLessonList rows={pending} />}
      {incompatible && <Text color="red">这次选择的详情地址和旧清单不同。删除旧清单后会换成这次的内容。</Text>}
      {generating && <Text role="status">正在写入清单…</Text>}
    </Flex></StickerCard> : <Flex direction="column" gap="2"><Text size="2" color="gray">可以调整顺序、名称和资源。确认后保存清单。</Text>{notice && <Text role="status">{notice}</Text>}</Flex>}
    {error && <Flex direction="column" gap="2"><Text role="alert" color="red">{error}</Text><Button variant="soft" onClick={() => setAttempt(value => value + 1)}>重新读取课程</Button></Flex>}
    {footerHost ? createPortal(actions, footerHost) : actions}
    {phase === 'added' && !!groups.length && <StickerCard size="sm" tone="paper" elevation="flat"><Flex direction="column" gap="3">
      <Flex justify="between" align="center"><Text weight="bold">已选课程</Text><Badge>{rows.length} 项</Badge></Flex>
      <Flex direction="column" gap="3" className="max-h-64 overflow-y-auto" aria-label="已选课程">
        {groups.map(group => <Flex key={group.label} align="center" justify="between" gap="3"><Text size="2">{group.label} · {group.ids.length}项</Text><Button size="2" variant="soft" color="gray" aria-label={`移除${group.label}`} disabled={generating || loading} onClick={() => onChange({ path, rows: rows.filter(row => !group.ids.includes(row.id)) })}>移除</Button></Flex>)}
      </Flex>
    </Flex></StickerCard>}
  </Flex>
}
