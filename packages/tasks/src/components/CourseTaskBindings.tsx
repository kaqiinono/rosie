'use client'

import type { ReactNode } from 'react'
import type { CourseScope, CourseTaskBinding, MaterialSelector, TaskPoolItem, TeachingSegment } from '../courseTypes'
import type { LessonRef } from '../types'
import { Field, inputClass } from './shared'

/** Drafts deliberately omit course/user IDs so new courses can bind before atomic save. */
export type CourseTaskBindingDraft = Pick<CourseTaskBinding, 'pool_item_id' | 'enabled' | 'scope_override' | 'estimated_minutes_override' | 'material_override'> & { id?: string }
export type MaterialPickerSlot = (props: { value: MaterialSelector; onChange: (value: MaterialSelector) => void; disabled?: boolean }) => ReactNode
export type CourseTaskBindingsProps = {
  items: TaskPoolItem[]; value: CourseTaskBindingDraft[]; onChange: (value: CourseTaskBindingDraft[]) => void
  lessons?: LessonRef[]; segments?: TeachingSegment[]; disabled?: boolean; renderMaterialPicker?: MaterialPickerSlot
}

export function ScopeFields({ value, onChange, lessons = [], segments = [], disabled = false }: { value: CourseScope; onChange: (scope: CourseScope) => void; lessons?: LessonRef[]; segments?: TeachingSegment[]; disabled?: boolean }) {
  const units = [...new Map(lessons.map(l => [JSON.stringify([l.book, l.unit]), { book: l.book, unit: l.unit }])).entries()]
  return <fieldset disabled={disabled} className="space-y-2"><legend className="text-sm font-medium text-slate-600">适用范围</legend>
    <select aria-label="适用范围" className={inputClass} value={value.kind} onChange={e => onChange(e.target.value === 'all' ? { kind: 'all' } : e.target.value === 'lessons' ? { kind: 'lessons', lesson_keys: [] } : e.target.value === 'segments' ? { kind: 'segments', segment_keys: [] } : { kind: 'unit', book: '', unit: '' })}>
      <option value="all">全部内容</option><option value="unit">指定书册和单元</option><option value="lessons">指定目录内容</option><option value="segments">指定教学段</option>
    </select>
    {value.kind === 'unit' && <Field label="书册 / 单元"><select className={inputClass} value={JSON.stringify([value.book, value.unit])} onChange={e => { const unit = units.find(([key]) => key === e.target.value)?.[1]; if (unit) onChange({ kind: 'unit', ...unit }) }}><option value={JSON.stringify(['', ''])}>选择书册和单元</option>{units.map(([key, unit]) => <option key={key} value={key}>{unit.book} · {unit.unit}</option>)}{value.book && !units.some(([, u]) => u.book === value.book && u.unit === value.unit) && <option value={JSON.stringify([value.book, value.unit])}>{value.book} · {value.unit}（已保存）</option>}</select></Field>}
    {value.kind === 'lessons' && <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">{!lessons.length && <p className="text-sm text-slate-500">暂无目录；已有范围会保留。</p>}{lessons.map(l => <label className="flex gap-2 text-sm" key={l.key}><input type="checkbox" checked={value.lesson_keys.includes(l.key)} onChange={e => onChange({ kind: 'lessons', lesson_keys: e.target.checked ? [...value.lesson_keys, l.key] : value.lesson_keys.filter(k => k !== l.key) })} />{l.book} · {l.unit} · {l.title}</label>)}</div>}
    {value.kind === 'segments' && <div className="space-y-2">{!segments.length && <p className="text-sm text-slate-500">暂无教学段；已有范围会保留。</p>}{segments.map(s => <label key={s.key} className="flex gap-2 text-sm"><input type="checkbox" checked={value.segment_keys.includes(s.key)} onChange={e => onChange({ kind: 'segments', segment_keys: e.target.checked ? [...value.segment_keys, s.key] : value.segment_keys.filter(k => k !== s.key) })} />{s.title}</label>)}</div>}
  </fieldset>
}

export function MaterialSelectorField({ value, onChange, disabled, renderMaterialPicker }: { value: MaterialSelector; onChange: (value: MaterialSelector) => void; disabled?: boolean; renderMaterialPicker?: MaterialPickerSlot }) {
  return <div className="space-y-2"><Field label="学习物料"><select className={inputClass} disabled={disabled} value={value.kind} onChange={e => onChange(e.target.value === 'none' ? { kind: 'none' } : { kind: 'auto' })}><option value="auto">跟随课程物料（未关联时待补）</option><option value="none">不需要物料</option>{value.kind === 'assets' && <option value="assets">已选择 {value.asset_ids.length} 份物料</option>}</select></Field>{renderMaterialPicker?.({ value, onChange, disabled })}{value.kind === 'auto' && <p className="text-xs text-amber-800">未匹配物料时仍会生成任务，标记待补物料。</p>}</div>
}

export default function CourseTaskBindings({ items, value, onChange, lessons, segments, disabled = false, renderMaterialPicker }: CourseTaskBindingsProps) {
  const patch = (id: string, change: Partial<CourseTaskBindingDraft>) => onChange(value.map(b => b.pool_item_id === id ? { ...b, ...change } : b))
  const visible = items.filter(i => i.trigger !== 'weekly' && i.trigger !== 'once')
  return <fieldset disabled={disabled} className="space-y-3"><legend className="text-sm font-bold">课程任务绑定</legend><p className="text-sm text-slate-500">选中的通用活动和专项活动叠加；相同活动的专项优先。停用可保留配置。</p>
    {!visible.length && <p className="text-sm text-slate-500">任务池暂无课程活动，请先在任务池中创建。</p>}
    {visible.map(item => { const binding = value.find(b => b.pool_item_id === item.id); return <div key={item.id} className="space-y-3 rounded-xl border border-slate-200 p-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={!!binding} onChange={e => onChange(e.target.checked ? [...value, { pool_item_id: item.id, enabled: true, scope_override: null, estimated_minutes_override: null, material_override: null }] : value.filter(b => b.pool_item_id !== item.id))} />{item.name}{!item.enabled && <span className="text-slate-500">（池活动已停用）</span>}</label>
      {binding && <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={binding.enabled} onChange={e => patch(item.id, { enabled: e.target.checked })} />启用此绑定</label>
        <Field label={`预计分钟（留空使用 ${item.estimated_minutes} 分钟）`}><input className={inputClass} type="number" min={1} max={1440} value={binding.estimated_minutes_override ?? ''} onChange={e => patch(item.id, { estimated_minutes_override: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
        <div className="space-y-2"><label className="flex gap-2 text-sm"><input type="checkbox" checked={binding.scope_override !== null} onChange={e => patch(item.id, { scope_override: e.target.checked ? item.scope : null })} />覆盖适用范围（替代原厚海课次）</label>{binding.scope_override && <ScopeFields value={binding.scope_override} onChange={scope_override => patch(item.id, { scope_override })} lessons={lessons} segments={segments} />}</div>
        <div className="space-y-2"><label className="flex gap-2 text-sm"><input type="checkbox" checked={binding.material_override !== null} onChange={e => patch(item.id, { material_override: e.target.checked ? item.material_selector : null })} />覆盖物料</label>{binding.material_override && <MaterialSelectorField value={binding.material_override} onChange={material_override => patch(item.id, { material_override })} renderMaterialPicker={renderMaterialPicker} disabled={disabled} />}</div>
      </div>}
    </div> })}
  </fieldset>
}
