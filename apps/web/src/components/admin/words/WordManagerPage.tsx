'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
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
  const { vocab, addWords, updateWord, deleteWord, deleteStage, renameStage } = useWordData(user)

  const [activeStage, setActiveStage] = useState<string | null>(null)
  const [draftStages, setDraftStagesState] = useState<StageTree[]>(() => readDraftStages(user?.id))
  const [selUnit, setSelUnit] = useState('')
  const [selLesson, setSelLesson] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormState>(null)
  const [previewWord, setPreviewWord] = useState<WordEntry | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
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
      if (!um) { um = new Map(); map.set(s, um) }
      let ls = um.get(u)
      if (!ls) { ls = new Set(); um.set(u, ls) }
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
    () => [...new Set(stageWords.filter((w) => !selUnit || w.unit === selUnit).map((w) => w.lesson))].sort(),
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
  const handleCreateStageInForm = (stage: string) => persistDrafts(withDraftEntry(draftStages, stage))
  const handleCreateUnit = (stage: string, unit: string) => persistDrafts(withDraftEntry(draftStages, stage, unit))
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
    setBatchOpen(false)
    triggerFlash(`已添加 ${words.length} 个单词`)
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">请先登录</div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg,#fffbeb 0%,#fff1f2 45%,#eff6ff 100%)' }}>
      <header
        className="sticky top-0 z-30 border-b border-amber-200/40 backdrop-blur"
        style={{ background: 'rgba(255,255,255,0.85)' }}
      >
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <Link
            href="/admin"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-700 transition hover:scale-110"
            style={{ background: 'rgba(245,158,11,0.10)', border: '1.5px solid rgba(245,158,11,0.30)' }}
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
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)' }}
            >
              ✓ {flash}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 px-4 py-6 pb-20 md:grid-cols-[240px_1fr]">
        {/* 词库侧栏 */}
        <aside className="space-y-3">
          <div className="rounded-2xl bg-white/85 p-3 shadow-sm" style={{ border: '1.5px solid rgba(245,158,11,0.22)' }}>
            <div className="mb-2 text-[11px] font-extrabold tracking-[0.18em] text-amber-800/80 uppercase">词库</div>
            <div className="space-y-1.5">
              {stages.length === 0 && (
                <div className="rounded-lg bg-white/60 py-4 text-center text-[12px] text-slate-400">还没有词库，新建一个</div>
              )}
              {stages.map(({ stage, count }) => {
                const active = stage === effectiveStage
                return (
                  <div
                    key={stage || '__none__'}
                    className="group flex items-center gap-1 rounded-xl px-2 py-1.5 transition"
                    style={{
                      background: active ? 'linear-gradient(135deg,rgba(245,158,11,0.16),rgba(244,63,94,0.10))' : 'rgba(255,255,255,0.6)',
                      border: active ? '1.5px solid rgba(245,158,11,0.45)' : '1.5px solid transparent',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => { setActiveStage(stage); setSelUnit(''); setSelLesson('') }}
                      className="flex flex-1 cursor-pointer items-center justify-between gap-2 text-left"
                    >
                      <span className="text-[13px] font-extrabold text-slate-800">{stage || NO_STAGE_LABEL}</span>
                      <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 tabular-nums">{count}</span>
                    </button>
                    {stage !== NO_STAGE && (
                      <div className="flex shrink-0 opacity-0 transition group-hover:opacity-100">
                        <button type="button" onClick={() => handleRenameStage(stage)} className="cursor-pointer rounded px-1 text-[11px] text-slate-500 hover:text-amber-700" title="重命名">✎</button>
                        <button type="button" onClick={() => handleDeleteStage(stage)} className="cursor-pointer rounded px-1 text-[11px] text-slate-400 hover:text-red-600" title="删除词库">🗑</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-3 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setNewStageOpen(true)}
                className="w-full cursor-pointer rounded-lg py-2 text-[13px] font-extrabold text-white shadow transition hover:-translate-y-px"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#b45309)', boxShadow: '0 3px 10px rgba(245,158,11,0.35)' }}
              >
                + 新建词库
              </button>
            </div>
          </div>
        </aside>

        {/* 单词区 */}
        <section className="space-y-3">
          {/* 工具条 */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/85 p-3 shadow-sm" style={{ border: '1.5px solid rgba(15,23,42,0.06)' }}>
            <select
              value={selUnit}
              onChange={(e) => { setSelUnit(e.target.value); setSelLesson('') }}
              className="rounded-lg border-2 border-slate-200 bg-white px-2 py-1.5 text-[13px] font-bold text-slate-700 focus:border-amber-400 focus:outline-none"
            >
              <option value="">全部单元</option>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <select
              value={selLesson}
              onChange={(e) => setSelLesson(e.target.value)}
              className="rounded-lg border-2 border-slate-200 bg-white px-2 py-1.5 text-[13px] font-bold text-slate-700 focus:border-amber-400 focus:outline-none"
            >
              <option value="">全部课次</option>
              {lessons.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索 单词 / 释义 / 中文"
              className="min-w-[140px] flex-1 rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-[13px] focus:border-amber-400 focus:outline-none"
            />
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => setBatchOpen(true)}
                disabled={!hasStage}
                className="cursor-pointer rounded-full border border-amber-300 bg-white px-3 py-1.5 text-[12px] font-extrabold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                批量添加
              </button>
              <button
                type="button"
                onClick={() => setForm({ mode: 'new' })}
                disabled={!hasStage}
                className="cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-extrabold text-white shadow transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#b45309)', boxShadow: '0 3px 10px rgba(245,158,11,0.4)' }}
              >
                + 添加单词
              </button>
            </div>
          </div>

          {/* 单词表 */}
          <div className="overflow-hidden rounded-2xl bg-white/90 shadow-sm" style={{ border: '1.5px solid rgba(15,23,42,0.06)' }}>
            <div className="flex items-center justify-between px-4 py-2 text-[12px] text-slate-500">
              <span>词库 <span className="font-extrabold text-slate-700">{effectiveStage || NO_STAGE_LABEL}</span></span>
              <span className="tabular-nums">{rows.length} 个单词</span>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-extrabold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2">单词</th>
                    <th className="px-3 py-2">音标</th>
                    <th className="px-3 py-2">中文</th>
                    <th className="px-3 py-2">英文释义</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2">Lesson</th>
                    <th className="px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-[13px] text-slate-400">
                        {hasStage ? '该筛选下还没有单词，点右上角「添加单词」' : '请先在左侧新建一个词库'}
                      </td>
                    </tr>
                  )}
                  {rows.map((w, i) => (
                    <tr key={`${w.unit}::${w.lesson}::${w.word}::${i}`} className="border-t border-slate-100 hover:bg-amber-50/40">
                      <td className="px-3 py-2 font-extrabold text-slate-800">{w.word}</td>
                      <td className="px-3 py-2 font-mono text-[12px] text-slate-500">{w.ipa || '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{w.chineseDef || '—'}</td>
                      <td className="max-w-[320px] truncate px-3 py-2 text-slate-600" title={w.explanation || ''}>{w.explanation || '—'}</td>
                      <td className="px-3 py-2 text-slate-500">{w.unit}</td>
                      <td className="px-3 py-2 text-slate-500">{w.lesson}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setPreviewWord(w)}
                          className="cursor-pointer rounded px-2 py-1 text-[12px] font-bold text-indigo-600 transition hover:bg-indigo-50"
                        >
                          预览
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm({ mode: 'edit', word: w })}
                          className="cursor-pointer rounded px-2 py-1 text-[12px] font-bold text-slate-600 transition hover:bg-slate-100"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWord(w)}
                          className="cursor-pointer rounded px-2 py-1 text-[12px] font-bold text-red-600 transition hover:bg-red-50"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {newStageOpen && (
        <NewStageModal
          existingStages={stages.map((s) => s.stage)}
          onCancel={() => setNewStageOpen(false)}
          onSubmit={handleCreateStage}
        />
      )}

      {previewWord && (
        <WordPreviewModal word={previewWord} onClose={() => setPreviewWord(null)} />
      )}

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

      {batchOpen && (
        <BatchAddModal
          defaultStage={effectiveStage}
          onCancel={() => setBatchOpen(false)}
          onConfirm={handleBatchConfirm}
        />
      )}
    </div>
  )
}
