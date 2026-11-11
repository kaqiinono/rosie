'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  GrammarExerciseGroup,
  GrammarExerciseItem,
  GrammarExerciseType,
  GrammarPageImage,
} from '../types'
import { ExerciseView } from './ExerciseView'
import {
  GrammarEditorReferencePane,
  moveEditorItem,
  useEditorDismissGuard,
} from './GrammarEditorShared'
import { FormSelect } from '@rosie/ui'
import { Button, IconButton, TextArea, TextField } from '@rosie/ui/themes'

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
  const current = draft[activeGroup]
  const dirty = JSON.stringify(draft) !== JSON.stringify(groups)
  const requestClose = useEditorDismissGuard({ dirty, saving, onClose })

  const previewGroups = useMemo(() => (current ? [current] : []), [current])
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
    setDraft((all) => moveEditorItem(all, activeGroup, target))
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
      <div className="bg-surface shadow-sticker-lg flex h-dvh min-h-0 w-full max-w-none flex-col overflow-hidden">
        <header className="border-border-light flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div>
            <h2 id="grammar-exercise-editor-title" className="text-text-primary font-black">
              管理练习
            </h2>
            <p className="text-text-muted text-xs">编辑组、题型、题干、答案和选项，右侧实时预览</p>
          </div>
          <div className="flex items-center gap-2">
            <IconButton
              type="button"
              onClick={requestClose}
              disabled={saving}
              aria-label="关闭练习编辑器"
              variant="ghost"
              color="gray"
              size="3"
            >
              ×
            </IconButton>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[190px_minmax(0,1fr)_500px] lg:overflow-hidden">
          <aside className="border-border-light bg-surface-dim/50 border-b p-3 lg:overflow-y-auto lg:border-r lg:border-b-0">
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              <Button type="button" onClick={addGroup} variant="solid" color="blue" size="1">
                ＋ 新建组
              </Button>
              <Button
                type="button"
                onClick={copyGroup}
                disabled={!current}
                variant="outline"
                color="gray"
                size="1"
              >
                复制组
              </Button>
            </div>
            <div className="mb-2 grid grid-cols-3 gap-1">
              <IconButton
                type="button"
                onClick={() => moveGroup(-1)}
                disabled={activeGroup === 0}
                variant="outline"
                color="gray"
                size="1"
              >
                ↑
              </IconButton>
              <IconButton
                type="button"
                onClick={() => moveGroup(1)}
                disabled={activeGroup >= draft.length - 1}
                variant="outline"
                color="gray"
                size="1"
              >
                ↓
              </IconButton>
              <Button
                type="button"
                onClick={deleteGroup}
                disabled={!current}
                variant="soft"
                color="red"
                size="1"
              >
                删除
              </Button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
              {draft.map((group, index) => (
                <Button
                  key={`${group.section}-${index}`}
                  type="button"
                  onClick={() => setActiveGroup(index)}
                  variant={index === activeGroup ? 'soft' : 'outline'}
                  color={index === activeGroup ? 'blue' : 'gray'}
                  size="1"
                >
                  {group.section || `第 ${index + 1} 组`} · {group.items.length} 题
                </Button>
              ))}
            </div>
          </aside>

          <main className="border-border-light min-w-0 border-b p-4 sm:p-5 lg:overflow-y-auto lg:border-r lg:border-b-0">
            {current ? (
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)_110px]">
                  <label className="text-text-secondary text-xs font-bold">
                    组编号
                    <TextField.Root
                      value={current.section}
                      onChange={(event) =>
                        updateGroup((group) => ({ ...group, section: event.target.value }))
                      }
                      size="2"
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="text-text-secondary text-xs font-bold">
                    练习说明
                    <TextField.Root
                      value={current.instruction}
                      onChange={(event) =>
                        updateGroup((group) => ({ ...group, instruction: event.target.value }))
                      }
                      size="2"
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="text-text-secondary text-xs font-bold">
                    原书页码
                    <TextField.Root
                      type="number"
                      value={current.bookPage ?? ''}
                      onChange={(event) =>
                        updateGroup((group) => ({
                          ...group,
                          bookPage:
                            event.target.value === '' ? undefined : Number(event.target.value),
                        }))
                      }
                      size="2"
                      className="mt-1 w-full"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-text-primary text-sm font-black">题目</h3>
                  <Button
                    type="button"
                    onClick={() =>
                      updateGroup((group) => ({
                        ...group,
                        items: [...group.items, emptyItem(nextQuestionNumber(group.items))],
                      }))
                    }
                    variant="solid"
                    color="blue"
                    size="1"
                  >
                    ＋ 添加题目
                  </Button>
                </div>

                <div className="flex flex-col gap-3">
                  {current.items.map((item, itemIndex) => (
                    <article
                      key={itemIndex}
                      className="bg-surface-dim/45 ring-border-light rounded-xl p-3 ring-1"
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <TextField.Root
                          size="2"
                          type="number"
                          min={1}
                          value={item.number}
                          aria-label={`第 ${itemIndex + 1} 题题号`}
                          onChange={(event) =>
                            updateItem(itemIndex, (value) => ({
                              ...value,
                              number: Number(event.target.value),
                            }))
                          }
                          className="w-20"
                        />
                        <FormSelect
                          size="2"
                          value={item.type}
                          ariaLabel={`第 ${itemIndex + 1} 题题型`}
                          onValueChange={(next) =>
                            updateItem(itemIndex, (value) => ({
                              ...value,
                              type: next as GrammarExerciseType,
                            }))
                          }
                          options={EXERCISE_TYPES}
                        />
                        <div className="ml-auto flex gap-1">
                          <IconButton
                            type="button"
                            onClick={() =>
                              updateGroup((group) => ({
                                ...group,
                                items: moveEditorItem(group.items, itemIndex, itemIndex - 1),
                              }))
                            }
                            disabled={itemIndex === 0}
                            variant="outline"
                            color="gray"
                            size="1"
                          >
                            ↑
                          </IconButton>
                          <IconButton
                            type="button"
                            onClick={() =>
                              updateGroup((group) => ({
                                ...group,
                                items: moveEditorItem(group.items, itemIndex, itemIndex + 1),
                              }))
                            }
                            disabled={itemIndex === current.items.length - 1}
                            variant="outline"
                            color="gray"
                            size="1"
                          >
                            ↓
                          </IconButton>
                          <Button
                            type="button"
                            onClick={() =>
                              updateGroup((group) => ({
                                ...group,
                                items: [
                                  ...group.items.slice(0, itemIndex + 1),
                                  {
                                    ...item,
                                    number: nextQuestionNumber(group.items),
                                    options: item.options ? [...item.options] : null,
                                  },
                                  ...group.items.slice(itemIndex + 1),
                                ],
                              }))
                            }
                            variant="outline"
                            color="gray"
                            size="1"
                          >
                            复制
                          </Button>
                          <Button
                            type="button"
                            onClick={() =>
                              updateGroup((group) => ({
                                ...group,
                                items: group.items.filter((_, index) => index !== itemIndex),
                              }))
                            }
                            variant="soft"
                            color="red"
                            size="1"
                          >
                            删除
                          </Button>
                        </div>
                      </div>

                      <label className="text-text-secondary block text-xs font-bold">
                        题干
                        <TextArea
                          value={item.prompt}
                          onChange={(event) =>
                            updateItem(itemIndex, (value) => ({
                              ...value,
                              prompt: event.target.value,
                            }))
                          }
                          size="2"
                          resize="vertical"
                          className="mt-1 w-full"
                        />
                      </label>
                      <Button
                        type="button"
                        onClick={() =>
                          updateItem(itemIndex, (value) => ({
                            ...value,
                            prompt: `${value.prompt}${value.prompt.endsWith(' ') || value.prompt === '' ? '' : ' '}______`,
                          }))
                        }
                        variant="soft"
                        color="blue"
                        size="1"
                        className="mt-1.5"
                      >
                        ＋ 插入填空
                      </Button>
                      <span className="text-text-muted ml-2 text-[11px] font-medium">
                        示例写法：题干 ==&gt; 示例答案 &lt;== 后续题干
                      </span>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="text-text-secondary text-xs font-bold">
                          标准答案
                          <TextArea
                            value={item.answer}
                            onChange={(event) =>
                              updateItem(itemIndex, (value) => ({
                                ...value,
                                answer: event.target.value,
                              }))
                            }
                            placeholder="留空表示开放题"
                            size="2"
                            resize="vertical"
                            className="mt-1 w-full"
                          />
                          <span className="text-text-muted mt-1 block font-medium">
                            单空题有多个可接受答案时，每行填写一个答案。
                          </span>
                        </label>
                        <label className="text-text-secondary text-xs font-bold">
                          选项（每行一个）
                          <TextArea
                            value={(item.options ?? []).join('\n')}
                            onChange={(event) =>
                              updateItem(itemIndex, (value) => ({
                                ...value,
                                options:
                                  event.target.value === '' ? null : event.target.value.split('\n'),
                              }))
                            }
                            size="2"
                            resize="vertical"
                            className="mt-1 w-full"
                          />
                        </label>
                      </div>
                      <label className="text-text-secondary mt-3 block text-xs font-bold">
                        关联学习单元（逗号分隔）
                        <TextField.Root
                          value={(item.studyUnits ?? []).join(', ')}
                          onChange={(event) =>
                            updateItem(itemIndex, (value) => ({
                              ...value,
                              studyUnits: event.target.value
                                .split(/[,，\s]+/)
                                .map(Number)
                                .filter((number) => Number.isFinite(number) && number > 0),
                            }))
                          }
                          size="2"
                          className="mt-1 w-full"
                        />
                      </label>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-text-muted py-16 text-center text-sm">
                暂无练习组，点击左侧“新建组”开始添加。
              </div>
            )}
          </main>

          <GrammarEditorReferencePane
            pageImages={pageImages}
            page={current?.bookPage}
            imageType="exercise"
            previewEmpty={previewGroups.length === 0}
            preview={
              <ExerciseView
                groups={previewGroups}
                isAdmin={false}
                pageImages={[]}
                onGroupResult={() => {}}
                onPreviewFigure={() => {}}
              />
            }
          />
        </div>

        <footer className="border-border-light flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-5">
          {error && (
            <p role="alert" className="text-app-red mr-auto text-sm font-bold">
              {error}
            </p>
          )}
          <Button
            type="button"
            onClick={requestClose}
            disabled={saving}
            variant="outline"
            color="gray"
            size="3"
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            variant="solid"
            color="blue"
            size="3"
          >
            {saving ? '保存中…' : '保存并应用'}
          </Button>
        </footer>
      </div>
    </div>
  )

  return createPortal(editor, document.body)
}
