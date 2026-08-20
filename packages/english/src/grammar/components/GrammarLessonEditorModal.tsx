'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GrammarBlock, GrammarLesson } from '../types'

interface GrammarLessonEditorModalProps {
  lesson: GrammarLesson
  onSave: (lesson: GrammarLesson) => Promise<void>
  onClose: () => void
}

const BLOCK_LABELS: Record<GrammarBlock['type'], string> = {
  example_set: '情境例句',
  examples: '例句',
  grammar_table: '结构表格',
  contraction_note: '缩写说明',
  rule_text: '规则说明',
  tip: '提示',
  spelling_rule: '拼写规则',
  image_description: '插图描述',
  unsupported: '未识别内容',
}

function cloneLesson(lesson: GrammarLesson): GrammarLesson {
  return structuredClone(lesson)
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function blockSummary(block: GrammarBlock): string {
  switch (block.type) {
    case 'example_set':
      return block.context || `${block.items.length} 条例句`
    case 'examples':
      return `${block.items.length} 条例句`
    case 'grammar_table':
      return block.title || `${block.rows.length} 行表格`
    case 'contraction_note':
      return `${block.items.length} 组缩写`
    case 'spelling_rule':
      return block.text
    default:
      return block.text
  }
}

export function GrammarLessonEditorModal({
  lesson,
  onSave,
  onClose,
}: GrammarLessonEditorModalProps) {
  const [draft, setDraft] = useState(() => cloneLesson(lesson))
  const [activeSection, setActiveSection] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = draft.sections[activeSection]

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, saving])

  const updateCurrent = (update: (section: NonNullable<typeof current>) => NonNullable<typeof current>) => {
    if (!current) return
    setDraft((value) => ({
      ...value,
      sections: value.sections.map((section, index) =>
        index === activeSection ? update(section) : section,
      ),
    }))
  }

  const deleteSection = () => {
    if (!current) return
    setDraft((value) => ({
      ...value,
      sections: value.sections.filter((_, index) => index !== activeSection),
    }))
    setActiveSection((index) => Math.max(0, Math.min(index, draft.sections.length - 2)))
  }

  const addSection = () => {
    const nextIndex = draft.sections.length
    setDraft((value) => ({
      ...value,
      sections: [
        ...value.sections,
        {
          label: null,
          title: `新分区 ${nextIndex + 1}`,
          blocks: [],
        },
      ],
    }))
    setActiveSection(nextIndex)
  }

  const deleteBlock = (blockIndex: number) => {
    updateCurrent((section) => ({
      ...section,
      blocks: section.blocks.filter((_, index) => index !== blockIndex),
    }))
  }

  const moveBlock = (blockIndex: number, direction: -1 | 1) => {
    updateCurrent((section) => ({
      ...section,
      blocks: moveItem(section.blocks, blockIndex, blockIndex + direction),
    }))
  }

  const updateBlock = (blockIndex: number, update: (block: GrammarBlock) => GrammarBlock) => {
    updateCurrent((section) => ({
      ...section,
      blocks: section.blocks.map((block, index) =>
        index === blockIndex ? update(block) : block,
      ),
    }))
  }

  const updateExample = (
    blockIndex: number,
    itemIndex: number,
    field: 'en' | 'zh' | 'note',
    value: string,
  ) => {
    updateBlock(blockIndex, (block) => {
      if (block.type !== 'example_set' && block.type !== 'examples') return block
      return {
        ...block,
        items: block.items.map((item, index) =>
          index === itemIndex ? { ...item, [field]: field === 'note' ? value || null : value } : item,
        ),
      }
    })
  }

  const addExample = (blockIndex: number) => {
    updateBlock(blockIndex, (block) => {
      if (block.type !== 'example_set' && block.type !== 'examples') return block
      return { ...block, items: [...block.items, { en: '', zh: '' }] }
    })
  }

  const deleteExample = (blockIndex: number, itemIndex: number) => {
    updateCurrent((section) => ({
      ...section,
      blocks: section.blocks.map((block, index) => {
        if (index !== blockIndex || (block.type !== 'example_set' && block.type !== 'examples')) {
          return block
        }
        return { ...block, items: block.items.filter((_, item) => item !== itemIndex) }
      }),
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex bg-black/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grammar-lesson-editor-title"
    >
      <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-surface shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-border-light px-4 py-3 sm:px-6">
          <div>
            <h2 id="grammar-lesson-editor-title" className="font-black text-text-primary">
              管理讲解
            </h2>
            <p className="text-xs text-text-muted">按原始数据层级管理分区、内容块和例句</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="关闭讲解编辑器"
            className="min-h-11 min-w-11 rounded-full text-xl font-bold text-text-secondary hover:bg-surface-dim disabled:opacity-40"
          >
            ×
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[240px_minmax(0,1fr)] lg:overflow-hidden">
          <aside className="border-b border-border-light bg-surface-dim/45 p-3 lg:overflow-y-auto lg:border-r lg:border-b-0">
            <div className="mb-3 flex items-center justify-between gap-2 px-1">
              <p className="text-[11px] font-black tracking-wider text-text-muted uppercase">
                讲解分区 · {draft.sections.length}
              </p>
              <button
                type="button"
                onClick={addSection}
                className="min-h-9 rounded-lg bg-app-blue px-3 text-xs font-black text-white shadow-sm shadow-app-blue/20"
              >
                ＋ 新增分区
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {draft.sections.map((section, index) => (
                <button
                  key={`${section.label ?? 'section'}-${index}`}
                  type="button"
                  onClick={() => setActiveSection(index)}
                  className={`min-h-12 min-w-40 rounded-xl px-3 py-2 text-left ring-1 transition-colors ${
                    index === activeSection
                      ? 'bg-app-blue-light text-app-blue-dark ring-app-blue/30'
                      : 'bg-surface text-text-secondary ring-border-light hover:bg-white'
                  }`}
                >
                  <span className="block text-xs font-black">
                    {section.label ? `${section.label} · ` : ''}{section.title || `分区 ${index + 1}`}
                  </span>
                  <span className="mt-0.5 block text-[11px] opacity-70">{section.blocks.length} 个内容块</span>
                </button>
              ))}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto p-4 sm:p-6">
            {current ? (
              <div className="mx-auto max-w-4xl">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-app-blue">{current.label || `分区 ${activeSection + 1}`}</p>
                    <h3 className="mt-0.5 text-xl font-black text-text-primary">{current.title || '无标题分区'}</h3>
                    <p className="mt-1 text-xs text-text-muted">删除操作只修改草稿，点击“保存讲解”后才会生效。</p>
                  </div>
                  <button
                    type="button"
                    onClick={deleteSection}
                    className="min-h-10 rounded-full bg-app-red-light px-4 text-sm font-bold text-app-red ring-1 ring-app-red/15"
                  >
                    删除整个分区
                  </button>
                </div>

                <div className="mb-5 grid gap-3 rounded-2xl bg-app-blue-light/45 p-4 ring-1 ring-app-blue/15 sm:grid-cols-3">
                  <label className="text-xs font-black text-text-secondary">
                    分区标记
                    <input
                      value={current.label ?? ''}
                      onChange={(event) => updateCurrent((section) => ({ ...section, label: event.target.value || null }))}
                      placeholder="例如 A、B"
                      className="mt-1.5 min-h-11 w-full rounded-xl bg-surface px-3 text-sm font-bold text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40"
                    />
                  </label>
                  <label className="text-xs font-black text-text-secondary">
                    分区标题
                    <input
                      value={current.title ?? ''}
                      onChange={(event) => updateCurrent((section) => ({ ...section, title: event.target.value || null }))}
                      placeholder="讲解标题"
                      className="mt-1.5 min-h-11 w-full rounded-xl bg-surface px-3 text-sm font-bold text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40"
                    />
                  </label>
                  <label className="text-xs font-black text-text-secondary">
                    原书页码
                    <input
                      type="number"
                      min={1}
                      value={current.bookPage ?? ''}
                      onChange={(event) => updateCurrent((section) => ({
                        ...section,
                        bookPage: event.target.value === '' ? undefined : Number(event.target.value),
                      }))}
                      placeholder="可选"
                      className="mt-1.5 min-h-11 w-full rounded-xl bg-surface px-3 text-sm font-bold text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-3">
                  {current.blocks.map((block, blockIndex) => (
                    <article key={`${block.type}-${blockIndex}`} className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border-light">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="inline-flex rounded-full bg-app-blue-light px-2.5 py-1 text-[11px] font-black text-app-blue-dark">
                            {BLOCK_LABELS[block.type]}
                          </span>
                          <p className="mt-2 line-clamp-2 text-sm font-bold text-text-primary">{blockSummary(block) || '无摘要'}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" onClick={() => moveBlock(blockIndex, -1)} disabled={blockIndex === 0} aria-label="上移内容块" className="min-h-9 min-w-9 rounded-lg bg-surface-dim text-sm font-black text-text-secondary disabled:opacity-25">↑</button>
                          <button type="button" onClick={() => moveBlock(blockIndex, 1)} disabled={blockIndex === current.blocks.length - 1} aria-label="下移内容块" className="min-h-9 min-w-9 rounded-lg bg-surface-dim text-sm font-black text-text-secondary disabled:opacity-25">↓</button>
                          <button type="button" onClick={() => deleteBlock(blockIndex)} className="min-h-9 rounded-lg bg-app-red-light px-3 text-xs font-black text-app-red">删除内容块</button>
                        </div>
                      </div>

                      {block.type === 'example_set' && (
                        <label className="mt-4 block text-xs font-black text-text-secondary">
                          情境说明
                          <input
                            value={block.context}
                            onChange={(event) => updateBlock(blockIndex, (value) =>
                              value.type === 'example_set' ? { ...value, context: event.target.value } : value,
                            )}
                            className="mt-1.5 min-h-11 w-full rounded-xl bg-surface-dim/55 px-3 text-sm font-bold text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40"
                          />
                        </label>
                      )}

                      {(block.type === 'example_set' || block.type === 'examples') && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {block.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="min-w-0 rounded-xl bg-surface-dim/60 p-3 ring-1 ring-border-light">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-black text-text-muted">例句 {itemIndex + 1}</span>
                                <button type="button" onClick={() => deleteExample(blockIndex, itemIndex)} aria-label={`删除例句 ${item.en}`} className="min-h-8 shrink-0 rounded-lg px-2.5 text-xs font-black text-app-red hover:bg-app-red-light">删除</button>
                              </div>
                              <label className="mt-2 block text-[11px] font-bold text-text-secondary">
                                英文
                                <textarea value={item.en} onChange={(event) => updateExample(blockIndex, itemIndex, 'en', event.target.value)} rows={2} className="mt-1 w-full resize-y rounded-lg bg-surface px-3 py-2 text-base font-bold text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40" />
                              </label>
                              <label className="mt-2 block text-[11px] font-bold text-text-secondary">
                                中文辅助
                                <textarea value={item.zh} onChange={(event) => updateExample(blockIndex, itemIndex, 'zh', event.target.value)} rows={1} className="mt-1 w-full resize-y rounded-lg bg-surface px-3 py-2 text-sm text-text-secondary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40" />
                              </label>
                              <label className="mt-2 block text-[11px] font-bold text-text-secondary">
                                补充注释
                                <input value={item.note ?? ''} onChange={(event) => updateExample(blockIndex, itemIndex, 'note', event.target.value)} className="mt-1 min-h-10 w-full rounded-lg bg-surface px-3 text-sm text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40" />
                              </label>
                            </div>
                          ))}
                          {block.items.length === 0 && (
                            <p className="rounded-xl bg-surface-dim p-3 text-xs font-bold text-text-muted">该内容块已无例句，可继续删除整个内容块。</p>
                          )}
                          <button type="button" onClick={() => addExample(blockIndex)} className="min-h-11 rounded-xl border border-dashed border-app-blue/35 text-sm font-black text-app-blue hover:bg-app-blue-light">
                            ＋ 添加例句
                          </button>
                        </div>
                      )}

                      {(block.type === 'rule_text' || block.type === 'tip' || block.type === 'image_description' || block.type === 'unsupported') && (
                        <label className="mt-4 block text-xs font-black text-text-secondary">
                          内容
                          <textarea
                            value={block.text}
                            onChange={(event) => updateBlock(blockIndex, (value) =>
                              value.type === block.type ? { ...value, text: event.target.value } : value,
                            )}
                            rows={4}
                            className="mt-1.5 w-full resize-y rounded-xl bg-surface-dim/55 px-3 py-2 text-sm leading-6 text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40"
                          />
                        </label>
                      )}

                      {block.type === 'contraction_note' && (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {block.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-surface-dim/60 p-3 ring-1 ring-border-light">
                              <input aria-label="完整形式" value={item.full} onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'contraction_note' ? { ...value, items: value.items.map((entry, index) => index === itemIndex ? { ...entry, full: event.target.value } : entry) } : value)} className="min-h-10 min-w-0 rounded-lg bg-surface px-2 text-sm font-bold text-text-primary ring-1 ring-border-light" />
                              <span className="text-text-muted">→</span>
                              <input aria-label="缩写形式" value={item.short} onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'contraction_note' ? { ...value, items: value.items.map((entry, index) => index === itemIndex ? { ...entry, short: event.target.value } : entry) } : value)} className="min-h-10 min-w-0 rounded-lg bg-surface px-2 text-sm font-bold text-text-primary ring-1 ring-border-light" />
                            </div>
                          ))}
                        </div>
                      )}

                      {block.type === 'spelling_rule' && (
                        <div className="mt-4">
                          <label className="block text-xs font-black text-text-secondary">规则文字<textarea value={block.text} onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'spelling_rule' ? { ...value, text: event.target.value } : value)} rows={3} className="mt-1.5 w-full resize-y rounded-xl bg-surface-dim/55 px-3 py-2 text-sm text-text-primary ring-1 ring-border-light" /></label>
                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            {block.examples.map((item, itemIndex) => (
                              <div key={itemIndex} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-surface-dim/60 p-2 ring-1 ring-border-light">
                                <input aria-label="原形" value={item.base} onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'spelling_rule' ? { ...value, examples: value.examples.map((entry, index) => index === itemIndex ? { ...entry, base: event.target.value } : entry) } : value)} className="min-h-9 min-w-0 rounded-lg bg-surface px-2 text-sm font-bold ring-1 ring-border-light" />
                                <span className="text-text-muted">→</span>
                                <input aria-label="变化形式" value={item.form} onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'spelling_rule' ? { ...value, examples: value.examples.map((entry, index) => index === itemIndex ? { ...entry, form: event.target.value } : entry) } : value)} className="min-h-9 min-w-0 rounded-lg bg-surface px-2 text-sm font-bold ring-1 ring-border-light" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {block.type === 'grammar_table' && (
                        <div className="mt-4">
                          <label className="block text-xs font-black text-text-secondary">表格标题<input value={block.title} onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'grammar_table' ? { ...value, title: event.target.value } : value)} className="mt-1.5 min-h-10 w-full rounded-lg bg-surface-dim/55 px-3 text-sm font-bold text-text-primary ring-1 ring-border-light" /></label>
                          <p className="mt-2 text-xs text-text-muted">表头、单元格、增删行列及合并操作请保存退出后，使用表格上的“编辑表格”。</p>
                        </div>
                      )}
                    </article>
                  ))}
                  {current.blocks.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border-light py-12 text-center text-sm font-bold text-text-muted">该分区已无内容块</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-64 items-center justify-center text-sm font-bold text-text-muted">讲解中已无分区</div>
            )}
          </main>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border-light bg-surface px-4 py-3 sm:px-6">
          <p className="min-h-5 text-xs font-bold text-app-red">{error}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-full px-5 text-sm font-bold text-text-secondary ring-1 ring-border-light disabled:opacity-40">取消</button>
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="min-h-11 rounded-full bg-app-blue px-6 text-sm font-black text-white shadow-md shadow-app-blue/20 disabled:opacity-50">
              {saving ? '保存中…' : '保存讲解'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
