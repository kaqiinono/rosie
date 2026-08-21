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
import { GrammarEditorReferencePane, moveEditorItem, useEditorDismissGuard } from './GrammarEditorShared'
import { GrammarTableEditorModal } from './GrammarTableEditorModal'
import { LessonView } from './LessonView'

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

function toggleMarkStyle(marks: GrammarTableTextMark[], start: number, end: number, style: GrammarTableTextStyle): GrammarTableTextMark[] {
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
    ? cleaned.map((mark) => mark === target ? { ...mark, styles: [...mark.styles, style] } : mark)
    : [...cleaned, { start, end, styles: [style] }]
}

function cloneLesson(lesson: GrammarLesson): GrammarLesson {
  return structuredClone(lesson)
}

function createBlock(type: GrammarBlock['type']): GrammarBlock {
  switch (type) {
    case 'example_set': return { type, displayType: 'cards', context: '', items: [{ en: '', zh: '' }] }
    case 'examples': return { type, items: [{ en: '', zh: '' }] }
    case 'vocabulary_list': return { type, items: [{ en: '', zh: '' }] }
    case 'grammar_table': return { type, displayType: 'standard', title: '', headers: ['', ''], rows: [['', '']] }
    case 'contraction_note': return { type, items: [{ full: '', short: '' }] }
    case 'rule_text': return { type, tone: 'info', text: '' }
    case 'spelling_rule': return { type, text: '', examples: [{ base: '', form: '' }] }
    case 'image_description': return { type, text: '' }
    case 'tip': return { type, text: '' }
    case 'unsupported': return { type, originalType: 'unknown', text: '' }
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
  const [ruleSelection, setRuleSelection] = useState<{ blockIndex: number; start: number; end: number } | null>(null)
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
    setDraft((value) => ({ ...value, sections: moveEditorItem(value.sections, activeSection, target) }))
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
    updateCurrent((section) => ({ ...section, blocks: [...section.blocks, createBlock(newBlockType)] }))
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
      if (block.type !== 'example_set' && block.type !== 'examples' && block.type !== 'vocabulary_list') return block
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
      if (block.type !== 'example_set' && block.type !== 'examples' && block.type !== 'vocabulary_list') return block
      return { ...block, items: [...block.items, { en: '', zh: '' }] }
    })
  }

  const deleteExample = (blockIndex: number, itemIndex: number) => {
    updateCurrent((section) => ({
      ...section,
      blocks: section.blocks.map((block, index) => {
        if (index !== blockIndex || (block.type !== 'example_set' && block.type !== 'examples' && block.type !== 'vocabulary_list')) {
          return block
        }
        return { ...block, items: block.items.filter((_, item) => item !== itemIndex) }
      }),
    }))
  }

  const moveExample = (blockIndex: number, itemIndex: number, direction: -1 | 1) => {
    updateBlock(blockIndex, (block) => {
      if (block.type !== 'example_set' && block.type !== 'examples' && block.type !== 'vocabulary_list') return block
      return { ...block, items: moveEditorItem(block.items, itemIndex, itemIndex + direction) }
    })
  }

  const copyExample = (blockIndex: number, itemIndex: number) => {
    updateBlock(blockIndex, (block) => {
      if (block.type !== 'example_set' && block.type !== 'examples' && block.type !== 'vocabulary_list') return block
      return {
        ...block,
        items: [...block.items.slice(0, itemIndex + 1), structuredClone(block.items[itemIndex]), ...block.items.slice(itemIndex + 1)],
      }
    })
  }

  const applyRuleTextStyle = (blockIndex: number, style: GrammarTableTextStyle) => {
    if (!ruleSelection || ruleSelection.blockIndex !== blockIndex) return
    updateBlock(blockIndex, (block) => {
      if (block.type !== 'rule_text' && block.type !== 'tip' && block.type !== 'image_description' && block.type !== 'spelling_rule') return block
      const textMarks = toggleMarkStyle(block.textMarks ?? [], ruleSelection.start, ruleSelection.end, style)
      return { ...block, textMarks }
    })
  }

  const clearRuleTextStyles = (blockIndex: number) => {
    if (!ruleSelection || ruleSelection.blockIndex !== blockIndex) return
    updateBlock(blockIndex, (block) => block.type === 'rule_text' || block.type === 'tip' || block.type === 'image_description' || block.type === 'spelling_rule'
      ? {
          ...block,
          textMarks: (block.textMarks ?? []).filter(
            (mark) => mark.end <= ruleSelection.start || mark.start >= ruleSelection.end,
          ),
        }
      : block)
  }

  const applyExampleTextStyle = (blockIndex: number, style: GrammarTableTextStyle) => {
    if (!exampleSelection || exampleSelection.blockIndex !== blockIndex) return
    updateBlock(blockIndex, (block) => {
      if (block.type !== 'example_set' && block.type !== 'examples' && block.type !== 'vocabulary_list') return block
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
      if (block.type !== 'example_set' && block.type !== 'examples' && block.type !== 'vocabulary_list') return block
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
        items: block.items.map((item, index) => index === exampleSelection.itemIndex
          ? { ...item, textMarks: { ...item.textMarks, [field]: (item.textMarks?.[field] ?? []).filter(outsideSelection) } }
          : item),
      }
    })
  }

  const renderExampleStyleToolbar = (blockIndex: number, itemIndex: number | null) => {
    const active = exampleSelection?.blockIndex === blockIndex && exampleSelection.itemIndex === itemIndex
    const block = current?.blocks[blockIndex]
    const activeMarks = !active || !block || (block.type !== 'example_set' && block.type !== 'examples' && block.type !== 'vocabulary_list')
      ? []
      : exampleSelection.field === 'context' && block.type === 'example_set'
        ? block.contextMarks ?? []
        : itemIndex !== null ? block.items[itemIndex]?.textMarks?.[exampleSelection.field as 'en' | 'zh' | 'note'] ?? [] : []
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-surface p-1.5 ring-1 ring-border-light">
        <span className="px-1 text-[11px] font-bold text-text-muted">{active ? '已选文字' : '选中文字后格式化'}</span>
        {RULE_TEXT_STYLES.map(({ style, label, title }) => (
          (() => {
            const selected = activeMarks.some((mark) => mark.start === exampleSelection?.start && mark.end === exampleSelection?.end && mark.styles.includes(style))
            const swatchClass = style === 'text-blue' ? 'bg-app-blue' : style === 'text-red' ? 'bg-app-red' : style === 'text-green' ? 'bg-app-green' : style === 'highlight' ? 'bg-amber-300' : ''
            return <button key={style} type="button" title={title} aria-pressed={selected} disabled={!active} onMouseDown={(event) => event.preventDefault()} onClick={() => applyExampleTextStyle(blockIndex, style)} className={`min-h-8 min-w-8 cursor-pointer rounded-md px-2 text-[11px] font-bold text-text-secondary ring-1 disabled:cursor-not-allowed disabled:opacity-35 ${selected ? 'bg-app-blue-light ring-2 ring-app-blue' : 'bg-surface-dim ring-border-light'} ${style === 'italic' ? 'italic' : ''} ${style === 'underline' ? 'underline' : ''}`}>{swatchClass ? <span aria-hidden="true" className={`mx-auto block h-4 w-4 rounded ${swatchClass} ring-1 ring-black/10`} /> : label}</button>
          })()
        ))}
        <button
          type="button"
          disabled={!active}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => clearExampleTextStyles(blockIndex)}
          className="min-h-8 cursor-pointer rounded-md px-2 text-[11px] font-bold text-app-red ring-1 ring-app-red/20 disabled:cursor-not-allowed disabled:opacity-35"
        >
          清除
        </button>
      </div>
    )
  }

  const renderRuleStyleButton = (blockIndex: number, style: GrammarTableTextStyle, label: string, title: string) => {
    const block = current?.blocks[blockIndex]
    const marks = block && (block.type === 'rule_text' || block.type === 'tip' || block.type === 'image_description' || block.type === 'spelling_rule')
      ? block.textMarks ?? []
      : []
    const selected = ruleSelection?.blockIndex === blockIndex && marks.some(
      (mark) => mark.start === ruleSelection.start && mark.end === ruleSelection.end && mark.styles.includes(style),
    )
    const swatchClass = style === 'text-blue' ? 'bg-app-blue' : style === 'text-red' ? 'bg-app-red' : style === 'text-green' ? 'bg-app-green' : style === 'highlight' ? 'bg-amber-300' : ''
    return (
      <button key={style} type="button" title={title} aria-pressed={selected} disabled={ruleSelection?.blockIndex !== blockIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => applyRuleTextStyle(blockIndex, style)} className={`min-h-8 min-w-8 cursor-pointer rounded-md px-2 text-[11px] font-bold text-text-secondary ring-1 disabled:cursor-not-allowed disabled:opacity-35 ${selected ? 'bg-app-blue-light ring-2 ring-app-blue' : 'bg-surface-dim ring-border-light'} ${style === 'italic' ? 'italic' : ''} ${style === 'underline' ? 'underline' : ''}`}>
        {swatchClass ? <span aria-hidden="true" className={`mx-auto block h-4 w-4 rounded ${swatchClass} ring-1 ring-black/10`} /> : label}
      </button>
    )
  }

  const handleSave = async () => {
    if (draft.sections.some((section) => section.blocks.length === 0)) {
      setError('每个讲解分区至少需要一个内容块')
      return
    }
    const hasEmptyRequiredContent = draft.sections.some((section) => section.blocks.some((block) => {
      if (block.type === 'example_set' || block.type === 'examples' || block.type === 'vocabulary_list') {
        return block.items.length === 0 || block.items.some((item) => item.en.trim() === '')
      }
      if (block.type === 'contraction_note') return block.items.length === 0 || block.items.some((item) => !item.full.trim() || !item.short.trim())
      if (block.type === 'spelling_rule') return !block.text.trim()
      if (block.type === 'grammar_table') return block.headers.length === 0 || block.rows.length === 0
      if (block.type === 'unsupported') return false
      return block.text.trim() === ''
    }))
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
      <div className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-surface shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-border-light px-4 py-3 sm:px-6">
          <div>
            <h2 id="grammar-lesson-editor-title" className="font-black text-text-primary">
              管理讲解
            </h2>
            <p className="text-xs text-text-muted">编辑分区和内容块，右侧对照原书或实时预览</p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            aria-label="关闭讲解编辑器"
            className="min-h-11 min-w-11 rounded-full text-xl font-bold text-text-secondary hover:bg-surface-dim disabled:opacity-40"
          >
            ×
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[190px_minmax(0,1fr)_500px] lg:overflow-hidden">
          <aside className="border-b border-border-light bg-surface-dim/50 p-3 lg:overflow-y-auto lg:border-r lg:border-b-0">
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              <button type="button" onClick={addSection} className="min-h-9 rounded-lg bg-app-blue text-xs font-bold text-white">＋ 新建分区</button>
              <button type="button" onClick={copySection} disabled={!current} className="min-h-9 rounded-lg bg-surface text-xs font-bold text-text-secondary ring-1 ring-border-light disabled:opacity-35">复制分区</button>
            </div>
            <div className="mb-2 grid grid-cols-3 gap-1">
              <button type="button" onClick={() => moveSection(-1)} disabled={activeSection === 0} className="min-h-8 rounded-md bg-surface text-xs font-bold text-text-secondary disabled:opacity-30">↑</button>
              <button type="button" onClick={() => moveSection(1)} disabled={activeSection >= draft.sections.length - 1} className="min-h-8 rounded-md bg-surface text-xs font-bold text-text-secondary disabled:opacity-30">↓</button>
              <button type="button" onClick={deleteSection} disabled={!current} className="min-h-8 rounded-md bg-app-red-light text-xs font-bold text-app-red disabled:opacity-30">删除</button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
              {draft.sections.map((section, index) => (
                <button
                  key={`${section.label ?? 'section'}-${index}`}
                  type="button"
                  onClick={() => setActiveSection(index)}
                  className={`min-h-10 min-w-28 rounded-lg px-2 text-left text-xs font-bold ring-1 ${
                    index === activeSection
                      ? 'bg-app-blue-light text-app-blue-dark ring-app-blue/30'
                      : 'bg-surface text-text-secondary ring-border-light hover:bg-white'
                  }`}
                >
                  <span className="block">
                    {section.label ? `${section.label} · ` : ''}{section.title || `分区 ${index + 1}`}
                  </span>
                  <span className="mt-0.5 block text-[11px] opacity-70">{section.blocks.length} 个内容块</span>
                </button>
              ))}
            </div>
          </aside>

          <main className="min-w-0 border-b border-border-light p-4 sm:p-5 lg:overflow-y-auto lg:border-r lg:border-b-0">
            {current ? (
              <div className="mx-auto max-w-4xl">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-app-blue">{current.label || `分区 ${activeSection + 1}`}</p>
                    <h3 className="mt-0.5 text-xl font-black text-text-primary">{current.title || '无标题分区'}</h3>
                    <p className="mt-1 text-xs text-text-muted">删除操作只修改草稿，点击“保存讲解”后才会生效。</p>
                  </div>
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

                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-text-primary">内容块</h3>
                  <div className="flex min-w-0 gap-2">
                    <select value={newBlockType} onChange={(event) => setNewBlockType(event.target.value as GrammarBlock['type'])} aria-label="新增内容块类型" className="min-h-9 min-w-0 rounded-lg bg-surface px-2 text-xs font-bold text-text-primary ring-1 ring-border-light">
                      {Object.entries(BLOCK_LABELS).filter(([type]) => type !== 'unsupported').map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                    </select>
                    <button type="button" onClick={addBlock} className="min-h-9 shrink-0 rounded-full bg-app-blue px-4 text-xs font-bold text-white">＋ 添加内容块</button>
                  </div>
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
                          <button type="button" onClick={() => copyBlock(blockIndex)} className="min-h-9 rounded-lg bg-surface-dim px-2 text-xs font-black text-text-secondary">复制</button>
                          <button type="button" onClick={() => deleteBlock(blockIndex)} className="min-h-9 rounded-lg bg-app-red-light px-3 text-xs font-black text-app-red">删除内容块</button>
                        </div>
                      </div>

                      {(block.type === 'examples' || block.type === 'vocabulary_list') && (
                        <label className="mt-4 flex max-w-sm items-center gap-3 text-xs font-black text-text-secondary">
                          <span className="shrink-0">展示类型</span>
                          <select
                            value={block.type}
                            onChange={(event) => updateBlock(blockIndex, (value) =>
                              value.type === 'examples' || value.type === 'vocabulary_list'
                                ? { ...value, type: event.target.value as 'examples' | 'vocabulary_list' }
                                : value,
                            )}
                            className="min-h-10 flex-1 rounded-lg bg-surface px-3 text-sm font-bold text-text-primary ring-1 ring-border-light"
                          >
                            <option value="examples">例句列表</option>
                            <option value="vocabulary_list">词汇清单</option>
                          </select>
                        </label>
                      )}

                      {block.type === 'example_set' && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                          <label className="block text-xs font-black text-text-secondary">
                            情境说明
                            <input
                              value={block.context}
                              onSelect={(event) => {
                                const start = event.currentTarget.selectionStart ?? 0
                                const end = event.currentTarget.selectionEnd ?? start
                                setExampleSelection(end > start ? { blockIndex, itemIndex: null, field: 'context', start, end } : null)
                              }}
                              onChange={(event) => updateBlock(blockIndex, (value) =>
                                value.type === 'example_set' ? { ...value, context: event.target.value, contextMarks: [] } : value,
                              )}
                              className="mt-1.5 min-h-11 w-full rounded-xl bg-surface-dim/55 px-3 text-sm font-bold text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40"
                            />
                          </label>
                          <label className="block text-xs font-black text-text-secondary">
                            展示类型
                            <select
                              value={block.displayType ?? 'cards'}
                              onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'example_set'
                                ? { ...value, displayType: event.target.value as ExampleSetDisplayType }
                                : value)}
                              className="mt-1.5 min-h-11 w-full rounded-xl bg-surface px-3 text-sm font-bold text-text-primary ring-1 ring-border-light"
                            >
                              <option value="cards">卡片式</option>
                              <option value="paragraph">文章式</option>
                            </select>
                          </label>
                          <div className="sm:col-span-2">{renderExampleStyleToolbar(blockIndex, null)}</div>
                        </div>
                      )}

                      {(block.type === 'example_set' || block.type === 'examples' || block.type === 'vocabulary_list') && (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {block.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="min-w-0 rounded-xl bg-surface-dim/60 p-3 ring-1 ring-border-light">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-black text-text-muted">{block.type === 'vocabulary_list' ? '词汇' : '例句'} {itemIndex + 1}</span>
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => moveExample(blockIndex, itemIndex, -1)} disabled={itemIndex === 0} aria-label="上移" className="min-h-8 min-w-8 rounded-lg bg-surface text-xs font-bold text-text-secondary disabled:opacity-30">↑</button>
                                  <button type="button" onClick={() => moveExample(blockIndex, itemIndex, 1)} disabled={itemIndex === block.items.length - 1} aria-label="下移" className="min-h-8 min-w-8 rounded-lg bg-surface text-xs font-bold text-text-secondary disabled:opacity-30">↓</button>
                                  <button type="button" onClick={() => copyExample(blockIndex, itemIndex)} className="min-h-8 rounded-lg bg-surface px-2 text-xs font-bold text-text-secondary">复制</button>
                                  <button type="button" onClick={() => deleteExample(blockIndex, itemIndex)} aria-label={`删除例句 ${item.en}`} className="min-h-8 shrink-0 rounded-lg px-2 text-xs font-black text-app-red hover:bg-app-red-light">删除</button>
                                </div>
                              </div>
                              <label className="mt-2 block text-[11px] font-bold text-text-secondary">
                                英文
                                <textarea value={item.en} onSelect={(event) => { const start = event.currentTarget.selectionStart; const end = event.currentTarget.selectionEnd; setExampleSelection(end > start ? { blockIndex, itemIndex, field: 'en', start, end } : null) }} onChange={(event) => updateExample(blockIndex, itemIndex, 'en', event.target.value)} rows={2} className="mt-1 w-full resize-y rounded-lg bg-surface px-3 py-2 text-base font-bold text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40" />
                              </label>
                              <label className="mt-2 block text-[11px] font-bold text-text-secondary">
                                中文辅助
                                <textarea value={item.zh} onSelect={(event) => { const start = event.currentTarget.selectionStart; const end = event.currentTarget.selectionEnd; setExampleSelection(end > start ? { blockIndex, itemIndex, field: 'zh', start, end } : null) }} onChange={(event) => updateExample(blockIndex, itemIndex, 'zh', event.target.value)} rows={1} className="mt-1 w-full resize-y rounded-lg bg-surface px-3 py-2 text-sm text-text-secondary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40" />
                              </label>
                              <label className="mt-2 block text-[11px] font-bold text-text-secondary">
                                补充注释
                                <input value={item.note ?? ''} onSelect={(event) => { const start = event.currentTarget.selectionStart ?? 0; const end = event.currentTarget.selectionEnd ?? start; setExampleSelection(end > start ? { blockIndex, itemIndex, field: 'note', start, end } : null) }} onChange={(event) => updateExample(blockIndex, itemIndex, 'note', event.target.value)} className="mt-1 min-h-10 w-full rounded-lg bg-surface px-3 text-sm text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40" />
                              </label>
                              {renderExampleStyleToolbar(blockIndex, itemIndex)}
                              <label className="mt-2 block text-[11px] font-bold text-text-secondary">
                                强调文字（逗号分隔）
                                <input value={(item.bold ?? []).join(', ')} onChange={(event) => updateBlock(blockIndex, (value) => {
                                  if (value.type !== 'example_set' && value.type !== 'examples' && value.type !== 'vocabulary_list') return value
                                  return { ...value, items: value.items.map((entry, index) => index === itemIndex ? { ...entry, bold: event.target.value.split(/[,，]/).map((part) => part.trim()).filter(Boolean) } : entry) }
                                })} className="mt-1 min-h-10 w-full rounded-lg bg-surface px-3 text-sm text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40" />
                              </label>
                            </div>
                          ))}
                          {block.items.length === 0 && (
                            <p className="rounded-xl bg-surface-dim p-3 text-xs font-bold text-text-muted">该内容块已无例句，可继续删除整个内容块。</p>
                          )}
                          <button type="button" onClick={() => addExample(blockIndex)} className="min-h-11 rounded-xl border border-dashed border-app-blue/35 text-sm font-black text-app-blue hover:bg-app-blue-light">
                            ＋ 添加{block.type === 'vocabulary_list' ? '词汇' : '例句'}
                          </button>
                        </div>
                      )}

                      {block.type === 'rule_text' && (
                        <div className="mt-4 space-y-3">
                          <label className="flex max-w-sm items-center gap-3 text-xs font-black text-text-secondary">
                            <span className="shrink-0">说明状态</span>
                            <select
                              value={block.tone ?? 'info'}
                              onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'rule_text'
                                ? { ...value, tone: event.target.value as RuleTextTone }
                                : value)}
                              className="min-h-10 flex-1 rounded-lg bg-surface px-3 text-sm font-bold text-text-primary ring-1 ring-border-light"
                            >
                              <option value="info">信息 · 蓝色</option>
                              <option value="success">成功 · 绿色</option>
                              <option value="warning">提醒 · 黄色</option>
                              <option value="error">错误 · 红色</option>
                            </select>
                          </label>
                          <label className="block text-xs font-black text-text-secondary">
                            内容
                            <textarea
                              value={block.text}
                              onSelect={(event) => {
                                const start = event.currentTarget.selectionStart
                                const end = event.currentTarget.selectionEnd
                                setRuleSelection(end > start ? { blockIndex, start, end } : null)
                              }}
                              onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'rule_text'
                                ? { ...value, text: event.target.value, textMarks: [] }
                                : value)}
                              rows={4}
                              className="mt-1.5 w-full resize-y rounded-xl bg-surface-dim/55 px-3 py-2 text-sm leading-6 text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40"
                            />
                          </label>
                          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-surface-dim p-1.5 ring-1 ring-border-light">
                            <span className="px-1.5 text-xs font-bold text-text-muted">
                              {ruleSelection?.blockIndex === blockIndex ? '已选文字' : '请先选中文字'}
                            </span>
                            {RULE_TEXT_STYLES.map(({ style, label, title }) => renderRuleStyleButton(blockIndex, style, label, title))}
                            <button
                              type="button"
                              disabled={ruleSelection?.blockIndex !== blockIndex}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => clearRuleTextStyles(blockIndex)}
                              className="min-h-9 cursor-pointer rounded-md px-2.5 text-xs font-bold text-app-red ring-1 ring-app-red/20 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              清除格式
                            </button>
                          </div>
                        </div>
                      )}

                      {(block.type === 'tip' || block.type === 'image_description') && (
                        <div className="mt-4">
                          <label className="block text-xs font-black text-text-secondary">
                            内容
                            <textarea
                              value={block.text}
                              onSelect={(event) => { const start = event.currentTarget.selectionStart; const end = event.currentTarget.selectionEnd; setRuleSelection(end > start ? { blockIndex, start, end } : null) }}
                              onChange={(event) => updateBlock(blockIndex, (value) =>
                                value.type === block.type ? { ...value, text: event.target.value, textMarks: [] } : value,
                              )}
                              rows={4}
                              className="mt-1.5 w-full resize-y rounded-xl bg-surface-dim/55 px-3 py-2 text-sm leading-6 text-text-primary outline-none ring-1 ring-border-light focus:ring-2 focus:ring-app-blue/40"
                            />
                          </label>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {RULE_TEXT_STYLES.map(({ style, label, title }) => renderRuleStyleButton(blockIndex, style, label, title))}
                            <button type="button" disabled={ruleSelection?.blockIndex !== blockIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => clearRuleTextStyles(blockIndex)} className="min-h-8 rounded-md px-2 text-[11px] font-bold text-app-red ring-1 ring-app-red/20 disabled:opacity-35">清除</button>
                          </div>
                        </div>
                      )}

                      {block.type === 'unsupported' && (
                        <label className="mt-4 block text-xs font-black text-text-secondary">内容<textarea value={block.text} readOnly rows={4} className="mt-1.5 w-full resize-y rounded-xl bg-surface-dim/55 px-3 py-2 text-sm leading-6 text-text-primary ring-1 ring-border-light" /></label>
                      )}

                      {block.type === 'contraction_note' && (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {block.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 rounded-xl bg-surface-dim/60 p-3 ring-1 ring-border-light">
                              <input aria-label="完整形式" value={item.full} onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'contraction_note' ? { ...value, items: value.items.map((entry, index) => index === itemIndex ? { ...entry, full: event.target.value } : entry) } : value)} className="min-h-10 min-w-0 rounded-lg bg-surface px-2 text-sm font-bold text-text-primary ring-1 ring-border-light" />
                              <span className="text-text-muted">→</span>
                              <input aria-label="缩写形式" value={item.short} onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'contraction_note' ? { ...value, items: value.items.map((entry, index) => index === itemIndex ? { ...entry, short: event.target.value } : entry) } : value)} className="min-h-10 min-w-0 rounded-lg bg-surface px-2 text-sm font-bold text-text-primary ring-1 ring-border-light" />
                              <div className="flex gap-1">
                                <button type="button" onClick={() => updateBlock(blockIndex, (value) => value.type === 'contraction_note' ? { ...value, items: moveEditorItem(value.items, itemIndex, itemIndex - 1) } : value)} disabled={itemIndex === 0} aria-label="上移缩写项" className="min-h-9 min-w-9 rounded-lg bg-surface text-xs font-bold disabled:opacity-30">↑</button>
                                <button type="button" onClick={() => updateBlock(blockIndex, (value) => value.type === 'contraction_note' ? { ...value, items: moveEditorItem(value.items, itemIndex, itemIndex + 1) } : value)} disabled={itemIndex === block.items.length - 1} aria-label="下移缩写项" className="min-h-9 min-w-9 rounded-lg bg-surface text-xs font-bold disabled:opacity-30">↓</button>
                                <button type="button" onClick={() => updateBlock(blockIndex, (value) => value.type === 'contraction_note' ? { ...value, items: [...value.items.slice(0, itemIndex + 1), { ...item }, ...value.items.slice(itemIndex + 1)] } : value)} className="min-h-9 rounded-lg bg-surface px-2 text-xs font-bold">复制</button>
                                <button type="button" onClick={() => updateBlock(blockIndex, (value) => value.type === 'contraction_note' ? { ...value, items: value.items.filter((_, index) => index !== itemIndex) } : value)} aria-label="删除缩写项" className="min-h-9 rounded-lg px-2 text-xs font-bold text-app-red">删除</button>
                              </div>
                            </div>
                          ))}
                          <button type="button" onClick={() => updateBlock(blockIndex, (value) => value.type === 'contraction_note' ? { ...value, items: [...value.items, { full: '', short: '' }] } : value)} className="min-h-11 rounded-xl border border-dashed border-app-blue/35 text-sm font-black text-app-blue hover:bg-app-blue-light">＋ 添加缩写</button>
                        </div>
                      )}

                      {block.type === 'spelling_rule' && (
                        <div className="mt-4">
                          <label className="block text-xs font-black text-text-secondary">规则文字<textarea value={block.text} onSelect={(event) => { const start = event.currentTarget.selectionStart; const end = event.currentTarget.selectionEnd; setRuleSelection(end > start ? { blockIndex, start, end } : null) }} onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'spelling_rule' ? { ...value, text: event.target.value, textMarks: [] } : value)} rows={3} className="mt-1.5 w-full resize-y rounded-xl bg-surface-dim/55 px-3 py-2 text-sm text-text-primary ring-1 ring-border-light" /></label>
                          <div className="mt-2 flex flex-wrap gap-1.5">{RULE_TEXT_STYLES.map(({ style, label, title }) => renderRuleStyleButton(blockIndex, style, label, title))}</div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            {block.examples.map((item, itemIndex) => (
                              <div key={itemIndex} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 rounded-xl bg-surface-dim/60 p-2 ring-1 ring-border-light">
                                <input aria-label="原形" value={item.base} onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'spelling_rule' ? { ...value, examples: value.examples.map((entry, index) => index === itemIndex ? { ...entry, base: event.target.value } : entry) } : value)} className="min-h-9 min-w-0 rounded-lg bg-surface px-2 text-sm font-bold ring-1 ring-border-light" />
                                <span className="text-text-muted">→</span>
                                <input aria-label="变化形式" value={item.form} onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'spelling_rule' ? { ...value, examples: value.examples.map((entry, index) => index === itemIndex ? { ...entry, form: event.target.value } : entry) } : value)} className="min-h-9 min-w-0 rounded-lg bg-surface px-2 text-sm font-bold ring-1 ring-border-light" />
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => updateBlock(blockIndex, (value) => value.type === 'spelling_rule' ? { ...value, examples: moveEditorItem(value.examples, itemIndex, itemIndex - 1) } : value)} disabled={itemIndex === 0} aria-label="上移拼写例子" className="min-h-9 min-w-9 rounded-lg bg-surface text-xs font-bold disabled:opacity-30">↑</button>
                                  <button type="button" onClick={() => updateBlock(blockIndex, (value) => value.type === 'spelling_rule' ? { ...value, examples: moveEditorItem(value.examples, itemIndex, itemIndex + 1) } : value)} disabled={itemIndex === block.examples.length - 1} aria-label="下移拼写例子" className="min-h-9 min-w-9 rounded-lg bg-surface text-xs font-bold disabled:opacity-30">↓</button>
                                  <button type="button" onClick={() => updateBlock(blockIndex, (value) => value.type === 'spelling_rule' ? { ...value, examples: [...value.examples.slice(0, itemIndex + 1), { ...item }, ...value.examples.slice(itemIndex + 1)] } : value)} className="min-h-9 rounded-lg bg-surface px-2 text-xs font-bold">复制</button>
                                  <button type="button" onClick={() => updateBlock(blockIndex, (value) => value.type === 'spelling_rule' ? { ...value, examples: value.examples.filter((_, index) => index !== itemIndex) } : value)} aria-label="删除拼写例子" className="min-h-9 rounded-lg px-2 text-xs font-bold text-app-red">删除</button>
                                </div>
                              </div>
                            ))}
                            <button type="button" onClick={() => updateBlock(blockIndex, (value) => value.type === 'spelling_rule' ? { ...value, examples: [...value.examples, { base: '', form: '' }] } : value)} className="min-h-11 rounded-xl border border-dashed border-app-blue/35 text-sm font-black text-app-blue hover:bg-app-blue-light">＋ 添加例子</button>
                          </div>
                        </div>
                      )}

                      {block.type === 'grammar_table' && (
                        <div className="mt-4">
                          <label className="block text-xs font-black text-text-secondary">表格标题<input value={block.title} onChange={(event) => updateBlock(blockIndex, (value) => value.type === 'grammar_table' ? { ...value, title: event.target.value } : value)} className="mt-1.5 min-h-10 w-full rounded-lg bg-surface-dim/55 px-3 text-sm font-bold text-text-primary ring-1 ring-border-light" /></label>
                          <button type="button" onClick={() => setTableEditIndex(blockIndex)} className="mt-3 min-h-10 rounded-full bg-app-blue-light px-4 text-xs font-bold text-app-blue-dark ring-1 ring-app-blue/20">编辑表头、单元格与合并</button>
                        </div>
                      )}
                    </article>
                  ))}
                  {current.blocks.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-border-light py-12 text-center text-sm font-bold text-text-muted">该分区已无内容块</div>
                  )}
                </div>

                <section className="mt-6 rounded-2xl bg-surface-dim/45 p-4 ring-1 ring-border-light">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black text-text-primary">相关单元</h3>
                      <p className="text-xs text-text-muted">属于整个讲解，在学生端显示于内容末尾。</p>
                    </div>
                    <button type="button" onClick={() => setDraft((value) => ({ ...value, crossReferences: [...value.crossReferences, { text: '', targetUnit: null }] }))} className="min-h-9 rounded-full bg-app-blue px-4 text-xs font-bold text-white">＋ 添加</button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {draft.crossReferences.map((reference, referenceIndex) => (
                      <div key={referenceIndex} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
                        <input aria-label={`相关单元 ${referenceIndex + 1} 说明`} value={reference.text} onChange={(event) => setDraft((value) => ({ ...value, crossReferences: value.crossReferences.map((item, index) => index === referenceIndex ? { ...item, text: event.target.value } : item) }))} placeholder="例如：参见 Unit 8" className="min-h-10 rounded-lg bg-surface px-3 text-sm text-text-primary ring-1 ring-border-light" />
                        <input aria-label={`相关单元 ${referenceIndex + 1} 编号`} type="number" min={1} value={reference.targetUnit ?? ''} onChange={(event) => setDraft((value) => ({ ...value, crossReferences: value.crossReferences.map((item, index) => index === referenceIndex ? { ...item, targetUnit: event.target.value === '' ? null : Number(event.target.value) } : item) }))} placeholder="Unit" className="min-h-10 rounded-lg bg-surface px-3 text-sm text-text-primary ring-1 ring-border-light" />
                        <button type="button" onClick={() => setDraft((value) => ({ ...value, crossReferences: value.crossReferences.filter((_, index) => index !== referenceIndex) }))} className="min-h-10 rounded-lg px-3 text-xs font-bold text-app-red">删除</button>
                      </div>
                    ))}
                    {draft.crossReferences.length === 0 && <p className="text-xs text-text-muted">暂无相关单元</p>}
                  </div>
                </section>
              </div>
            ) : (
              <div className="flex min-h-64 items-center justify-center text-sm font-bold text-text-muted">讲解中已无分区</div>
            )}
          </main>

          <GrammarEditorReferencePane
            pageImages={pageImages}
            page={current?.bookPage}
            imageType="lesson"
            previewEmpty={draft.sections.length === 0}
            preview={<LessonView data={draft} isAdmin={false} pageImages={[]} onPreviewFigure={() => {}} />}
          />
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border-light bg-surface px-4 py-3 sm:px-6">
          <p className="min-h-5 text-xs font-bold text-app-red">{error}</p>
          <div className="flex gap-2">
            <button type="button" onClick={requestClose} disabled={saving} className="min-h-11 rounded-full px-5 text-sm font-bold text-text-secondary ring-1 ring-border-light disabled:opacity-40">取消</button>
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="min-h-11 rounded-full bg-app-blue px-6 text-sm font-black text-white shadow-md shadow-app-blue/20 disabled:opacity-50">
              {saving ? '保存中…' : '保存并应用'}
            </button>
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
