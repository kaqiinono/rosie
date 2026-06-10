'use client'

import { useEffect, useState } from 'react'

type Props = {
  existingStages: string[]
  onCancel: () => void
  onSubmit: (stage: string, unit: string, lesson: string) => void
}

const labelCls = 'mb-1 block text-[11px] font-extrabold tracking-wide text-slate-500 uppercase'
const inputCls =
  'w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-[14px] focus:border-amber-400 focus:outline-none'

export default function NewStageModal({ existingStages, onCancel, onSubmit }: Props) {
  const [stage, setStage] = useState('')
  const [unit, setUnit] = useState('Unit 1')
  const [lesson, setLesson] = useState('Lesson 1')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const dup = existingStages.includes(stage.trim())
  const canSubmit = stage.trim().length > 0 && unit.trim().length > 0 && lesson.trim().length > 0 && !dup

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(8px)' }}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="mb-1 text-[16px] font-extrabold text-slate-800">新建词库</h3>
        <p className="mb-4 text-[12px] text-slate-500">同时建立第一个单元与课次；添加单词后写入云端。</p>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>词库 (stage) *</label>
            <input className={inputCls} value={stage} onChange={(e) => setStage(e.target.value)} placeholder="4C" autoFocus />
            {dup && <div className="mt-1 text-[11px] font-bold text-red-500">该词库已存在</div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>第一个单元 *</label>
              <input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit 1" />
            </div>
            <div>
              <label className={labelCls}>第一个课次 *</label>
              <input className={inputCls} value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="Lesson 1" />
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded-lg border border-slate-200 bg-white py-2 text-[13px] font-extrabold text-slate-600 transition hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onSubmit(stage.trim(), unit.trim(), lesson.trim())}
            disabled={!canSubmit}
            className="flex-[2] cursor-pointer rounded-lg py-2 text-[13px] font-extrabold text-white shadow transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)', boxShadow: '0 3px 12px rgba(245,158,11,0.4)' }}
          >
            创建词库
          </button>
        </div>
      </div>
    </div>
  )
}
