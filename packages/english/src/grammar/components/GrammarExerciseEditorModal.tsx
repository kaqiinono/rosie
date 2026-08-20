'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  GrammarExerciseGroup,
  GrammarExerciseItem,
  GrammarExerciseType,
  GrammarPageImage,
} from '../types'
import { grammarPageImageUrl } from '../types'
import { ExerciseView } from './ExerciseView'

interface GrammarExerciseEditorModalProps {
  groups: GrammarExerciseGroup[]
  initialGroupIndex?: number
  onSave: (groups: GrammarExerciseGroup[]) => Promise<void>
  onClose: () => void
  pageImages: GrammarPageImage[]
}

const EXERCISE_TYPES: { value: GrammarExerciseType; label: string }[] = [
  { value: 'fill_blank', label: '填空题' },
  { value: 'sentence_completion', label: '句子补全' },
  { value: 'short_answer', label: '简答题' },
  { value: 'transformation', label: '句型转换' },
  { value: 'multiple_choice', label: '选择题' },
  { value: 'matching', label: '匹配题' },
]

function cloneGroups(groups: GrammarExerciseGroup[]): GrammarExerciseGroup[] {
  return groups.map((group) => ({
    ...group,
    figure: group.figure ? { ...group.figure } : undefined,
    items: group.items.map((item) => ({
      ...item,
      options: item.options ? [...item.options] : null,
      studyUnits: item.studyUnits ? [...item.studyUnits] : undefined,
    })),
  }))
}

function nextQuestionNumber(items: GrammarExerciseItem[]): number {
  return Math.max(0, ...items.map((item) => item.number)) + 1
}

function emptyItem(number: number): GrammarExerciseItem {
  return { number, type: 'fill_blank', prompt: '______', answer: '', options: null }
}

function emptyGroup(index: number): GrammarExerciseGroup {
  return { section: String(index + 1), instruction: '', items: [emptyItem(1)] }
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function GrammarExerciseEditorModal({
  groups,
  initialGroupIndex = 0,
  onSave,
  onClose,
  pageImages,
}: GrammarExerciseEditorModalProps) {
  const [draft, setDraft] = useState(() => cloneGroups(groups))
  const [activeGroup, setActiveGroup] = useState(() =>
    Math.min(Math.max(initialGroupIndex, 0), Math.max(groups.length - 1, 0)),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewerMode, setViewerMode] = useState<'source' | 'preview'>('source')
  const current = draft[activeGroup]

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || saving) return
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, saving])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const previewGroups = useMemo(() => (current ? [current] : []), [current])
  const referenceImage = useMemo(
    () =>
      pageImages.find((image) => image.page === current?.bookPage && image.type === 'exercise')
      ?? pageImages.find((image) => image.page === current?.bookPage)
      ?? pageImages.find((image) => image.type === 'exercise')
      ?? pageImages[0],
    [current?.bookPage, pageImages],
  )
  const referenceImageUrl = referenceImage ? grammarPageImageUrl(referenceImage.path) : ''
  const updateGroup = (update: (group: GrammarExerciseGroup) => GrammarExerciseGroup) => {
    setDraft((all) => all.map((group, index) => (index === activeGroup ? update(group) : group)))
  }

  const updateItem = (
    itemIndex: number,
    update: (item: GrammarExerciseItem) => GrammarExerciseItem,
  ) => {
    updateGroup((group) => ({
      ...group,
      items: group.items.map((item, index) => (index === itemIndex ? update(item) : item)),
    }))
  }

  const addGroup = () => {
    const index = draft.length
    setDraft((all) => [...all, emptyGroup(index)])
    setActiveGroup(index)
  }

  const copyGroup = () => {
    if (!current) return
    const copy = cloneGroups([{ ...current, section: `${current.section} 副本` }])[0]
    const insertAt = activeGroup + 1
    setDraft((all) => [...all.slice(0, insertAt), copy, ...all.slice(insertAt)])
    setActiveGroup(insertAt)
  }

  const deleteGroup = () => {
    if (!current) return
    setDraft((all) => all.filter((_, index) => index !== activeGroup))
    setActiveGroup((index) => Math.max(0, Math.min(index, draft.length - 2)))
  }

  const moveGroup = (direction: -1 | 1) => {
    const target = activeGroup + direction
    if (target < 0 || target >= draft.length) return
    setDraft((all) => moveItem(all, activeGroup, target))
    setActiveGroup(target)
  }

  const handleSave = async () => {
    const duplicateNumbers = draft.some((group) => {
      const numbers = group.items.map((item) => item.number)
      return new Set(numbers).size !== numbers.length
    })
    if (duplicateNumbers) {
      setError('同一练习组内题号不能重复')
      return
    }
    if (draft.some((group) => group.items.some((item) => item.prompt.trim() === ''))) {
      setError('题干不能为空')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const editor = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grammar-exercise-editor-title"
    >
      <div className="flex h-dvh min-h-0 w-full max-w-none flex-col overflow-hidden bg-surface shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-border-light px-4 py-3 sm:px-5">
          <div>
            <h2 id="grammar-exercise-editor-title" className="font-black text-text-primary">管理练习</h2>
            <p className="text-xs text-text-muted">编辑组、题型、题干、答案和选项，右侧实时预览</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="关闭练习编辑器"
              className="min-h-11 min-w-11 rounded-full text-lg font-bold text-text-secondary hover:bg-surface-dim disabled:opacity-40"
            >
              ×
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[190px_minmax(0,1fr)_500px] lg:overflow-hidden">
          <aside className="border-b border-border-light bg-surface-dim/50 p-3 lg:overflow-y-auto lg:border-r lg:border-b-0">
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              <button type="button" onClick={addGroup} className="min-h-9 rounded-lg bg-app-blue text-xs font-bold text-white">＋ 新建组</button>
              <button type="button" onClick={copyGroup} disabled={!current} className="min-h-9 rounded-lg bg-surface text-xs font-bold text-text-secondary ring-1 ring-border-light disabled:opacity-35">复制组</button>
            </div>
            <div className="mb-2 grid grid-cols-3 gap-1">
              <button type="button" onClick={() => moveGroup(-1)} disabled={activeGroup === 0} className="min-h-8 rounded-md bg-surface text-xs font-bold text-text-secondary disabled:opacity-30">↑</button>
              <button type="button" onClick={() => moveGroup(1)} disabled={activeGroup >= draft.length - 1} className="min-h-8 rounded-md bg-surface text-xs font-bold text-text-secondary disabled:opacity-30">↓</button>
              <button type="button" onClick={deleteGroup} disabled={!current} className="min-h-8 rounded-md bg-app-red-light text-xs font-bold text-app-red disabled:opacity-30">删除</button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
              {draft.map((group, index) => (
                <button
                  key={`${group.section}-${index}`}
                  type="button"
                  onClick={() => setActiveGroup(index)}
                  className={`min-h-10 min-w-28 rounded-lg px-2 text-left text-xs font-bold ring-1 ${
                    index === activeGroup
                      ? 'bg-app-blue-light text-app-blue-dark ring-app-blue/30'
                      : 'bg-surface text-text-secondary ring-border-light'
                  }`}
                >
                  {group.section || `第 ${index + 1} 组`} · {group.items.length} 题
                </button>
              ))}
            </div>
          </aside>

          <main className="min-w-0 border-b border-border-light p-4 sm:p-5 lg:overflow-y-auto lg:border-r lg:border-b-0">
            {current ? (
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)_110px]">
                  <label className="text-xs font-bold text-text-secondary">组编号
                    <input value={current.section} onChange={(event) => updateGroup((group) => ({ ...group, section: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg px-3 text-sm text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue" />
                  </label>
                  <label className="text-xs font-bold text-text-secondary">练习说明
                    <input value={current.instruction} onChange={(event) => updateGroup((group) => ({ ...group, instruction: event.target.value }))} className="mt-1 min-h-10 w-full rounded-lg px-3 text-sm text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue" />
                  </label>
                  <label className="text-xs font-bold text-text-secondary">原书页码
                    <input type="number" value={current.bookPage ?? ''} onChange={(event) => updateGroup((group) => ({ ...group, bookPage: event.target.value === '' ? undefined : Number(event.target.value) }))} className="mt-1 min-h-10 w-full rounded-lg px-3 text-sm text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue" />
                  </label>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-text-primary">题目</h3>
                  <button
                    type="button"
                    onClick={() => updateGroup((group) => ({ ...group, items: [...group.items, emptyItem(nextQuestionNumber(group.items))] }))}
                    className="min-h-9 rounded-full bg-app-blue px-4 text-xs font-bold text-white"
                  >
                    ＋ 添加题目
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {current.items.map((item, itemIndex) => (
                    <article key={itemIndex} className="rounded-xl bg-surface-dim/45 p-3 ring-1 ring-border-light">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <input type="number" min={1} value={item.number} aria-label={`第 ${itemIndex + 1} 题题号`} onChange={(event) => updateItem(itemIndex, (value) => ({ ...value, number: Number(event.target.value) }))} className="h-9 w-16 rounded-lg bg-surface px-2 text-center text-sm font-bold text-text-primary ring-1 ring-border-light" />
                        <select value={item.type} onChange={(event) => updateItem(itemIndex, (value) => ({ ...value, type: event.target.value as GrammarExerciseType }))} className="h-9 rounded-lg bg-surface px-2 text-xs font-bold text-text-primary ring-1 ring-border-light">
                          {EXERCISE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                        <div className="ml-auto flex gap-1">
                          <button type="button" onClick={() => updateGroup((group) => ({ ...group, items: moveItem(group.items, itemIndex, itemIndex - 1) }))} disabled={itemIndex === 0} className="h-9 min-w-9 rounded-lg bg-surface text-xs font-bold text-text-secondary disabled:opacity-30">↑</button>
                          <button type="button" onClick={() => updateGroup((group) => ({ ...group, items: moveItem(group.items, itemIndex, itemIndex + 1) }))} disabled={itemIndex === current.items.length - 1} className="h-9 min-w-9 rounded-lg bg-surface text-xs font-bold text-text-secondary disabled:opacity-30">↓</button>
                          <button type="button" onClick={() => updateGroup((group) => ({ ...group, items: [...group.items.slice(0, itemIndex + 1), { ...item, number: nextQuestionNumber(group.items), options: item.options ? [...item.options] : null }, ...group.items.slice(itemIndex + 1)] }))} className="h-9 rounded-lg bg-surface px-2 text-xs font-bold text-text-secondary">复制</button>
                          <button type="button" onClick={() => updateGroup((group) => ({ ...group, items: group.items.filter((_, index) => index !== itemIndex) }))} className="h-9 rounded-lg bg-app-red-light px-2 text-xs font-bold text-app-red">删除</button>
                        </div>
                      </div>

                      <label className="block text-xs font-bold text-text-secondary">题干
                        <textarea value={item.prompt} onChange={(event) => updateItem(itemIndex, (value) => ({ ...value, prompt: event.target.value }))} className="mt-1 min-h-20 w-full resize-y rounded-lg bg-surface p-2.5 text-sm text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue" />
                      </label>
                      <button type="button" onClick={() => updateItem(itemIndex, (value) => ({ ...value, prompt: `${value.prompt}${value.prompt.endsWith(' ') || value.prompt === '' ? '' : ' '}______` }))} className="mt-1.5 rounded-full bg-app-blue-light px-3 py-1 text-[11px] font-bold text-app-blue-dark">＋ 插入填空</button>
                      <span className="ml-2 text-[11px] font-medium text-text-muted">
                        示例写法：题干 ==&gt; 示例答案 &lt;== 后续题干
                      </span>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-bold text-text-secondary">标准答案
                          <textarea value={item.answer} onChange={(event) => updateItem(itemIndex, (value) => ({ ...value, answer: event.target.value }))} placeholder="留空表示开放题" className="mt-1 min-h-16 w-full resize-y rounded-lg bg-surface p-2.5 text-sm text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue" />
                          <span className="mt-1 block font-medium text-text-muted">单空题有多个可接受答案时，每行填写一个答案。</span>
                        </label>
                        <label className="text-xs font-bold text-text-secondary">选项（每行一个）
                          <textarea value={(item.options ?? []).join('\n')} onChange={(event) => updateItem(itemIndex, (value) => ({ ...value, options: event.target.value === '' ? null : event.target.value.split('\n') }))} className="mt-1 min-h-16 w-full resize-y rounded-lg bg-surface p-2.5 text-sm text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue" />
                        </label>
                      </div>
                      <label className="mt-3 block text-xs font-bold text-text-secondary">关联学习单元（逗号分隔）
                        <input value={(item.studyUnits ?? []).join(', ')} onChange={(event) => updateItem(itemIndex, (value) => ({ ...value, studyUnits: event.target.value.split(/[,，\s]+/).map(Number).filter((number) => Number.isFinite(number) && number > 0) }))} className="mt-1 min-h-9 w-full rounded-lg bg-surface px-3 text-sm text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue" />
                      </label>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-text-muted">暂无练习组，点击左侧“新建组”开始添加。</div>
            )}
          </main>

          <aside className="order-first min-w-0 border-b border-border-light bg-surface-dim/45 p-4 lg:order-none lg:overflow-y-auto lg:border-b-0">
            <div className="mb-4 grid grid-cols-2 rounded-xl bg-surface p-1 ring-1 ring-border-light" role="tablist" aria-label="查看区域">
              <button
                type="button"
                role="tab"
                aria-selected={viewerMode === 'source'}
                onClick={() => setViewerMode('source')}
                className={`min-h-10 rounded-lg px-3 text-sm font-bold transition-colors ${viewerMode === 'source' ? 'bg-app-blue text-white shadow-sm' : 'text-text-secondary hover:bg-surface-dim'}`}
              >
                原书对照{referenceImage ? ` · p.${referenceImage.page}` : ''}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewerMode === 'preview'}
                onClick={() => setViewerMode('preview')}
                className={`min-h-10 rounded-lg px-3 text-sm font-bold transition-colors ${viewerMode === 'preview' ? 'bg-app-blue text-white shadow-sm' : 'text-text-secondary hover:bg-surface-dim'}`}
              >
                实时预览
              </button>
            </div>

            {viewerMode === 'source' ? (
              <section role="tabpanel" aria-label="原书对照">
                {referenceImageUrl ? (
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-surface ring-1 ring-border-light">
                    {/* Storage 域名随环境变化，沿用原书预览的直接图片加载方式。 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={referenceImageUrl}
                      alt={`原书第 ${referenceImage?.page ?? ''} 页`}
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl bg-surface p-6 text-center text-sm text-text-muted ring-1 ring-border-light">
                    本单元暂无可对照的原书图片
                  </div>
                )}
              </section>
            ) : (
              <section role="tabpanel" aria-label="学生端实时预览">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black text-text-primary">学生端实时预览</h3>
                <span className="rounded-full bg-app-green-light px-2 py-1 text-[10px] font-bold text-app-green-dark">自动更新</span>
                </div>
                {previewGroups.length > 0 ? (
                  <ExerciseView groups={previewGroups} isAdmin={false} pageImages={[]} onGroupResult={() => {}} onPreviewFigure={() => {}} />
                ) : (
                  <p className="text-sm text-text-muted">暂无可预览内容</p>
                )}
              </section>
            )}
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border-light px-4 py-3 sm:px-5">
          {error && <p role="alert" className="mr-auto text-sm font-bold text-app-red">{error}</p>}
          <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-full px-5 text-sm font-bold text-text-secondary ring-1 ring-border-light disabled:opacity-40">取消</button>
          <button type="button" onClick={() => void handleSave()} disabled={saving} className="min-h-11 rounded-full bg-app-blue px-6 text-sm font-bold text-white disabled:opacity-50">{saving ? '保存中…' : '保存并应用'}</button>
        </footer>
      </div>
    </div>
  )

  return createPortal(editor, document.body)
}
