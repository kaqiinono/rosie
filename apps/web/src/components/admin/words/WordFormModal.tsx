'use client'

import { useEffect, useState } from 'react'
import type { WordEntry } from '@/utils/type'
import { enrichWord, type EnrichResult } from '@/utils/word-enrich'
import { hilite } from '@/utils/english-helpers'
import { KW_COLORS, DEFAULT_KW_COLOR, type StageTree } from './types'

type Props = {
  /** When provided, modal is in "edit" mode; otherwise "create". */
  initial?: WordEntry
  /** Default stage for new words (the currently active 词库). */
  defaultStage: string
  /** Merged stage→unit→lesson tree (vocab + drafts) for cascading selects. */
  tree: StageTree[]
  onCreateStage: (stage: string) => void
  onCreateUnit: (stage: string, unit: string) => void
  onCreateLesson: (stage: string, unit: string, lesson: string) => void
  onCancel: () => void
  onSubmit: (entry: WordEntry, original?: WordEntry) => Promise<void>
}

const labelCls = 'mb-1 block text-[11px] font-extrabold tracking-wide text-slate-500 uppercase'
const inputCls =
  'w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-[14px] focus:border-amber-400 focus:outline-none'
const selectCls =
  'w-full rounded-lg border-2 border-slate-200 bg-white px-2 py-2 text-[14px] font-bold text-slate-700 focus:border-amber-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'

const NEW = '__new__'

// 级联可创建下拉：选已有项，或选「➕ 新建…」切到内联输入
function CreatableSelect({
  value,
  options,
  placeholder,
  createLabel,
  disabled,
  onChange,
  onCreate,
}: {
  value: string
  options: string[]
  placeholder: string
  createLabel: string
  disabled?: boolean
  onChange: (v: string) => void
  onCreate: (v: string) => void
}) {
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')

  if (creating) {
    const confirm = () => {
      const v = draft.trim()
      if (!v) return
      onCreate(v)
      setDraft('')
      setCreating(false)
    }
    return (
      <div className="flex gap-1.5">
        <input
          autoFocus
          className={inputCls}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm()
            if (e.key === 'Escape') setCreating(false)
          }}
          placeholder={placeholder}
        />
        <button type="button" onClick={confirm} className="shrink-0 cursor-pointer rounded-lg bg-emerald-500 px-2.5 text-[14px] font-bold text-white">✓</button>
        <button type="button" onClick={() => setCreating(false)} className="shrink-0 cursor-pointer rounded-lg bg-slate-200 px-2.5 text-[14px] font-bold text-slate-600">✕</button>
      </div>
    )
  }

  return (
    <select
      className={selectCls}
      value={options.includes(value) ? value : ''}
      disabled={disabled}
      onChange={(e) => {
        if (e.target.value === NEW) setCreating(true)
        else onChange(e.target.value)
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
      <option value={NEW}>➕ {createLabel}</option>
    </select>
  )
}

export default function WordFormModal({
  initial,
  defaultStage,
  tree,
  onCreateStage,
  onCreateUnit,
  onCreateLesson,
  onCancel,
  onSubmit,
}: Props) {
  const [stage, setStage] = useState(initial?.stage ?? defaultStage ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [lesson, setLesson] = useState(initial?.lesson ?? '')
  const [word, setWord] = useState(initial?.word ?? '')
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [chineseDef, setChineseDef] = useState(initial?.chineseDef ?? '')
  const [ipa, setIpa] = useState(initial?.ipa ?? '')
  const [example, setExample] = useState(initial?.example ?? '')
  const [phonics, setPhonics] = useState(initial?.phonics ?? '')
  const [syllables, setSyllables] = useState((initial?.syllables ?? []).join(', '))
  const [keywords, setKeywords] = useState<[string, string][]>(initial?.keywords ?? [])
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [enrichInfo, setEnrichInfo] = useState<EnrichResult | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting && !enriching) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, submitting, enriching])

  // 级联选项
  const stageOptions = tree.map((t) => t.stage)
  const unitOptions = tree.find((t) => t.stage === stage)?.units.map((u) => u.unit) ?? []
  const lessonOptions = tree.find((t) => t.stage === stage)?.units.find((u) => u.unit === unit)?.lessons ?? []

  const canSubmit =
    unit.trim().length > 0 &&
    lesson.trim().length > 0 &&
    word.trim().length > 0 &&
    explanation.trim().length > 0 &&
    !submitting

  const canEnrich = word.trim().length > 0 && !enriching && !submitting

  const handleAutoFill = async () => {
    if (!canEnrich) return
    setEnriching(true)
    setEnrichInfo(null)
    try {
      const r = await enrichWord(word.trim(), stage.trim() || undefined)
      if (r.ipa) setIpa(r.ipa)
      if (r.explanation) setExplanation(r.explanation)
      if (r.chineseDef) setChineseDef(r.chineseDef)
      if (r.example) setExample(r.example)
      setEnrichInfo(r)
    } finally {
      setEnriching(false)
    }
  }

  const handleSave = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const cleanedKeywords = keywords
        .map(([t, c]) => [t.trim(), c.trim()] as [string, string])
        .filter(([t, c]) => t.length > 0 && c.length > 0)
      const cleanedSyllables = syllables
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const entry: WordEntry = {
        stage: stage.trim() || undefined,
        unit: unit.trim(),
        lesson: lesson.trim(),
        word: word.trim(),
        explanation: explanation.trim(),
        chineseDef: chineseDef.trim() || undefined,
        ipa: ipa.trim() || undefined,
        example: example.trim() || undefined,
        phonics: phonics.trim() || undefined,
        syllables: cleanedSyllables.length ? cleanedSyllables : undefined,
        keywords: cleanedKeywords.length ? cleanedKeywords : undefined,
      }
      await onSubmit(entry, initial)
    } finally {
      setSubmitting(false)
    }
  }

  const keyChanged =
    !!initial &&
    (initial.unit !== unit.trim() ||
      initial.lesson !== lesson.trim() ||
      initial.word !== word.trim() ||
      (initial.stage ?? '') !== stage.trim())

  const validKeywords = keywords.filter((k) => k[0].trim())
  const previewHtml = explanation.trim() && validKeywords.length ? hilite(explanation, validKeywords) : ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(8px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-[16px] font-extrabold text-slate-800">{initial ? '编辑单词' : '添加单词'}</h3>
          <span className="text-[11px] text-slate-400">必填：词库 / 单元 / 课次 / 单词 / 英文释义</span>
        </div>

        <div className="space-y-3">
          {/* 级联：词库 → 单元 → 课次 */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>词库 *</label>
              <CreatableSelect
                value={stage}
                options={stageOptions}
                placeholder="选择词库"
                createLabel="新建词库"
                onChange={(v) => { setStage(v); setUnit(''); setLesson('') }}
                onCreate={(v) => { onCreateStage(v); setStage(v); setUnit(''); setLesson('') }}
              />
            </div>
            <div>
              <label className={labelCls}>单元 *</label>
              <CreatableSelect
                value={unit}
                options={unitOptions}
                placeholder="选择单元"
                createLabel="新建单元"
                disabled={!stage.trim()}
                onChange={(v) => { setUnit(v); setLesson('') }}
                onCreate={(v) => { onCreateUnit(stage, v); setUnit(v); setLesson('') }}
              />
            </div>
            <div>
              <label className={labelCls}>课次 *</label>
              <CreatableSelect
                value={lesson}
                options={lessonOptions}
                placeholder="选择课次"
                createLabel="新建课次"
                disabled={!unit.trim()}
                onChange={(v) => setLesson(v)}
                onCreate={(v) => { onCreateLesson(stage, unit, v); setLesson(v) }}
              />
            </div>
          </div>

          {/* 单词 + 自动填充 */}
          <div>
            <label className={labelCls}>单词 / 短语 *</label>
            <div className="flex gap-2">
              <input className={inputCls} value={word} onChange={(e) => setWord(e.target.value)} placeholder="apple" />
              <button
                type="button"
                onClick={handleAutoFill}
                disabled={!canEnrich}
                className="shrink-0 cursor-pointer rounded-lg px-3 py-2 text-[12px] font-extrabold text-white shadow transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 3px 10px rgba(99,102,241,0.35)' }}
                title="根据单词自动生成音标 / 中英文释义 / 例句，填入后可修改"
              >
                {enriching ? '生成中…' : '✨ 自动填充'}
              </button>
            </div>
          </div>

          {enrichInfo && (
            <div
              className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-[12px]"
              style={
                enrichInfo.source === 'claude'
                  ? { background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.30)', color: '#4338ca' }
                  : { background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)', color: '#92400e' }
              }
            >
              <span className="rounded-full bg-white/70 px-2 py-0.5 font-extrabold">
                {enrichInfo.source === 'claude' ? `🤖 Claude（${enrichInfo.model ?? 'AI'}）` : '📖 免费词典 (dictionaryapi.dev)'}
              </span>
              <span className="font-bold">已填入下方字段，请确认或修改后再添加。</span>
              {enrichInfo.note && <span className="opacity-80">{enrichInfo.note}</span>}
            </div>
          )}

          <div>
            <label className={labelCls}>英文释义 (explanation) *</label>
            <input className={inputCls} value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="a round fruit" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>中文释义</label>
              <input className={inputCls} value={chineseDef} onChange={(e) => setChineseDef(e.target.value)} placeholder="苹果" />
            </div>
            <div>
              <label className={labelCls}>音标 (IPA)</label>
              <input className={inputCls} value={ipa} onChange={(e) => setIpa(e.target.value)} placeholder="/ˈæpəl/" />
            </div>
          </div>

          <div>
            <label className={labelCls}>例句 (example)</label>
            <input className={inputCls} value={example} onChange={(e) => setExample(e.target.value)} placeholder="I eat an apple every day." />
          </div>

          {/* 高级字段 */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="cursor-pointer text-[12px] font-bold text-slate-500 transition hover:text-slate-700"
          >
            {showAdvanced ? '▾' : '▸'} 高级字段（音节 / 关键词高亮 / phonics，选填）
          </button>
          {showAdvanced && (
            <div className="space-y-3 rounded-xl bg-slate-50 p-3">
              <div>
                <label className={labelCls}>phonics</label>
                <input className={inputCls} value={phonics} onChange={(e) => setPhonics(e.target.value)} placeholder="a-pp-le" />
              </div>
              <div>
                <label className={labelCls}>音节 (syllables，逗号分隔)</label>
                <input className={inputCls} value={syllables} onChange={(e) => setSyllables(e.target.value)} placeholder="ap, ple" />
              </div>
              <div>
                <label className={labelCls}>关键词高亮</label>
                <p className="mb-2 text-[11px] text-slate-500">
                  从「英文释义」里挑出要强调的词/短语，给它选一个颜色——做题时这些词会以该颜色高亮显示。
                </p>
                <div className="space-y-2">
                  {keywords.map((kw, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className={inputCls}
                        value={kw[0]}
                        onChange={(e) => setKeywords((prev) => prev.map((p, j) => (j === i ? [e.target.value, p[1]] : p)))}
                        placeholder="释义里的词/短语"
                      />
                      <div className="flex shrink-0 gap-1">
                        {KW_COLORS.map((c) => {
                          const active = kw[1] === c.cls
                          return (
                            <button
                              key={c.cls}
                              type="button"
                              title={c.label}
                              onClick={() => setKeywords((prev) => prev.map((p, j) => (j === i ? [p[0], c.cls] : p)))}
                              className="h-7 w-7 cursor-pointer rounded-full transition"
                              style={{
                                background: c.hex,
                                outline: active ? '2px solid #0f172a' : '1px solid rgba(15,23,42,0.12)',
                                outlineOffset: active ? '2px' : '0',
                                transform: active ? 'scale(1.08)' : undefined,
                              }}
                              aria-pressed={active}
                            />
                          )
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setKeywords((prev) => prev.filter((_, j) => j !== i))}
                        className="shrink-0 cursor-pointer rounded-lg px-2 text-[13px] font-bold text-red-600 transition hover:bg-red-50"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setKeywords((prev) => [...prev, ['', DEFAULT_KW_COLOR]])}
                    className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-1 text-[12px] font-bold text-slate-500 transition hover:bg-white"
                  >
                    + 添加关键词
                  </button>
                </div>
                {previewHtml && (
                  <div className="mt-2 rounded-lg bg-white p-2 text-[13px] text-slate-700">
                    <span className="mr-1 text-[11px] font-bold text-slate-400">预览：</span>
                    <span dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {keyChanged && (
          <div className="mt-3 rounded-lg px-3 py-2 text-[12px] font-bold text-amber-800" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)' }}>
            ⚠ 改动了 词库/单元/课次/单词 之一，将按新键写入；若新键已存在会覆盖该条。
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 cursor-pointer rounded-lg border border-slate-200 bg-white py-2 text-[13px] font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSubmit}
            className="flex-[2] cursor-pointer rounded-lg py-2 text-[13px] font-extrabold text-white shadow transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)', boxShadow: '0 3px 12px rgba(245,158,11,0.4)' }}
          >
            {submitting ? '保存中…' : initial ? '保存修改' : '添加单词'}
          </button>
        </div>
      </div>
    </div>
  )
}
