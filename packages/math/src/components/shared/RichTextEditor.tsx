'use client'

import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import clsx from 'clsx'
import { sanitizeNoteHtml } from '@rosie/math/utils/sanitize-note-html'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = '输入笔记内容…',
  className,
  disabled = false,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        code: false,
      }),
    ],
    content: value || '<p></p>',
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(sanitizeNoteHtml(ed.getHTML()))
    },
    editorProps: {
      attributes: {
        class:
          'min-h-[100px] px-3 py-2 text-[13px] leading-relaxed text-slate-800 outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1.5 [&_p:last-child]:mb-0',
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = sanitizeNoteHtml(editor.getHTML())
    const next = sanitizeNoteHtml(value || '<p></p>')
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  if (!editor) return null

  const btn =
    'rounded-md px-2 py-1 text-[11px] font-bold transition disabled:opacity-40'
  const btnOn = 'bg-teal-600 text-white'
  const btnOff = 'bg-white text-slate-600 hover:bg-slate-50'

  return (
    <div className={clsx('overflow-hidden rounded-xl border border-slate-200 bg-white', className)}>
      <div className="flex flex-wrap gap-1 border-b border-slate-100 bg-slate-50 px-2 py-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={clsx(btn, editor.isActive('bold') ? btnOn : btnOff)}
        >
          B
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={clsx(btn, editor.isActive('bulletList') ? btnOn : btnOff)}
        >
          • 列表
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={clsx(btn, editor.isActive('orderedList') ? btnOn : btnOff)}
        >
          1. 列表
        </button>
      </div>
      <div className="relative">
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
