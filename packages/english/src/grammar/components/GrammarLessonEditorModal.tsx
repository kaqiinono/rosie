'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  ExampleSetDisplayType,
  GrammarBlock,
  GrammarLesson,
  GrammarPageImage,
  GrammarTableBlock,
  GrammarTableTextMark,
  GrammarTableTextStyle,
  RuleTextTone,
} from '../types'
import {
  GrammarEditorReferencePane,
  moveEditorItem,
  useEditorDismissGuard,
} from './GrammarEditorShared'
import { GrammarTableEditorModal } from './GrammarTableEditorModal'
import { LessonView } from './LessonView'
import { FormSelect } from '@rosie/ui'
import { Button, IconButton, TextArea, TextField } from '@rosie/ui/themes'

interface GrammarLessonEditorModalProps {
  lesson: GrammarLesson
  pageImages: GrammarPageImage[]
  onSave: (lesson: GrammarLesson) => Promise<void>
  onClose: () => void
}

const BLOCK_LABELS: Record<GrammarBlock['type'], string> = {
  example_set: '情境例句',
  examples: '例句',
  vocabulary_list: '词汇清单',
  grammar_table: '结构表格',
  contraction_note: '缩写说明',
  rule_text: '规则说明',
  tip: '提示',
  spelling_rule: '拼写规则',
  image_description: '插图描述',
  unsupported: '未识别内容',
}

const RULE_TEXT_STYLES: { style: GrammarTableTextStyle; label: string; title: string }[] = [
  { style: 'bold', label: 'B', title: '粗体' },
  { style: 'italic', label: 'I', title: '斜体' },
  { style: 'underline', label: 'U', title: '下划线' },
  { style: 'text-blue', label: '', title: '蓝色文字' },
  { style: 'text-red', label: '', title: '红色文字' },
  { style: 'text-green', label: '', title: '绿色文字' },
  { style: 'highlight', label: '', title: '背景高亮' },
]

const TEXT_COLOR_STYLES: GrammarTableTextStyle[] = ['text-blue', 'text-red', 'text-green']

function toggleMarkStyle(
  marks: GrammarTableTextMark[],
  start: number,
  end: number,
  style: GrammarTableTextStyle,
): GrammarTableTextMark[] {
  const exact = marks.find((mark) => mark.start === start && mark.end === end)
  const active = exact?.styles.includes(style) === true
  const removable = TEXT_COLOR_STYLES.includes(style) ? TEXT_COLOR_STYLES : [style]
  const cleaned = marks.flatMap((mark) => {
    if (mark.start !== start || mark.end !== end) return [mark]
    const styles = mark.styles.filter((item) => !removable.includes(item))
    return styles.length > 0 ? [{ ...mark, styles }] : []
  })
  if (active) return cleaned
  const target = cleaned.find((mark) => mark.start === start && mark.end === end)
  return target
    ? cleaned.map((mark) => (mark === target ? { ...mark, styles: [...mark.styles, style] } : mark))
    : [...cleaned, { start, end, styles: [style] }]
}

function cloneLesson(lesson: GrammarLesson): GrammarLesson {
  return structuredClone(lesson)
}

function createBlock(type: GrammarBlock['type']): GrammarBlock {
  switch (type) {
    case 'example_set':
      return { type, displayType: 'cards', context: '', items: [{ en: '', zh: '' }] }
    case 'examples':
      return { type, items: [{ en: '', zh: '' }] }
    case 'vocabulary_list':
      return { type, items: [{ en: '', zh: '' }] }
    case 'grammar_table':
      return { type, displayType: 'standard', title: '', headers: ['', ''], rows: [['', '']] }
    case 'contraction_note':
      return { type, items: [{ full: '', short: '' }] }
    case 'rule_text':
      return { type, tone: 'info', text: '' }
    case 'spelling_rule':
      return { type, text: '', examples: [{ base: '', form: '' }] }
    case 'image_description':
      return { type, text: '' }
    case 'tip':
      return { type, text: '' }
    case 'unsupported':
      return { type, originalType: 'unknown', text: '' }
  }
}

function blockSummary(block: GrammarBlock): string {
  switch (block.type) {
    case 'example_set':
      return block.context || `${block.items.length} 条例句`
    case 'examples':
      return `${block.items.length} 条例句`
    case 'vocabulary_list':
      return `${block.items.length} 个词汇`
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
  pageImages,
  onSave,
  onClose,
}: GrammarLessonEditorModalProps) {
  const [draft, setDraft] = useState(() => cloneLesson(lesson))
  const [activeSection, setActiveSection] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ruleSelection, setRuleSelection] = useState<{
    blockIndex: number
    start: number
    end: number
  } | null>(null)
  const [exampleSelection, setExampleSelection] = useState<{
    blockIndex: number
    itemIndex: number | null
    field: 'context' | 'en' | 'zh' | 'note'
    start: number
    end: number
  } | null>(null)
  const [newBlockType, setNewBlockType] = useState<GrammarBlock['type']>('examples')
  const [tableEditIndex, setTableEditIndex] = useState<number | null>(null)
  const current = draft.sections[activeSection]
  const dirty = JSON.stringify(draft) !== JSON.stringify(lesson)
  const requestClose = useEditorDismissGuard({
    dirty,
    saving,
    onClose,
    escapeEnabled: tableEditIndex === null,
  })

  const updateCurrent = (
    update: (section: NonNullable<typeof current>) => NonNullable<typeof current>,
  ) => {
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

  const copySection = () => {
    if (!current) return
    const insertAt = activeSection + 1
    const copy = structuredClone(current)
    copy.title = `${copy.title || `分区 ${activeSection + 1}`} 副本`
    setDraft((value) => ({
      ...value,
      sections: [...value.sections.slice(0, insertAt), copy, ...value.sections.slice(insertAt)],
    }))
    setActiveSection(insertAt)
  }

  const moveSection = (direction: -1 | 1) => {
    const target = activeSection + direction
    if (target < 0 || target >= draft.sections.length) return
    setDraft((value) => ({
      ...value,
      sections: moveEditorItem(value.sections, activeSection, target),
    }))
    setActiveSection(target)
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
      blocks: moveEditorItem(section.blocks, blockIndex, blockIndex + direction),
    }))
  }

  const addBlock = () => {
    updateCurrent((section) => ({
      ...section,
      blocks: [...section.blocks, createBlock(newBlockType)],
    }))
  }

  const copyBlock = (blockIndex: number) => {
    updateCurrent((section) => ({
      ...section,
      blocks: [
        ...section.blocks.slice(0, blockIndex + 1),
        structuredClone(section.blocks[blockIndex]),
        ...section.blocks.slice(blockIndex + 1),
      ],
    }))
  }

  const updateBlock = (blockIndex: number, update: (block: GrammarBlock) => GrammarBlock) => {
    updateCurrent((section) => ({
      ...section,
      blocks: section.blocks.map((block, index) => (index === blockIndex ? update(block) : block)),
    }))
  }

  const updateExample = (
    blockIndex: number,
    itemIndex: number,
    field: 'en' | 'zh' | 'note',
    value: string,
  ) => {
    updateBlock(blockIndex, (block) => {
      if (
        block.type !== 'example_set' &&
        block.type !== 'examples' &&
        block.type !== 'vocabulary_list'
      )
        return block
      return {
        ...block,
        items: block.items.map((item, index) =>
          index === itemIndex
            ? {
                ...item,
                [field]: field === 'note' ? value || null : value,
                textMarks: { ...item.textMarks, [field]: [] },
              }
            : item,
        ),
      }
    })
  }

  const addExample = (blockIndex: number) => {
    updateBlock(blockIndex, (block) => {
      if (
        block.type !== 'example_set' &&
        block.type !== 'examples' &&
        block.type !== 'vocabulary_list'
      )
        return block
      return { ...block, items: [...block.items, { en: '', zh: '' }] }
    })
  }

  const deleteExample = (blockIndex: number, itemIndex: number) => {
    updateCurrent((section) => ({
      ...section,
      blocks: section.blocks.map((block, index) => {
        if (
          index !== blockIndex ||
          (block.type !== 'example_set' &&
            block.type !== 'examples' &&
            block.type !== 'vocabulary_list')
        ) {
          return block
        }
        return { ...block, items: block.items.filter((_, item) => item !== itemIndex) }
      }),
    }))
  }

  const moveExample = (blockIndex: number, itemIndex: number, direction: -1 | 1) => {
    updateBlock(blockIndex, (block) => {
      if (
        block.type !== 'example_set' &&
        block.type !== 'examples' &&
        block.type !== 'vocabulary_list'
      )
        return block
      return { ...block, items: moveEditorItem(block.items, itemIndex, itemIndex + direction) }
    })
  }

  const copyExample = (blockIndex: number, itemIndex: number) => {
    updateBlock(blockIndex, (block) => {
      if (
        block.type !== 'example_set' &&
        block.type !== 'examples' &&
        block.type !== 'vocabulary_list'
      )
        return block
      return {
        ...block,
        items: [
          ...block.items.slice(0, itemIndex + 1),
          structuredClone(block.items[itemIndex]),
          ...block.items.slice(itemIndex + 1),
        ],
      }
    })
  }

  const applyRuleTextStyle = (blockIndex: number, style: GrammarTableTextStyle) => {
    if (!ruleSelection || ruleSelection.blockIndex !== blockIndex) return
    updateBlock(blockIndex, (block) => {
      if (
        block.type !== 'rule_text' &&
        block.type !== 'tip' &&
        block.type !== 'image_description' &&
        block.type !== 'spelling_rule'
      )
        return block
      const textMarks = toggleMarkStyle(
        block.textMarks ?? [],
        ruleSelection.start,
        ruleSelection.end,
        style,
      )
      return { ...block, textMarks }
    })
  }

  const clearRuleTextStyles = (blockIndex: number) => {
    if (!ruleSelection || ruleSelection.blockIndex !== blockIndex) return
    updateBlock(blockIndex, (block) =>
      block.type === 'rule_text' ||
      block.type === 'tip' ||
      block.type === 'image_description' ||
      block.type === 'spelling_rule'
        ? {
            ...block,
            textMarks: (block.textMarks ?? []).filter(
              (mark) => mark.end <= ruleSelection.start || mark.start >= ruleSelection.end,
            ),
          }
        : block,
    )
  }

  const applyExampleTextStyle = (blockIndex: number, style: GrammarTableTextStyle) => {
    if (!exampleSelection || exampleSelection.blockIndex !== blockIndex) return
    updateBlock(blockIndex, (block) => {
      if (
        block.type !== 'example_set' &&
        block.type !== 'examples' &&
        block.type !== 'vocabulary_list'
      )
        return block
      if (exampleSelection.field === 'context') {
        if (block.type !== 'example_set') return block
        const marks = block.contextMarks ?? []
        const next = toggleMarkStyle(marks, exampleSelection.start, exampleSelection.end, style)
        return { ...block, contextMarks: next }
      }
      if (exampleSelection.itemIndex === null) return block
      const field: 'en' | 'zh' | 'note' = exampleSelection.field
      return {
        ...block,
        items: block.items.map((item, index) => {
          if (index !== exampleSelection.itemIndex) return item
          const marks = item.textMarks?.[field] ?? []
          const next = toggleMarkStyle(marks, exampleSelection.start, exampleSelection.end, style)
          return { ...item, textMarks: { ...item.textMarks, [field]: next } }
        }),
      }
    })
  }

  const clearExampleTextStyles = (blockIndex: number) => {
    if (!exampleSelection || exampleSelection.blockIndex !== blockIndex) return
    updateBlock(blockIndex, (block) => {
      if (
        block.type !== 'example_set' &&
        block.type !== 'examples' &&
        block.type !== 'vocabulary_list'
      )
        return block
      const outsideSelection = (mark: { start: number; end: number }) =>
        mark.end <= exampleSelection.start || mark.start >= exampleSelection.end
      if (exampleSelection.field === 'context') {
        return block.type === 'example_set'
          ? { ...block, contextMarks: (block.contextMarks ?? []).filter(outsideSelection) }
          : block
      }
      if (exampleSelection.itemIndex === null) return block
      const field: 'en' | 'zh' | 'note' = exampleSelection.field
      return {
        ...block,
        items: block.items.map((item, index) =>
          index === exampleSelection.itemIndex
            ? {
                ...item,
                textMarks: {
                  ...item.textMarks,
                  [field]: (item.textMarks?.[field] ?? []).filter(outsideSelection),
                },
              }
            : item,
        ),
      }
    })
  }

  const renderExampleStyleToolbar = (blockIndex: number, itemIndex: number | null) => {
    const active =
      exampleSelection?.blockIndex === blockIndex && exampleSelection.itemIndex === itemIndex
    const block = current?.blocks[blockIndex]
    const activeMarks =
      !active ||
      !block ||
      (block.type !== 'example_set' &&
        block.type !== 'examples' &&
        block.type !== 'vocabulary_list')
        ? []
        : exampleSelection.field === 'context' && block.type === 'example_set'
          ? (block.contextMarks ?? [])
          : itemIndex !== null
            ? (block.items[itemIndex]?.textMarks?.[
                exampleSelection.field as 'en' | 'zh' | 'note'
              ] ?? [])
            : []
    return (
      <div className="bg-surface ring-border-light mt-2 flex flex-wrap items-center gap-1.5 rounded-lg p-1.5 ring-1">
        <span className="text-text-muted px-1 text-[11px] font-bold">
          {active ? '已选文字' : '选中文字后格式化'}
        </span>
        {RULE_TEXT_STYLES.map(({ style, label, title }) =>
          (() => {
            const selected = activeMarks.some(
              (mark) =>
                mark.start === exampleSelection?.start &&
                mark.end === exampleSelection?.end &&
                mark.styles.includes(style),
            )
            const swatchClass =
              style === 'text-blue'
                ? 'bg-app-blue'
                : style === 'text-red'
                  ? 'bg-app-red'
                  : style === 'text-green'
                    ? 'bg-app-green'
                    : style === 'highlight'
                      ? 'bg-amber-300'
                      : ''
            return (
              // native-ok: 富文本工具栏按钮，依赖 onMouseDown 阻止默认行为以保留输入框文字选区，且为色块/样式预览
              <button
                key={style}
                type="button"
                title={title}
                aria-pressed={selected}
                disabled={!active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyExampleTextStyle(blockIndex, style)}
                className={`text-text-secondary min-h-8 min-w-8 cursor-pointer rounded-md px-2 text-[11px] font-bold ring-1 disabled:cursor-not-allowed disabled:opacity-35 ${selected ? 'bg-app-blue-light ring-app-blue ring-2' : 'bg-surface-dim ring-border-light'} ${style === 'italic' ? 'italic' : ''} ${style === 'underline' ? 'underline' : ''}`}
              >
                {swatchClass ? (
                  <span
                    aria-hidden="true"
                    className={`mx-auto block h-4 w-4 rounded ${swatchClass} ring-1 ring-black/10`}
                  />
                ) : (
                  label
                )}
              </button>
            )
          })(),
        )}
        <Button
          type="button"
          disabled={!active}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => clearExampleTextStyles(blockIndex)}
          variant="outline"
          color="red"
          size="1"
        >
          清除
        </Button>
      </div>
    )
  }

  const renderRuleStyleButton = (
    blockIndex: number,
    style: GrammarTableTextStyle,
    label: string,
    title: string,
  ) => {
    const block = current?.blocks[blockIndex]
    const marks =
      block &&
      (block.type === 'rule_text' ||
        block.type === 'tip' ||
        block.type === 'image_description' ||
        block.type === 'spelling_rule')
        ? (block.textMarks ?? [])
        : []
    const selected =
      ruleSelection?.blockIndex === blockIndex &&
      marks.some(
        (mark) =>
          mark.start === ruleSelection.start &&
          mark.end === ruleSelection.end &&
          mark.styles.includes(style),
      )
    const swatchClass =
      style === 'text-blue'
        ? 'bg-app-blue'
        : style === 'text-red'
          ? 'bg-app-red'
          : style === 'text-green'
            ? 'bg-app-green'
            : style === 'highlight'
              ? 'bg-amber-300'
              : ''
    return (
      // native-ok: 富文本工具栏按钮，依赖 onMouseDown 阻止默认行为以保留输入框文字选区，且为色块/样式预览
      <button
        key={style}
        type="button"
        title={title}
        aria-pressed={selected}
        disabled={ruleSelection?.blockIndex !== blockIndex}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => applyRuleTextStyle(blockIndex, style)}
        className={`text-text-secondary min-h-8 min-w-8 cursor-pointer rounded-md px-2 text-[11px] font-bold ring-1 disabled:cursor-not-allowed disabled:opacity-35 ${selected ? 'bg-app-blue-light ring-app-blue ring-2' : 'bg-surface-dim ring-border-light'} ${style === 'italic' ? 'italic' : ''} ${style === 'underline' ? 'underline' : ''}`}
      >
        {swatchClass ? (
          <span
            aria-hidden="true"
            className={`mx-auto block h-4 w-4 rounded ${swatchClass} ring-1 ring-black/10`}
          />
        ) : (
          label
        )}
      </button>
    )
  }

  const handleSave = async () => {
    if (draft.sections.some((section) => section.blocks.length === 0)) {
      setError('每个讲解分区至少需要一个内容块')
      return
    }
    const hasEmptyRequiredContent = draft.sections.some((section) =>
      section.blocks.some((block) => {
        if (
          block.type === 'example_set' ||
          block.type === 'examples' ||
          block.type === 'vocabulary_list'
        ) {
          return block.items.length === 0 || block.items.some((item) => item.en.trim() === '')
        }
        if (block.type === 'contraction_note')
          return (
            block.items.length === 0 ||
            block.items.some((item) => !item.full.trim() || !item.short.trim())
          )
        if (block.type === 'spelling_rule') return !block.text.trim()
        if (block.type === 'grammar_table')
          return block.headers.length === 0 || block.rows.length === 0
        if (block.type === 'unsupported') return false
        return block.text.trim() === ''
      }),
    )
    if (hasEmptyRequiredContent) {
      setError('讲解中有未填写的必填内容，请补充后再保存')
      return
    }
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
      <div className="bg-surface shadow-sticker-lg flex h-dvh min-h-0 w-full flex-col overflow-hidden">
        <header className="border-border-light flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-6">
          <div>
            <h2 id="grammar-lesson-editor-title" className="text-text-primary font-black">
              管理讲解
            </h2>
            <p className="text-text-muted text-xs">编辑分区和内容块，右侧对照原书或实时预览</p>
          </div>
          <IconButton
            type="button"
            onClick={requestClose}
            disabled={saving}
            aria-label="关闭讲解编辑器"
            variant="ghost"
            color="gray"
            size="3"
          >
            ×
          </IconButton>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[190px_minmax(0,1fr)_500px] lg:overflow-hidden">
          <aside className="border-border-light bg-surface-dim/50 border-b p-3 lg:overflow-y-auto lg:border-r lg:border-b-0">
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              <Button type="button" onClick={addSection} variant="solid" color="blue" size="1">
                ＋ 新建分区
              </Button>
              <Button
                type="button"
                onClick={copySection}
                disabled={!current}
                variant="outline"
                color="gray"
                size="1"
              >
                复制分区
              </Button>
            </div>
            <div className="mb-2 grid grid-cols-3 gap-1">
              <IconButton
                type="button"
                onClick={() => moveSection(-1)}
                disabled={activeSection === 0}
                variant="outline"
                color="gray"
                size="1"
              >
                ↑
              </IconButton>
              <IconButton
                type="button"
                onClick={() => moveSection(1)}
                disabled={activeSection >= draft.sections.length - 1}
                variant="outline"
                color="gray"
                size="1"
              >
                ↓
              </IconButton>
              <Button
                type="button"
                onClick={deleteSection}
                disabled={!current}
                variant="soft"
                color="red"
                size="1"
              >
                删除
              </Button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
              {draft.sections.map((section, index) => (
                <Button
                  key={`${section.label ?? 'section'}-${index}`}
                  type="button"
                  onClick={() => setActiveSection(index)}
                  variant={index === activeSection ? 'soft' : 'outline'}
                  color={index === activeSection ? 'blue' : 'gray'}
                  size="1"
                >
                  <span className="block">
                    {section.label ? `${section.label} · ` : ''}
                    {section.title || `分区 ${index + 1}`}
                  </span>
                  <span className="mt-0.5 block text-[11px] opacity-70">
                    {section.blocks.length} 个内容块
                  </span>
                </Button>
              ))}
            </div>
          </aside>

          <main className="border-border-light min-w-0 border-b p-4 sm:p-5 lg:overflow-y-auto lg:border-r lg:border-b-0">
            {current ? (
              <div className="mx-auto max-w-4xl">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-app-blue text-xs font-bold">
                      {current.label || `分区 ${activeSection + 1}`}
                    </p>
                    <h3 className="text-text-primary mt-0.5 text-xl font-black">
                      {current.title || '无标题分区'}
                    </h3>
                    <p className="text-text-muted mt-1 text-xs">
                      删除操作只修改草稿，点击“保存讲解”后才会生效。
                    </p>
                  </div>
                </div>

                <div className="bg-app-blue-light/45 ring-app-blue/15 mb-5 grid gap-3 rounded-2xl p-4 ring-1 sm:grid-cols-3">
                  <label className="text-text-secondary text-xs font-black">
                    分区标记
                    <TextField.Root
                      value={current.label ?? ''}
                      onChange={(event) =>
                        updateCurrent((section) => ({
                          ...section,
                          label: event.target.value || null,
                        }))
                      }
                      placeholder="例如 A、B"
                      size="3"
                      className="mt-1.5 w-full"
                    />
                  </label>
                  <label className="text-text-secondary text-xs font-black">
                    分区标题
                    <TextField.Root
                      value={current.title ?? ''}
                      onChange={(event) =>
                        updateCurrent((section) => ({
                          ...section,
                          title: event.target.value || null,
                        }))
                      }
                      placeholder="讲解标题"
                      size="3"
                      className="mt-1.5 w-full"
                    />
                  </label>
                  <label className="text-text-secondary text-xs font-black">
                    原书页码
                    <TextField.Root
                      type="number"
                      min={1}
                      value={current.bookPage ?? ''}
                      onChange={(event) =>
                        updateCurrent((section) => ({
                          ...section,
                          bookPage:
                            event.target.value === '' ? undefined : Number(event.target.value),
                        }))
                      }
                      placeholder="可选"
                      size="3"
                      className="mt-1.5 w-full"
                    />
                  </label>
                </div>

                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-text-primary text-sm font-black">内容块</h3>
                  <div className="flex min-w-0 gap-2">
                    <FormSelect
                      size="2"
                      value={newBlockType}
                      onValueChange={(next) => setNewBlockType(next as GrammarBlock['type'])}
                      ariaLabel="新增内容块类型"
                      className="min-w-0"
                      options={Object.entries(BLOCK_LABELS)
                        .filter(([type]) => type !== 'unsupported')
                        .map(([type, label]) => ({ value: type, label }))}
                    />
                    <Button
                      type="button"
                      onClick={addBlock}
                      variant="solid"
                      color="blue"
                      size="1"
                      className="shrink-0"
                    >
                      ＋ 添加内容块
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {current.blocks.map((block, blockIndex) => (
                    <article
                      key={`${block.type}-${blockIndex}`}
                      className="bg-surface shadow-sticker-sm ring-border-light rounded-2xl p-4 ring-1"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="bg-app-blue-light text-app-blue-dark inline-flex rounded-full px-2.5 py-1 text-[11px] font-black">
                            {BLOCK_LABELS[block.type]}
                          </span>
                          <p className="text-text-primary mt-2 line-clamp-2 text-sm font-bold">
                            {blockSummary(block) || '无摘要'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <IconButton
                            type="button"
                            onClick={() => moveBlock(blockIndex, -1)}
                            disabled={blockIndex === 0}
                            aria-label="上移内容块"
                            variant="soft"
                            color="gray"
                            size="2"
                          >
                            ↑
                          </IconButton>
                          <IconButton
                            type="button"
                            onClick={() => moveBlock(blockIndex, 1)}
                            disabled={blockIndex === current.blocks.length - 1}
                            aria-label="下移内容块"
                            variant="soft"
                            color="gray"
                            size="2"
                          >
                            ↓
                          </IconButton>
                          <Button
                            type="button"
                            onClick={() => copyBlock(blockIndex)}
                            variant="soft"
                            color="gray"
                            size="1"
                          >
                            复制
                          </Button>
                          <Button
                            type="button"
                            onClick={() => deleteBlock(blockIndex)}
                            variant="soft"
                            color="red"
                            size="1"
                          >
                            删除内容块
                          </Button>
                        </div>
                      </div>

                      {(block.type === 'examples' || block.type === 'vocabulary_list') && (
                        <label className="text-text-secondary mt-4 flex max-w-sm items-center gap-3 text-xs font-black">
                          <span className="shrink-0">展示类型</span>
                          <FormSelect
                            size="2"
                            value={block.type}
                            ariaLabel="展示类型"
                            className="flex-1"
                            onValueChange={(next) =>
                              updateBlock(blockIndex, (value) =>
                                value.type === 'examples' || value.type === 'vocabulary_list'
                                  ? {
                                      ...value,
                                      type: next as 'examples' | 'vocabulary_list',
                                    }
                                  : value,
                              )
                            }
                            options={[
                              { value: 'examples', label: '例句列表' },
                              { value: 'vocabulary_list', label: '词汇清单' },
                            ]}
                          />
                        </label>
                      )}

                      {block.type === 'example_set' && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                          <label className="text-text-secondary block text-xs font-black">
                            情境说明
                            <TextField.Root
                              value={block.context}
                              onSelect={(event) => {
                                const start = event.currentTarget.selectionStart ?? 0
                                const end = event.currentTarget.selectionEnd ?? start
                                setExampleSelection(
                                  end > start
                                    ? { blockIndex, itemIndex: null, field: 'context', start, end }
                                    : null,
                                )
                              }}
                              onChange={(event) =>
                                updateBlock(blockIndex, (value) =>
                                  value.type === 'example_set'
                                    ? { ...value, context: event.target.value, contextMarks: [] }
                                    : value,
                                )
                              }
                              size="3"
                              className="mt-1.5 w-full"
                            />
                          </label>
                          <label className="text-text-secondary block text-xs font-black">
                            展示类型
                            <FormSelect
                              size="3"
                              value={block.displayType ?? 'cards'}
                              ariaLabel="展示类型"
                              className="mt-1.5 w-full"
                              onValueChange={(next) =>
                                updateBlock(blockIndex, (value) =>
                                  value.type === 'example_set'
                                    ? {
                                        ...value,
                                        displayType: next as ExampleSetDisplayType,
                                      }
                                    : value,
                                )
                              }
                              options={[
                                { value: 'cards', label: '卡片式' },
                                { value: 'paragraph', label: '文章式' },
                              ]}
                            />
                          </label>
                          <div className="sm:col-span-2">
                            {renderExampleStyleToolbar(blockIndex, null)}
                          </div>
                        </div>
                      )}

                      {(block.type === 'example_set' ||
                        block.type === 'examples' ||
                        block.type === 'vocabulary_list') && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {block.items.map((item, itemIndex) => (
                            <div
                              key={itemIndex}
                              className="bg-surface-dim/60 ring-border-light min-w-0 rounded-xl p-3 ring-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-text-muted text-[11px] font-black">
                                  {block.type === 'vocabulary_list' ? '词汇' : '例句'}{' '}
                                  {itemIndex + 1}
                                </span>
                                <div className="flex gap-1">
                                  <IconButton
                                    type="button"
                                    onClick={() => moveExample(blockIndex, itemIndex, -1)}
                                    disabled={itemIndex === 0}
                                    aria-label="上移"
                                    variant="outline"
                                    color="gray"
                                    size="1"
                                  >
                                    ↑
                                  </IconButton>
                                  <IconButton
                                    type="button"
                                    onClick={() => moveExample(blockIndex, itemIndex, 1)}
                                    disabled={itemIndex === block.items.length - 1}
                                    aria-label="下移"
                                    variant="outline"
                                    color="gray"
                                    size="1"
                                  >
                                    ↓
                                  </IconButton>
                                  <Button
                                    type="button"
                                    onClick={() => copyExample(blockIndex, itemIndex)}
                                    variant="outline"
                                    color="gray"
                                    size="1"
                                  >
                                    复制
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => deleteExample(blockIndex, itemIndex)}
                                    aria-label={`删除例句 ${item.en}`}
                                    variant="ghost"
                                    color="red"
                                    size="1"
                                    className="shrink-0"
                                  >
                                    删除
                                  </Button>
                                </div>
                              </div>
                              <label className="text-text-secondary mt-2 block text-[11px] font-bold">
                                英文
                                <TextArea
                                  value={item.en}
                                  onSelect={(event) => {
                                    const start = event.currentTarget.selectionStart
                                    const end = event.currentTarget.selectionEnd
                                    setExampleSelection(
                                      end > start
                                        ? { blockIndex, itemIndex, field: 'en', start, end }
                                        : null,
                                    )
                                  }}
                                  onChange={(event) =>
                                    updateExample(blockIndex, itemIndex, 'en', event.target.value)
                                  }
                                  rows={2}
                                  size="3"
                                  resize="vertical"
                                  className="mt-1 w-full"
                                />
                              </label>
                              <label className="text-text-secondary mt-2 block text-[11px] font-bold">
                                中文辅助
                                <TextArea
                                  value={item.zh}
                                  onSelect={(event) => {
                                    const start = event.currentTarget.selectionStart
                                    const end = event.currentTarget.selectionEnd
                                    setExampleSelection(
                                      end > start
                                        ? { blockIndex, itemIndex, field: 'zh', start, end }
                                        : null,
                                    )
                                  }}
                                  onChange={(event) =>
                                    updateExample(blockIndex, itemIndex, 'zh', event.target.value)
                                  }
                                  rows={1}
                                  size="2"
                                  resize="vertical"
                                  className="mt-1 w-full"
                                />
                              </label>
                              <label className="text-text-secondary mt-2 block text-[11px] font-bold">
                                补充注释
                                <TextField.Root
                                  value={item.note ?? ''}
                                  onSelect={(event) => {
                                    const start = event.currentTarget.selectionStart ?? 0
                                    const end = event.currentTarget.selectionEnd ?? start
                                    setExampleSelection(
                                      end > start
                                        ? { blockIndex, itemIndex, field: 'note', start, end }
                                        : null,
                                    )
                                  }}
                                  onChange={(event) =>
                                    updateExample(blockIndex, itemIndex, 'note', event.target.value)
                                  }
                                  size="2"
                                  className="mt-1 w-full"
                                />
                              </label>
                              {renderExampleStyleToolbar(blockIndex, itemIndex)}
                              <label className="text-text-secondary mt-2 block text-[11px] font-bold">
                                强调文字（逗号分隔）
                                <TextField.Root
                                  value={(item.bold ?? []).join(', ')}
                                  onChange={(event) =>
                                    updateBlock(blockIndex, (value) => {
                                      if (
                                        value.type !== 'example_set' &&
                                        value.type !== 'examples' &&
                                        value.type !== 'vocabulary_list'
                                      )
                                        return value
                                      return {
                                        ...value,
                                        items: value.items.map((entry, index) =>
                                          index === itemIndex
                                            ? {
                                                ...entry,
                                                bold: event.target.value
                                                  .split(/[,，]/)
                                                  .map((part) => part.trim())
                                                  .filter(Boolean),
                                              }
                                            : entry,
                                        ),
                                      }
                                    })
                                  }
                                  size="2"
                                  className="mt-1 w-full"
                                />
                              </label>
                            </div>
                          ))}
                          {block.items.length === 0 && (
                            <p className="bg-surface-dim text-text-muted rounded-xl p-3 text-xs font-bold">
                              该内容块已无例句，可继续删除整个内容块。
                            </p>
                          )}
                          <Button
                            type="button"
                            onClick={() => addExample(blockIndex)}
                            variant="outline"
                            color="blue"
                            size="3"
                          >
                            ＋ 添加{block.type === 'vocabulary_list' ? '词汇' : '例句'}
                          </Button>
                        </div>
                      )}

                      {block.type === 'rule_text' && (
                        <div className="mt-4 space-y-3">
                          <label className="text-text-secondary flex max-w-sm items-center gap-3 text-xs font-black">
                            <span className="shrink-0">说明状态</span>
                            <FormSelect
                              size="2"
                              value={block.tone ?? 'info'}
                              ariaLabel="说明状态"
                              className="flex-1"
                              onValueChange={(next) =>
                                updateBlock(blockIndex, (value) =>
                                  value.type === 'rule_text'
                                    ? { ...value, tone: next as RuleTextTone }
                                    : value,
                                )
                              }
                              options={[
                                { value: 'info', label: '信息 · 蓝色' },
                                { value: 'success', label: '成功 · 绿色' },
                                { value: 'warning', label: '提醒 · 黄色' },
                                { value: 'error', label: '错误 · 红色' },
                              ]}
                            />
                          </label>
                          <label className="text-text-secondary block text-xs font-black">
                            内容
                            <TextArea
                              value={block.text}
                              onSelect={(event) => {
                                const start = event.currentTarget.selectionStart
                                const end = event.currentTarget.selectionEnd
                                setRuleSelection(end > start ? { blockIndex, start, end } : null)
                              }}
                              onChange={(event) =>
                                updateBlock(blockIndex, (value) =>
                                  value.type === 'rule_text'
                                    ? { ...value, text: event.target.value, textMarks: [] }
                                    : value,
                                )
                              }
                              rows={4}
                              size="2"
                              resize="vertical"
                              className="mt-1.5 w-full"
                            />
                          </label>
                          <div className="bg-surface-dim ring-border-light flex flex-wrap items-center gap-1.5 rounded-lg p-1.5 ring-1">
                            <span className="text-text-muted px-1.5 text-xs font-bold">
                              {ruleSelection?.blockIndex === blockIndex
                                ? '已选文字'
                                : '请先选中文字'}
                            </span>
                            {RULE_TEXT_STYLES.map(({ style, label, title }) =>
                              renderRuleStyleButton(blockIndex, style, label, title),
                            )}
                            <Button
                              type="button"
                              disabled={ruleSelection?.blockIndex !== blockIndex}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => clearRuleTextStyles(blockIndex)}
                              variant="outline"
                              color="red"
                              size="1"
                            >
                              清除格式
                            </Button>
                          </div>
                        </div>
                      )}

                      {(block.type === 'tip' || block.type === 'image_description') && (
                        <div className="mt-4">
                          <label className="text-text-secondary block text-xs font-black">
                            内容
                            <TextArea
                              value={block.text}
                              onSelect={(event) => {
                                const start = event.currentTarget.selectionStart
                                const end = event.currentTarget.selectionEnd
                                setRuleSelection(end > start ? { blockIndex, start, end } : null)
                              }}
                              onChange={(event) =>
                                updateBlock(blockIndex, (value) =>
                                  value.type === block.type
                                    ? { ...value, text: event.target.value, textMarks: [] }
                                    : value,
                                )
                              }
                              rows={4}
                              size="2"
                              resize="vertical"
                              className="mt-1.5 w-full"
                            />
                          </label>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {RULE_TEXT_STYLES.map(({ style, label, title }) =>
                              renderRuleStyleButton(blockIndex, style, label, title),
                            )}
                            <Button
                              type="button"
                              disabled={ruleSelection?.blockIndex !== blockIndex}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => clearRuleTextStyles(blockIndex)}
                              variant="outline"
                              color="red"
                              size="1"
                            >
                              清除
                            </Button>
                          </div>
                        </div>
                      )}

                      {block.type === 'unsupported' && (
                        <label className="text-text-secondary mt-4 block text-xs font-black">
                          内容
                          <TextArea
                            value={block.text}
                            readOnly
                            rows={4}
                            size="2"
                            resize="vertical"
                            className="mt-1.5 w-full"
                          />
                        </label>
                      )}

                      {block.type === 'contraction_note' && (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {block.items.map((item, itemIndex) => (
                            <div
                              key={itemIndex}
                              className="bg-surface-dim/60 ring-border-light grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 rounded-xl p-3 ring-1"
                            >
                              <TextField.Root
                                aria-label="完整形式"
                                value={item.full}
                                onChange={(event) =>
                                  updateBlock(blockIndex, (value) =>
                                    value.type === 'contraction_note'
                                      ? {
                                          ...value,
                                          items: value.items.map((entry, index) =>
                                            index === itemIndex
                                              ? { ...entry, full: event.target.value }
                                              : entry,
                                          ),
                                        }
                                      : value,
                                  )
                                }
                                size="2"
                                className="min-w-0"
                              />
                              <span className="text-text-muted">→</span>
                              <TextField.Root
                                aria-label="缩写形式"
                                value={item.short}
                                onChange={(event) =>
                                  updateBlock(blockIndex, (value) =>
                                    value.type === 'contraction_note'
                                      ? {
                                          ...value,
                                          items: value.items.map((entry, index) =>
                                            index === itemIndex
                                              ? { ...entry, short: event.target.value }
                                              : entry,
                                          ),
                                        }
                                      : value,
                                  )
                                }
                                size="2"
                                className="min-w-0"
                              />
                              <div className="flex gap-1">
                                <IconButton
                                  type="button"
                                  onClick={() =>
                                    updateBlock(blockIndex, (value) =>
                                      value.type === 'contraction_note'
                                        ? {
                                            ...value,
                                            items: moveEditorItem(
                                              value.items,
                                              itemIndex,
                                              itemIndex - 1,
                                            ),
                                          }
                                        : value,
                                    )
                                  }
                                  disabled={itemIndex === 0}
                                  aria-label="上移缩写项"
                                  variant="outline"
                                  color="gray"
                                  size="1"
                                >
                                  ↑
                                </IconButton>
                                <IconButton
                                  type="button"
                                  onClick={() =>
                                    updateBlock(blockIndex, (value) =>
                                      value.type === 'contraction_note'
                                        ? {
                                            ...value,
                                            items: moveEditorItem(
                                              value.items,
                                              itemIndex,
                                              itemIndex + 1,
                                            ),
                                          }
                                        : value,
                                    )
                                  }
                                  disabled={itemIndex === block.items.length - 1}
                                  aria-label="下移缩写项"
                                  variant="outline"
                                  color="gray"
                                  size="1"
                                >
                                  ↓
                                </IconButton>
                                <Button
                                  type="button"
                                  onClick={() =>
                                    updateBlock(blockIndex, (value) =>
                                      value.type === 'contraction_note'
                                        ? {
                                            ...value,
                                            items: [
                                              ...value.items.slice(0, itemIndex + 1),
                                              { ...item },
                                              ...value.items.slice(itemIndex + 1),
                                            ],
                                          }
                                        : value,
                                    )
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
                                    updateBlock(blockIndex, (value) =>
                                      value.type === 'contraction_note'
                                        ? {
                                            ...value,
                                            items: value.items.filter(
                                              (_, index) => index !== itemIndex,
                                            ),
                                          }
                                        : value,
                                    )
                                  }
                                  aria-label="删除缩写项"
                                  variant="ghost"
                                  color="red"
                                  size="1"
                                >
                                  删除
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Button
                            type="button"
                            onClick={() =>
                              updateBlock(blockIndex, (value) =>
                                value.type === 'contraction_note'
                                  ? { ...value, items: [...value.items, { full: '', short: '' }] }
                                  : value,
                              )
                            }
                            variant="outline"
                            color="blue"
                            size="3"
                          >
                            ＋ 添加缩写
                          </Button>
                        </div>
                      )}

                      {block.type === 'spelling_rule' && (
                        <div className="mt-4">
                          <label className="text-text-secondary block text-xs font-black">
                            规则文字
                            <TextArea
                              value={block.text}
                              onSelect={(event) => {
                                const start = event.currentTarget.selectionStart
                                const end = event.currentTarget.selectionEnd
                                setRuleSelection(end > start ? { blockIndex, start, end } : null)
                              }}
                              onChange={(event) =>
                                updateBlock(blockIndex, (value) =>
                                  value.type === 'spelling_rule'
                                    ? { ...value, text: event.target.value, textMarks: [] }
                                    : value,
                                )
                              }
                              rows={3}
                              size="2"
                              resize="vertical"
                              className="mt-1.5 w-full"
                            />
                          </label>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {RULE_TEXT_STYLES.map(({ style, label, title }) =>
                              renderRuleStyleButton(blockIndex, style, label, title),
                            )}
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            {block.examples.map((item, itemIndex) => (
                              <div
                                key={itemIndex}
                                className="bg-surface-dim/60 ring-border-light grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 rounded-xl p-2 ring-1"
                              >
                                <TextField.Root
                                  aria-label="原形"
                                  value={item.base}
                                  onChange={(event) =>
                                    updateBlock(blockIndex, (value) =>
                                      value.type === 'spelling_rule'
                                        ? {
                                            ...value,
                                            examples: value.examples.map((entry, index) =>
                                              index === itemIndex
                                                ? { ...entry, base: event.target.value }
                                                : entry,
                                            ),
                                          }
                                        : value,
                                    )
                                  }
                                  size="2"
                                  className="min-w-0"
                                />
                                <span className="text-text-muted">→</span>
                                <TextField.Root
                                  aria-label="变化形式"
                                  value={item.form}
                                  onChange={(event) =>
                                    updateBlock(blockIndex, (value) =>
                                      value.type === 'spelling_rule'
                                        ? {
                                            ...value,
                                            examples: value.examples.map((entry, index) =>
                                              index === itemIndex
                                                ? { ...entry, form: event.target.value }
                                                : entry,
                                            ),
                                          }
                                        : value,
                                    )
                                  }
                                  size="2"
                                  className="min-w-0"
                                />
                                <div className="flex gap-1">
                                  <IconButton
                                    type="button"
                                    onClick={() =>
                                      updateBlock(blockIndex, (value) =>
                                        value.type === 'spelling_rule'
                                          ? {
                                              ...value,
                                              examples: moveEditorItem(
                                                value.examples,
                                                itemIndex,
                                                itemIndex - 1,
                                              ),
                                            }
                                          : value,
                                      )
                                    }
                                    disabled={itemIndex === 0}
                                    aria-label="上移拼写例子"
                                    variant="outline"
                                    color="gray"
                                    size="1"
                                  >
                                    ↑
                                  </IconButton>
                                  <IconButton
                                    type="button"
                                    onClick={() =>
                                      updateBlock(blockIndex, (value) =>
                                        value.type === 'spelling_rule'
                                          ? {
                                              ...value,
                                              examples: moveEditorItem(
                                                value.examples,
                                                itemIndex,
                                                itemIndex + 1,
                                              ),
                                            }
                                          : value,
                                      )
                                    }
                                    disabled={itemIndex === block.examples.length - 1}
                                    aria-label="下移拼写例子"
                                    variant="outline"
                                    color="gray"
                                    size="1"
                                  >
                                    ↓
                                  </IconButton>
                                  <Button
                                    type="button"
                                    onClick={() =>
                                      updateBlock(blockIndex, (value) =>
                                        value.type === 'spelling_rule'
                                          ? {
                                              ...value,
                                              examples: [
                                                ...value.examples.slice(0, itemIndex + 1),
                                                { ...item },
                                                ...value.examples.slice(itemIndex + 1),
                                              ],
                                            }
                                          : value,
                                      )
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
                                      updateBlock(blockIndex, (value) =>
                                        value.type === 'spelling_rule'
                                          ? {
                                              ...value,
                                              examples: value.examples.filter(
                                                (_, index) => index !== itemIndex,
                                              ),
                                            }
                                          : value,
                                      )
                                    }
                                    aria-label="删除拼写例子"
                                    variant="ghost"
                                    color="red"
                                    size="1"
                                  >
                                    删除
                                  </Button>
                                </div>
                              </div>
                            ))}
                            <Button
                              type="button"
                              onClick={() =>
                                updateBlock(blockIndex, (value) =>
                                  value.type === 'spelling_rule'
                                    ? {
                                        ...value,
                                        examples: [...value.examples, { base: '', form: '' }],
                                      }
                                    : value,
                                )
                              }
                              variant="outline"
                              color="blue"
                              size="3"
                            >
                              ＋ 添加例子
                            </Button>
                          </div>
                        </div>
                      )}

                      {block.type === 'grammar_table' && (
                        <div className="mt-4">
                          <label className="text-text-secondary block text-xs font-black">
                            表格标题
                            <TextField.Root
                              value={block.title}
                              onChange={(event) =>
                                updateBlock(blockIndex, (value) =>
                                  value.type === 'grammar_table'
                                    ? { ...value, title: event.target.value }
                                    : value,
                                )
                              }
                              size="2"
                              className="mt-1.5 w-full"
                            />
                          </label>
                          <Button
                            type="button"
                            onClick={() => setTableEditIndex(blockIndex)}
                            variant="soft"
                            color="blue"
                            size="1"
                            className="mt-3"
                          >
                            编辑表头、单元格与合并
                          </Button>
                        </div>
                      )}
                    </article>
                  ))}
                  {current.blocks.length === 0 && (
                    <div className="border-border-light text-text-muted rounded-2xl border border-dashed py-12 text-center text-sm font-bold">
                      该分区已无内容块
                    </div>
                  )}
                </div>

                <section className="bg-surface-dim/45 ring-border-light mt-6 rounded-2xl p-4 ring-1">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-text-primary text-sm font-black">相关单元</h3>
                      <p className="text-text-muted text-xs">
                        属于整个讲解，在学生端显示于内容末尾。
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() =>
                        setDraft((value) => ({
                          ...value,
                          crossReferences: [
                            ...value.crossReferences,
                            { text: '', targetUnit: null },
                          ],
                        }))
                      }
                      variant="solid"
                      color="blue"
                      size="1"
                    >
                      ＋ 添加
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {draft.crossReferences.map((reference, referenceIndex) => (
                      <div
                        key={referenceIndex}
                        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_auto]"
                      >
                        <TextField.Root
                          aria-label={`相关单元 ${referenceIndex + 1} 说明`}
                          value={reference.text}
                          onChange={(event) =>
                            setDraft((value) => ({
                              ...value,
                              crossReferences: value.crossReferences.map((item, index) =>
                                index === referenceIndex
                                  ? { ...item, text: event.target.value }
                                  : item,
                              ),
                            }))
                          }
                          placeholder="例如：参见 Unit 8"
                          size="2"
                        />
                        <TextField.Root
                          aria-label={`相关单元 ${referenceIndex + 1} 编号`}
                          type="number"
                          min={1}
                          value={reference.targetUnit ?? ''}
                          onChange={(event) =>
                            setDraft((value) => ({
                              ...value,
                              crossReferences: value.crossReferences.map((item, index) =>
                                index === referenceIndex
                                  ? {
                                      ...item,
                                      targetUnit:
                                        event.target.value === ''
                                          ? null
                                          : Number(event.target.value),
                                    }
                                  : item,
                              ),
                            }))
                          }
                          placeholder="Unit"
                          size="2"
                        />
                        <Button
                          type="button"
                          onClick={() =>
                            setDraft((value) => ({
                              ...value,
                              crossReferences: value.crossReferences.filter(
                                (_, index) => index !== referenceIndex,
                              ),
                            }))
                          }
                          variant="ghost"
                          color="red"
                          size="1"
                        >
                          删除
                        </Button>
                      </div>
                    ))}
                    {draft.crossReferences.length === 0 && (
                      <p className="text-text-muted text-xs">暂无相关单元</p>
                    )}
                  </div>
                </section>
              </div>
            ) : (
              <div className="text-text-muted flex min-h-64 items-center justify-center text-sm font-bold">
                讲解中已无分区
              </div>
            )}
          </main>

          <GrammarEditorReferencePane
            pageImages={pageImages}
            page={current?.bookPage}
            imageType="lesson"
            previewEmpty={draft.sections.length === 0}
            preview={
              <LessonView data={draft} isAdmin={false} pageImages={[]} onPreviewFigure={() => {}} />
            }
          />
        </div>

        <footer className="border-border-light bg-surface flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-6">
          <p className="text-app-red min-h-5 text-xs font-bold">{error}</p>
          <div className="flex gap-2">
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
          </div>
        </footer>
        {tableEditIndex !== null && current?.blocks[tableEditIndex]?.type === 'grammar_table' && (
          <GrammarTableEditorModal
            table={current.blocks[tableEditIndex] as GrammarTableBlock}
            onSave={async (table) => {
              updateBlock(tableEditIndex, () => table)
              setTableEditIndex(null)
            }}
            onClose={() => setTableEditIndex(null)}
          />
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
