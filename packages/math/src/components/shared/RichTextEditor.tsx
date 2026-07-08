'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { FontSize, TextStyle } from '@tiptap/extension-text-style'
import clsx from 'clsx'
import {
  RICH_HIGHLIGHT_PRESETS,
  RICH_TEXT_COLOR_PRESETS,
} from '@rosie/math/components/shared/rich-text-colors'
import { RICH_FONT_SIZE_PRESETS } from '@rosie/math/components/shared/rich-text-font-size'
import {
  DEFAULT_RICH_IMG_ALIGN,
  DEFAULT_RICH_IMG_WIDTH_PCT,
  RICH_CONTENT_CLEARFIX_TW,
  RICH_IMG_ALIGN_LABELS,
  RICH_IMG_ALIGN_TW,
  RICH_IMG_ALIGN_VALUES,
  RICH_IMG_BASE_TW,
  RICH_IMG_MOBILE_TW,
  RICH_IMG_SIZE_TW,
  RICH_IMG_WIDTH_PCT_LABELS,
  RICH_IMG_WIDTH_PCTS,
  RichTextImage,
  defaultRichImageAttrs,
  type RichImgAlign,
  type RichImgWidthPct,
  type RichImageAttrs,
} from '@rosie/math/components/shared/rich-text-image'

const ACCEPTED_PASTE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])

const EDITOR_IMG_TW = [
  RICH_IMG_BASE_TW,
  RICH_IMG_SIZE_TW,
  RICH_IMG_ALIGN_TW,
  RICH_IMG_MOBILE_TW,
  RICH_CONTENT_CLEARFIX_TW,
  '[&_img.ProseMirror-selectednode]:ring-2 [&_img.ProseMirror-selectednode]:ring-teal-400',
].join(' ')

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  onUploadImage?: (file: File) => Promise<string | null>
  /** Fill parent height — toolbar fixed, only content scrolls (modal). */
  fillHeight?: boolean
}

function pickClipboardImage(data: DataTransfer): File | null {
  for (const item of data.items) {
    if (item.kind === 'file' && ACCEPTED_PASTE_TYPES.has(item.type)) {
      const file = item.getAsFile()
      if (file) return file
    }
  }
  return null
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = '输入内容…',
  className,
  disabled = false,
  onUploadImage,
  fillHeight = false,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const onUploadImageRef = useRef(onUploadImage)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageSelected, setImageSelected] = useState(false)
  const [activeImgWidthPct, setActiveImgWidthPct] = useState<RichImgWidthPct>(DEFAULT_RICH_IMG_WIDTH_PCT)
  const [activeImgAlign, setActiveImgAlign] = useState<RichImgAlign>(DEFAULT_RICH_IMG_ALIGN)
  const allowImages = Boolean(onUploadImage)

  onUploadImageRef.current = onUploadImage

  const insertImageFile = useCallback(async (file: File) => {
    const editor = editorRef.current
    const upload = onUploadImageRef.current
    if (!editor || !upload || disabled || uploadingImage) return
    setUploadingImage(true)
    try {
      const url = await upload(file)
      if (url) {
        editor
          .chain()
          .focus()
          .setImage(defaultRichImageAttrs(url) as RichImageAttrs)
          .run()
      }
    } finally {
      setUploadingImage(false)
    }
  }, [disabled, uploadingImage])

  const insertImageFileRef = useRef(insertImageFile)
  insertImageFileRef.current = insertImageFile

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        code: false,
      }),
      TextStyle,
      FontSize,
      Color.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true }),
      ...(allowImages ? [RichTextImage.configure({ inline: false, allowBase64: false })] : []),
    ],
    content: value || '<p></p>',
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const active = ed.isActive('image')
      setImageSelected(active)
      if (active) {
        const attrs = ed.getAttributes('image')
        const widthPct = Number(attrs.imgWidthPct) as RichImgWidthPct
        const align = attrs.imgAlign as RichImgAlign | undefined
        setActiveImgWidthPct(
          RICH_IMG_WIDTH_PCTS.includes(widthPct) ? widthPct : DEFAULT_RICH_IMG_WIDTH_PCT,
        )
        setActiveImgAlign(
          align && RICH_IMG_ALIGN_VALUES.includes(align) ? align : DEFAULT_RICH_IMG_ALIGN,
        )
      }
    },
    editorProps: {
      attributes: {
        class: clsx(
          fillHeight ? 'min-h-[200px]' : 'min-h-[88px]',
          'px-3 py-2 text-[13px] leading-relaxed text-slate-800 outline-none',
          '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_p]:mb-1.5 [&_p:last-child]:mb-0',
          '[&_mark]:rounded-sm [&_mark]:px-0.5',
          allowImages && EDITOR_IMG_TW,
        ),
      },
      handlePaste: (_view, event) => {
        if (!onUploadImageRef.current || disabled) return false
        const file = event.clipboardData ? pickClipboardImage(event.clipboardData) : null
        if (!file) return false
        event.preventDefault()
        void insertImageFileRef.current(file)
        return true
      },
    },
  })

  editorRef.current = editor

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = value || '<p></p>'
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled && !uploadingImage)
  }, [editor, disabled, uploadingImage])

  if (!editor) return null

  const btn =
    'rounded-md px-2 py-1 text-[11px] font-bold transition disabled:opacity-40'
  const btnOn = 'bg-teal-600 text-white'
  const btnOff = 'bg-white text-slate-600 hover:bg-slate-50'

  const busy = disabled || uploadingImage

  /** Keep text/image selection when clicking toolbar controls. */
  function keepEditorSelection(e: React.MouseEvent) {
    e.preventDefault()
  }

  function updateSelectedImage(attrs: Partial<RichImageAttrs>) {
    editor!.chain().focus().updateAttributes('image', attrs as RichImageAttrs).run()
    if (attrs.imgWidthPct !== undefined) setActiveImgWidthPct(attrs.imgWidthPct)
    if (attrs.imgAlign !== undefined) setActiveImgAlign(attrs.imgAlign)
  }

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-xl border border-slate-200 bg-white',
        fillHeight && 'flex min-h-0 flex-1 flex-col',
        className,
      )}
    >
      <div className="sticky top-0 z-10 flex shrink-0 flex-wrap gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
        <button
          type="button"
          disabled={busy}
          onMouseDown={keepEditorSelection}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={clsx(btn, editor.isActive('bold') ? btnOn : btnOff)}
        >
          B
        </button>
        <span className="self-center px-0.5 text-[10px] text-slate-400">|</span>
        <span className="self-center text-[10px] font-semibold text-slate-500">字号</span>
        {RICH_FONT_SIZE_PRESETS.map(({ value, label }) => {
          const activeFontSize = editor.getAttributes('textStyle').fontSize as string | undefined
          const active = value ? activeFontSize === value : !activeFontSize
          return (
            <button
              key={value || 'default'}
              type="button"
              disabled={busy}
              title={value ? `${label}px` : '默认字号'}
              onMouseDown={keepEditorSelection}
              onClick={() => {
                if (!value) editor.chain().focus().unsetFontSize().run()
                else editor.chain().focus().setFontSize(value).run()
              }}
              className={clsx(btn, active ? btnOn : btnOff, 'min-w-[1.75rem]')}
            >
              {label}
            </button>
          )
        })}
        <span className="self-center px-0.5 text-[10px] text-slate-400">|</span>
        <span className="self-center text-[10px] font-semibold text-slate-500">字色</span>
        {RICH_TEXT_COLOR_PRESETS.map(({ value, label, swatch }) => {
          const active = value
            ? editor.isActive('textStyle', { color: value })
            : !editor.getAttributes('textStyle').color
          return (
            <button
              key={value || 'default'}
              type="button"
              disabled={busy}
              title={label}
              onMouseDown={keepEditorSelection}
              onClick={() => {
                if (!value) editor.chain().focus().unsetColor().run()
                else editor.chain().focus().setColor(value).run()
              }}
              className={clsx(
                'h-5 w-5 rounded border transition',
                active ? 'border-teal-600 ring-2 ring-teal-400' : 'border-slate-300',
                !value && 'flex items-center justify-center text-[9px] font-bold text-slate-600',
              )}
              style={value ? { backgroundColor: swatch } : undefined}
            >
              {!value ? 'A' : null}
            </button>
          )
        })}
        <span className="self-center px-0.5 text-[10px] text-slate-400">|</span>
        <span className="self-center text-[10px] font-semibold text-slate-500">荧光</span>
        {RICH_HIGHLIGHT_PRESETS.map(({ value, label, swatch }) => {
          const active = value
            ? editor.isActive('highlight', { color: value })
            : !editor.isActive('highlight')
          return (
            <button
              key={value || 'none'}
              type="button"
              disabled={busy}
              title={label}
              onMouseDown={keepEditorSelection}
              onClick={() => {
                if (!value) editor.chain().focus().unsetHighlight().run()
                else editor.chain().focus().setHighlight({ color: value }).run()
              }}
              className={clsx(
                'h-5 w-5 rounded border transition',
                active ? 'border-teal-600 ring-2 ring-teal-400' : 'border-slate-300',
                !value && 'flex items-center justify-center text-[9px] text-slate-400',
              )}
              style={{ backgroundColor: swatch }}
            >
              {!value ? '×' : null}
            </button>
          )
        })}
        <span className="self-center px-0.5 text-[10px] text-slate-400">|</span>
        <button
          type="button"
          disabled={busy}
          onMouseDown={keepEditorSelection}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={clsx(btn, editor.isActive('bulletList') ? btnOn : btnOff)}
        >
          • 列表
        </button>
        <button
          type="button"
          disabled={busy}
          onMouseDown={keepEditorSelection}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={clsx(btn, editor.isActive('orderedList') ? btnOn : btnOff)}
        >
          1. 列表
        </button>
        {allowImages && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void insertImageFile(file)
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className={clsx(btn, btnOff)}
            >
              {uploadingImage ? '上传中…' : '🖼 插图'}
            </button>
            {imageSelected && (
              <>
                <span className="self-center px-0.5 text-[10px] text-slate-400">|</span>
                <span className="self-center text-[10px] font-semibold text-slate-500">宽</span>
                {RICH_IMG_WIDTH_PCTS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    disabled={busy}
                    onMouseDown={keepEditorSelection}
                    onClick={() => updateSelectedImage({ imgWidthPct: pct })}
                    className={clsx(btn, activeImgWidthPct === pct ? btnOn : btnOff)}
                  >
                    {RICH_IMG_WIDTH_PCT_LABELS[pct]}
                  </button>
                ))}
                <span className="self-center px-0.5 text-[10px] text-slate-400">|</span>
                <span className="self-center text-[10px] font-semibold text-slate-500">位</span>
                {RICH_IMG_ALIGN_VALUES.map((align) => (
                  <button
                    key={align}
                    type="button"
                    disabled={busy}
                    onMouseDown={keepEditorSelection}
                    onClick={() => updateSelectedImage({ imgAlign: align })}
                    className={clsx(btn, activeImgAlign === align ? btnOn : btnOff)}
                  >
                    {RICH_IMG_ALIGN_LABELS[align]}
                  </button>
                ))}
              </>
            )}
          </>
        )}
      </div>
      <div
        className={clsx(
          'relative',
          fillHeight ? 'min-h-0 flex-1 overflow-y-auto' : 'max-h-[180px] overflow-y-auto',
        )}
      >
        <EditorContent editor={editor} />
        {editor.isEmpty && (
          <div className="pointer-events-none absolute left-3 top-2 text-[13px] text-slate-400">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  )
}
