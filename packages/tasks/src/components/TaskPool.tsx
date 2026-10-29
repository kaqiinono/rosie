'use client'

import { useState } from 'react'
import { SUBJECTS } from '../types'
import Templates from './Templates'
import { builtInTemplates } from '../defaults'
import { Panel, Field, inputClass, minorClass, useTasks } from './shared'

export default function TaskPool() {
  const { api, run, busy } = useTasks()
  const [selectedKey, setSelectedKey] = useState('')
  const missing = builtInTemplates().filter(draft => !api.data.pool_items.some(item => item.activity_key === draft.activity_key || item.subject === draft.subject && item.name === draft.name && item.lesson_filter === draft.lesson_filter))
  const selected = missing.find(item => item.activity_key === selectedKey) ?? missing[0]
  return <div className="space-y-5"><Panel title="任务池"><p className="text-sm text-slate-600">课程可绑定多个活动并覆盖时长、范围和物料。固定每周和一次任务保持独立。</p><Field label="从预设添加"><select className={inputClass} disabled={busy || !missing.length} value={selected?.activity_key ?? ''} onChange={e => setSelectedKey(e.target.value)}>{!missing.length && <option value="">建议活动已齐全</option>}{missing.map(item => <option key={item.activity_key} value={item.activity_key}>{item.subject ? SUBJECTS[item.subject] : '未分类'} · {item.name}</option>)}</select></Field><button disabled={busy || !selected} className={minorClass} onClick={() => void run(async () => { if (selected) await api.save('pool_items', selected) })}>{busy ? '保存中…' : '添加所选活动'}</button></Panel><Templates /></div>
}
