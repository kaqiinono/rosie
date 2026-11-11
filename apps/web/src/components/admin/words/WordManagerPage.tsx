'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { LoadingOverlay, StickerCard } from '@rosie/ui'
import {
  Box,
  Button,
  Card,
  Flex,
  Heading,
  IconButton,
  Select,
  Table,
  Text,
  TextField,
  Theme,
} from '@rosie/ui/themes'
import type { User } from '@supabase/supabase-js'
import type { WordEntry } from '@rosie/core'
import { useWordData } from '@rosie/english'
import { STORAGE_KEYS } from '@rosie/core'
import WordFormModal from './WordFormModal'
import WordPreviewModal from './WordPreviewModal'
import BatchAddModal from './BatchAddModal'
import NewStageModal from './NewStageModal'
import { withDraftEntry, type StageTree, type StageUnit } from './types'

type Props = { user: User | null }

type FilterSelectProps = {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}

function FilterSelect({ label, options, value, onChange }: FilterSelectProps) {
  // Radix reserves the empty string. Prefix every value, including the unfiltered choice.
  const prefix = 'filter:'
  return (
    <Select.Root
      value={prefix + value}
      onValueChange={(next) => onChange(next.slice(prefix.length))}
    >
      <Select.Trigger aria-label={label + '筛选'} />
      <Select.Content position="popper">
        <Select.Item value={prefix}>全部{label}</Select.Item>
        {options.filter(Boolean).map((option) => (
          <Select.Item key={option} value={prefix + option}>
            {option}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  )
}

const NO_STAGE = ''
const NO_STAGE_LABEL = '（无词库）'

type FormState = null | { mode: 'new' } | { mode: 'edit'; word: WordEntry }

// 「草稿词库」= 新建但还没写入单词的 stage（含其 unit/lesson 结构）。数据库无 stages 表，
// stage 靠单词行存在，所以空词库结构持久化到 localStorage，按 user.id 分 key，避免刷新后消失。
function draftKey(userId?: string) {
  return `${STORAGE_KEYS.ADMIN_DRAFT_STAGES}:${userId ?? 'anon'}`
}
function readDraftStages(userId?: string): StageTree[] {
  try {
    const j = localStorage.getItem(draftKey(userId))
    if (!j) return []
    const raw: unknown = JSON.parse(j)
    if (!Array.isArray(raw)) return []
    const out: StageTree[] = []
    for (const item of raw as unknown[]) {
      // 兼容旧格式（string[]）
      if (typeof item === 'string') {
        if (item) out.push({ stage: item, units: [] })
        continue
      }
      if (item && typeof item === 'object') {
        const obj = item as { stage?: unknown; units?: unknown }
        const stage = typeof obj.stage === 'string' ? obj.stage : ''
        if (!stage) continue
        const units: StageUnit[] = []
        if (Array.isArray(obj.units)) {
          for (const u of obj.units as unknown[]) {
            if (u && typeof u === 'object') {
              const uo = u as { unit?: unknown; lessons?: unknown }
              const unit = typeof uo.unit === 'string' ? uo.unit : ''
              if (!unit) continue
              const lessons = Array.isArray(uo.lessons)
                ? (uo.lessons as unknown[]).filter((l): l is string => typeof l === 'string')
                : []
              units.push({ unit, lessons })
            }
          }
        }
        out.push({ stage, units })
      }
    }
    return out
  } catch {
    return []
  }
}
function writeDraftStages(userId: string | undefined, list: StageTree[]) {
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export default function WordManagerPage({ user }: Props) {
  const { vocab, isLoading, error, addWords, updateWord, deleteWord, deleteStage, renameStage } =
    useWordData(user)

  const [activeStage, setActiveStage] = useState<string | null>(null)
  const [draftStages, setDraftStagesState] = useState<StageTree[]>(() => readDraftStages(user?.id))
  const [selUnit, setSelUnit] = useState('')
  const [selLesson, setSelLesson] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormState>(null)
  const [previewWord, setPreviewWord] = useState<WordEntry | null>(null)
  const [newStageOpen, setNewStageOpen] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const persistDrafts = (next: StageTree[]) => {
    setDraftStagesState(next)
    writeDraftStages(user?.id, next)
  }

  const triggerFlash = (msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 1800)
  }

  // —— 合并 vocab + 草稿 的 stage→unit→lesson 结构树（级联选项的唯一真相）——
  const tree = useMemo<StageTree[]>(() => {
    const map = new Map<string, Map<string, Set<string>>>()
    const ensure = (s: string, u: string) => {
      let um = map.get(s)
      if (!um) {
        um = new Map()
        map.set(s, um)
      }
      let ls = um.get(u)
      if (!ls) {
        ls = new Set()
        um.set(u, ls)
      }
      return ls
    }
    for (const w of vocab) ensure(w.stage ?? NO_STAGE, w.unit).add(w.lesson)
    for (const d of draftStages) {
      if (!map.has(d.stage)) map.set(d.stage, new Map())
      for (const u of d.units) {
        const ls = ensure(d.stage, u.unit)
        for (const l of u.lessons) ls.add(l)
      }
    }
    return [...map.entries()]
      .map(([stage, um]) => ({
        stage,
        units: [...um.entries()]
          .map(([unit, lset]) => ({ unit, lessons: [...lset].sort() }))
          .sort((a, b) => a.unit.localeCompare(b.unit)),
      }))
      .sort((a, b) => a.stage.localeCompare(b.stage))
  }, [vocab, draftStages])

  // —— 词库列表 + 单词计数 ——
  const stages = useMemo(() => {
    const counts = new Map<string, number>()
    for (const w of vocab) {
      const s = w.stage ?? NO_STAGE
      counts.set(s, (counts.get(s) ?? 0) + 1)
    }
    return tree.map((t) => ({ stage: t.stage, count: counts.get(t.stage) ?? 0 }))
  }, [vocab, tree])

  // 未显式选择时，派生默认选中第一个词库（避免 effect 内 setState）
  const effectiveStage = activeStage ?? stages[0]?.stage ?? ''
  const hasStage = stages.length > 0

  const stageWords = useMemo(
    () => vocab.filter((w) => (w.stage ?? NO_STAGE) === effectiveStage),
    [vocab, effectiveStage],
  )

  // 表格筛选用的单元/课次（基于真实单词）
  const units = useMemo(() => [...new Set(stageWords.map((w) => w.unit))].sort(), [stageWords])
  const lessons = useMemo(
    () =>
      [
        ...new Set(stageWords.filter((w) => !selUnit || w.unit === selUnit).map((w) => w.lesson)),
      ].sort(),
    [stageWords, selUnit],
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return stageWords.filter((w) => {
      if (selUnit && w.unit !== selUnit) return false
      if (selLesson && w.lesson !== selLesson) return false
      if (q) {
        const hay = `${w.word} ${w.explanation ?? ''} ${w.chineseDef ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [stageWords, selUnit, selLesson, search])

  // —— 词库操作 ——
  const handleCreateStage = (stage: string, unit: string, lesson: string) => {
    persistDrafts(withDraftEntry(draftStages, stage, unit, lesson))
    setActiveStage(stage)
    setSelUnit('')
    setSelLesson('')
    setNewStageOpen(false)
    triggerFlash(`已新建词库「${stage}」，添加单词后写入云端`)
  }

  const handleRenameStage = async (stage: string) => {
    if (!stage) return
    const next = window.prompt(`重命名词库「${stage}」为：`, stage)?.trim()
    if (!next || next === stage) return
    await renameStage(stage, next)
    persistDrafts(draftStages.map((d) => (d.stage === stage ? { ...d, stage: next } : d)))
    setActiveStage(next)
    triggerFlash(`词库已重命名为「${next}」`)
  }

  const handleDeleteStage = async (stage: string) => {
    const count = stages.find((s) => s.stage === stage)?.count ?? 0
    const msg =
      count > 0
        ? `确定删除词库「${stage || NO_STAGE_LABEL}」？将永久删除其中 ${count} 个单词，无法撤销。`
        : `确定删除空词库「${stage || NO_STAGE_LABEL}」？`
    if (!window.confirm(msg)) return
    try {
      await deleteStage(stage)
      persistDrafts(draftStages.filter((d) => d.stage !== stage))
      setActiveStage(null)
      setSelUnit('')
      setSelLesson('')
      triggerFlash(`已删除词库「${stage || NO_STAGE_LABEL}」`)
    } catch {
      triggerFlash(`删除词库失败，请重试`)
    }
  }

  // 表单内联创建 stage / unit / lesson → 持久化到草稿结构，级联选项即时可见且刷新不丢
  const handleCreateStageInForm = (stage: string) =>
    persistDrafts(withDraftEntry(draftStages, stage))
  const handleCreateUnit = (stage: string, unit: string) =>
    persistDrafts(withDraftEntry(draftStages, stage, unit))
  const handleCreateLesson = (stage: string, unit: string, lesson: string) =>
    persistDrafts(withDraftEntry(draftStages, stage, unit, lesson))

  // —— 单词操作 ——
  const handleSubmitWord = async (entry: WordEntry, original?: WordEntry) => {
    if (original) {
      await updateWord(original, entry)
      triggerFlash(`已保存「${entry.word}」`)
    } else {
      await addWords([entry])
      triggerFlash(`已添加「${entry.word}」`)
    }
    setForm(null)
  }

  const handleDeleteWord = async (w: WordEntry) => {
    if (!window.confirm(`删除单词「${w.word}」（${w.unit} · ${w.lesson}）？`)) return
    const stage = w.stage
    const willEmptyStage = !!stage && stageWords.length === 1
    try {
      await deleteWord(w)
      if (willEmptyStage && stage) {
        persistDrafts(draftStages.filter((d) => d.stage !== stage))
      }
      triggerFlash(`已删除「${w.word}」`)
    } catch {
      triggerFlash(`删除「${w.word}」失败，请重试`)
    }
  }

  const handleBatchConfirm = async (words: WordEntry[]) => {
    await addWords(words)
    triggerFlash(`已添加 ${words.length} 个单词`)
  }

  const handleExportVocab = useCallback(async () => {
    if (rows.length === 0) return
    const xlsx = await import('xlsx')
    const { utils, writeFile } = xlsx.default || xlsx
    const wb = utils.book_new()
    const headers = [
      'Stage',
      'Unit',
      'Lesson',
      '单词 (word)',
      '释义 (explanation)',
      '音标 (ipa)',
      '例句 (example)',
    ]
    const data = [
      headers,
      ...rows.map((v) => [
        v.stage || '',
        v.unit,
        v.lesson,
        v.word,
        v.explanation,
        v.ipa || '',
        v.example || '',
      ]),
    ]
    const ws = utils.aoa_to_sheet(data)
    ws['!cols'] = [
      { wch: 8 },
      { wch: 10 },
      { wch: 12 },
      { wch: 22 },
      { wch: 45 },
      { wch: 18 },
      { wch: 50 },
    ]
    utils.book_append_sheet(wb, ws, '单词数据')
    writeFile(wb, 'RosieFun_词库.xlsx')
    triggerFlash(`已导出 ${rows.length} 个单词`)
  }, [rows])

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        请先登录
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: '#fff1f2' }}>
      <header
        className="sticky top-0 z-30 border-b border-amber-200/40"
        style={{ background: 'rgba(255,255,255,0.85)' }}
      >
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <Link
            href="/admin"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-700 transition hover:scale-110"
            style={{
              background: 'rgba(245,158,11,0.10)',
              border: '1.5px solid rgba(245,158,11,0.30)',
            }}
            aria-label="返回管理后台"
          >
            ←
          </Link>
          <div className="flex items-center gap-1.5 text-[17px] font-extrabold text-amber-900">
            <span aria-hidden>📚</span>
            <span>词库 · 单词管理</span>
          </div>
          {flash && (
            <div
              className="ml-auto rounded-full px-3 py-1 text-[12px] font-extrabold text-emerald-700"
              style={{
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.4)',
              }}
            >
              ✓ {flash}
            </div>
          )}
        </div>
      </header>

      <main
        className={
          isLoading
            ? 'flex flex-1 flex-col'
            : 'mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-4 px-4 py-6 pb-20 md:grid-cols-[240px_1fr]'
        }
      >
        {isLoading ? (
          <LoadingOverlay visible placement="content" />
        ) : error != null ? (
          <Box gridColumn="1 / -1">
            <Card>
              <Text as="p" align="center" size="2" color="red" role="alert">
                词库加载失败，请刷新页面重试。
              </Text>
            </Card>
          </Box>
        ) : (
          <>
            {/* 词库侧栏 */}
            <aside className="space-y-3">
              <StickerCard
                size="sm"
                elevation="sm"
                radius="md"
                style={{ border: '1.5px solid rgba(245,158,11,0.22)' }}
              >
                <div className="mb-2 text-[11px] font-extrabold tracking-[0.18em] text-amber-800/80 uppercase">
                  词库
                </div>
                <div className="space-y-1.5">
                  {stages.length === 0 && (
                    <div className="rounded-lg bg-white py-4 text-center text-[12px] text-slate-400">
                      还没有词库，新建一个
                    </div>
                  )}
                  {stages.map(({ stage, count }) => {
                    const active = stage === effectiveStage
                    return (
                      <div
                        key={stage || '__none__'}
                        className="group flex items-center gap-1 rounded-xl px-2 py-1.5 transition"
                        style={{
                          background: active ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.6)',
                          border: active
                            ? '1.5px solid rgba(245,158,11,0.45)'
                            : '1.5px solid transparent',
                        }}
                      >
                        <Button
                          type="button"
                          onClick={() => {
                            setActiveStage(stage)
                            setSelUnit('')
                            setSelLesson('')
                          }}
                          variant="ghost"
                          color="gray"
                          size="2"
                          className="flex-1"
                        >
                          <span className="text-[13px] font-extrabold text-slate-800">
                            {stage || NO_STAGE_LABEL}
                          </span>
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 tabular-nums">
                            {count}
                          </span>
                        </Button>
                        {stage !== NO_STAGE && (
                          <div className="flex shrink-0 opacity-0 transition group-hover:opacity-100">
                            <IconButton
                              type="button"
                              onClick={() => handleRenameStage(stage)}
                              title="重命名"
                              variant="ghost"
                              color="gray"
                              size="1"
                            >
                              ✎
                            </IconButton>
                            <IconButton
                              type="button"
                              onClick={() => handleDeleteStage(stage)}
                              title="删除词库"
                              variant="ghost"
                              color="gray"
                              size="1"
                            >
                              🗑
                            </IconButton>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="border-kid-line mt-3 border-t pt-3">
                  <Button
                    type="button"
                    onClick={() => setNewStageOpen(true)}
                    color="amber"
                    variant="solid"
                    size="2"
                    className="w-full"
                  >
                    + 新建词库
                  </Button>
                </div>
              </StickerCard>
            </aside>

            {/* 单词区 */}
            <section className="min-w-0 space-y-3">
              {/* 工具条 */}
              <Card>
                <Flex wrap="wrap" align="center" gap="2">
                  <FilterSelect
                    label="单元"
                    options={units}
                    value={selUnit}
                    onChange={(unit) => {
                      setSelUnit(unit)
                      setSelLesson('')
                    }}
                  />
                  <FilterSelect
                    label="课次"
                    options={lessons}
                    value={selLesson}
                    onChange={setSelLesson}
                  />
                  <div className="min-w-[140px] flex-1">
                    <TextField.Root
                      aria-label="搜索单词、释义或中文"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="搜索单词 / 释义 / 中文"
                    />
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button
                      type="button"
                      variant="soft"
                      color="gray"
                      onClick={() => void handleExportVocab()}
                      disabled={!rows.length}
                    >
                      导出词库
                    </Button>
                    <BatchAddModal
                      defaultStage={effectiveStage}
                      disabled={!hasStage}
                      onConfirm={handleBatchConfirm}
                    />
                    <Button
                      type="button"
                      disabled={!hasStage}
                      onClick={() => setForm({ mode: 'new' })}
                    >
                      + 添加单词
                    </Button>
                  </div>
                </Flex>
              </Card>

              {/* 单词表 */}
              <Card>
                <Flex align="center" justify="between" gap="3" mb="3">
                  <Heading as="h2" size="3">
                    词库 {effectiveStage || NO_STAGE_LABEL}
                  </Heading>
                  <Text size="2" color="gray">
                    {rows.length} 个单词
                  </Text>
                </Flex>
                <Table.Root
                  size="1"
                  className="flex max-h-[60vh] flex-col"
                  aria-label="词库单词列表"
                  role="region"
                >
                  <Theme asChild hasBackground>
                    <Table.Header className="sticky top-0 z-10">
                      <Table.Row>
                        <Table.ColumnHeaderCell>单词</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>音标</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>中文</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>英文释义</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Unit</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Lesson</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell justify="end">操作</Table.ColumnHeaderCell>
                      </Table.Row>
                    </Table.Header>
                  </Theme>
                  <Table.Body>
                    {rows.length === 0 && (
                      <Table.Row>
                        <Table.Cell colSpan={7} justify="center" py="5">
                          <Text color="gray">
                            {hasStage
                              ? '该筛选下还没有单词，点右上角「添加单词」'
                              : '请先在左侧新建一个词库'}
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    )}
                    {rows.map((w, i) => (
                      <Table.Row key={`${w.unit}::${w.lesson}::${w.word}::${i}`} align="center">
                        <Table.RowHeaderCell>
                          <Text weight="medium">{w.word}</Text>
                        </Table.RowHeaderCell>
                        <Table.Cell>
                          <Text color="gray">{w.ipa || '—'}</Text>
                        </Table.Cell>
                        <Table.Cell>{w.chineseDef || '—'}</Table.Cell>
                        <Table.Cell>
                          <Box maxWidth="20rem">
                            <Text as="div" truncate title={w.explanation || undefined}>
                              {w.explanation || '—'}
                            </Text>
                          </Box>
                        </Table.Cell>
                        <Table.Cell>
                          <Text wrap="nowrap">{w.unit}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Text wrap="nowrap">{w.lesson}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Flex justify="end" align="center" gap="3">
                            <Button
                              type="button"
                              size="1"
                              variant="ghost"
                              onClick={() => setPreviewWord(w)}
                            >
                              预览
                            </Button>
                            <Button
                              type="button"
                              size="1"
                              variant="ghost"
                              color="gray"
                              onClick={() => setForm({ mode: 'edit', word: w })}
                            >
                              编辑
                            </Button>
                            <Button
                              type="button"
                              size="1"
                              variant="ghost"
                              color="red"
                              onClick={() => handleDeleteWord(w)}
                            >
                              删除
                            </Button>
                          </Flex>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Card>
            </section>
          </>
        )}
      </main>

      {newStageOpen && (
        <NewStageModal
          existingStages={stages.map((s) => s.stage)}
          onCancel={() => setNewStageOpen(false)}
          onSubmit={handleCreateStage}
        />
      )}

      {previewWord && <WordPreviewModal word={previewWord} onClose={() => setPreviewWord(null)} />}

      {form && (
        <WordFormModal
          initial={form.mode === 'edit' ? form.word : undefined}
          defaultStage={effectiveStage}
          tree={tree}
          onCreateStage={handleCreateStageInForm}
          onCreateUnit={handleCreateUnit}
          onCreateLesson={handleCreateLesson}
          onCancel={() => setForm(null)}
          onSubmit={handleSubmitWord}
        />
      )}
    </div>
  )
}
