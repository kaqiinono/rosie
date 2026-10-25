'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { courseSecondaryButtonClass } from './courseFormStyles'

export default function TimetableDialog({ title, onClose, children, className = '', description, bare = false }: { title: string; onClose: () => void; children: ReactNode; className?: string; description?: string; bare?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId(), descriptionId = useId()
  useEffect(() => {
    const dialog = ref.current, previous = document.activeElement
    dialog?.showModal()
    return () => { dialog?.close(); if (previous instanceof HTMLElement) previous.focus() }
  }, [])
  return <dialog ref={ref} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onCancel={e => { e.preventDefault(); e.stopPropagation(); onClose() }} className={`m-auto max-h-[92dvh] w-[calc(100%_-_1rem)] overflow-auto rounded-2xl bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/50 ${bare ? 'max-w-[900px]' : 'max-w-[960px]'} ${className}`}>
    {bare ? <><span id={titleId} className="sr-only">{title}</span>{children}</> : <><header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4"><div><h2 id={titleId} className="text-xl font-bold">{title}</h2>{description && <p id={descriptionId} className="mt-1 text-sm text-slate-500">{description}</p>}</div><button type="button" aria-label="关闭对话框" onClick={onClose} className={`${courseSecondaryButtonClass} shrink-0`}>关闭</button></header><div className="p-5">{children}</div></>}
  </dialog>
}
