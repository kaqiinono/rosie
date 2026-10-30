'use client'

import { useId, useRef, useState } from 'react'
import type { TaskTemplate, ReminderRule } from '../types'
import type { TaskPoolItem } from '../courseTypes'
import { ScopeFields, MaterialSelectorField } from './CourseTaskBindings'
import { templateDraft, type TemplateDraft } from '../defaults'
import { useTasks, Panel, Field, inputClass, buttonClass, minorClass, SubjectSelect, lines, weekdays } from './shared'

const triggerLabels: Record<TaskTemplate['trigger'], string> = { before_class: '课程开始前', after_class: '课程结束后', confirmed: '课程确认完成后', unit_completed: '单元完成后', weekly: '固定每周', once: '指定日期一次' }
export default function Templates() {
  const { api, run, busy, catalog } = useTasks()
  const validationId = useId()
  const [validationError, setValidationError] = useState('')
  const invalidControl = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null)
  function clearValidation() {
    invalidControl.current?.removeAttribute('aria-invalid')
    invalidControl.current?.removeAttribute('aria-describedby')
    invalidControl.current = null
    setValidationError('')
  }
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<TemplateDraft>(templateDraft())
  const patch = (v: Partial<TemplateDraft>) => setDraft(p => ({ ...p, ...v }))
  const setReminder = (i: number, v: Partial<ReminderRule>) => patch({ reminders: draft.reminders.map((r, n) => n === i ? { ...r, ...v } : r) })
  function edit(t: TaskPoolItem) { setEditing(t.id); setDraft({ ...t }) }
  return <div className="space-y-5"><Panel title="已有池活动">
    {!api.data.pool_items.length && <p className="text-sm text-slate-500">还没有池活动，可在下方创建。</p>}
    {api.data.pool_items.map(t => <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-2"><div><strong>{t.name}</strong><p className="text-sm text-slate-500">{triggerLabels[t.trigger]} · {t.enabled ? '已启用' : '已停用'}</p></div><div className="flex gap-2"><button className={minorClass} onClick={() => edit(t)}>编辑</button><button disabled={busy} className={minorClass} onClick={() => void run(() => api.save('pool_items', { id: t.id, enabled: !t.enabled }))}>{t.enabled ? '停用' : '启用'}</button></div></div>)}
    <button className={minorClass} onClick={() => { setEditing(null); setDraft(templateDraft()) }}>新建活动</button>
  </Panel><Panel title={editing ? '编辑活动（用于后续任务）' : '新建池活动'}>
    <form noValidate className="space-y-4" onSubmit={e => {
      e.preventDefault()
      clearValidation()
      // Retain every declared required/min/max/step/type constraint without native bubbles.
      // HTML numeric inputs default to step=1, including deadline and reminder JSON fields.
      const form = e.currentTarget
      if (!form.checkValidity()) {
        const invalid = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input:invalid, select:invalid, textarea:invalid')
        if (invalid) {
          const label = invalid.labels?.[0]?.textContent?.trim() || invalid.getAttribute('aria-label') || '填写内容'
          setValidationError(`${label}格式不正确，请检查必填项、整数和允许范围。`)
          invalid.setAttribute('aria-invalid', 'true')
          invalid.setAttribute('aria-describedby', validationId)
          invalidControl.current = invalid
          invalid.focus()
        }
        return
      }
      void run(async () => {
      if (!draft.name.trim()) throw new Error('请填写任务名称')
      if (!Number.isInteger(draft.estimated_minutes) || draft.estimated_minutes < 1 || draft.estimated_minutes > 1440) throw new Error('预计分钟需为 1–1440 的整数')
      if (draft.scope.kind === 'unit' && (!draft.scope.book || !draft.scope.unit)) throw new Error('请选择书册和单元')
      if (['once', 'weekly'].includes(draft.trigger) && !draft.scheduled_at) throw new Error('请填写首次生成时间')
      if (draft.trigger === 'weekly' && !draft.weekdays.length) throw new Error('请选择每周重复日')
      if (draft.scope.kind === 'lessons' && !draft.scope.lesson_keys.length || draft.scope.kind === 'segments' && !draft.scope.segment_keys.length) throw new Error('请选择适用内容')
      if (['confirmed', 'unit_completed', 'before_class', 'after_class'].includes(draft.trigger) && !draft.subject && !draft.course_id) throw new Error('课程触发活动需要选择科目或课程')
      if (['next_class', 'course_default'].includes(draft.deadline.kind) && ['weekly', 'once'].includes(draft.trigger)) throw new Error('独立周期任务请选择当天、N 天后或固定截止时间')
      if (draft.deadline.kind === 'fixed' && !draft.deadline.at) throw new Error('请填写指定截止时间')
      await api.save('pool_items', { ...draft, activity_key: draft.activity_key || `custom:${crypto.randomUUID()}`, id: editing ?? undefined }); await api.refresh(); setEditing(null); setDraft(templateDraft())
    }) }}>
      {validationError && <p id={validationId} role="alert" className="text-sm text-amber-900">{validationError}</p>}
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      <Field label="活动标识（同标识、同阶段、同对象时专项覆盖通用）"><input className={inputClass} value={draft.activity_key} onChange={e => patch({ activity_key: e.target.value })} placeholder="留空自动创建独立活动" /></Field>
      <ScopeFields value={draft.scope} onChange={scope => patch({ scope })} lessons={draft.subject && draft.subject in catalog ? catalog[draft.subject as 'chinese' | 'math' | 'english'] : []} />
      <MaterialSelectorField renderMaterialPicker={catalog.renderMaterialPicker ? props => catalog.renderMaterialPicker!({...props,subject:draft.subject ?? 'other'}) : undefined} value={draft.material_selector} onChange={material_selector => patch({ material_selector })} />
      <Field label="进度方式"><select className={inputClass} value={draft.progress_mode} onChange={e => patch({ progress_mode: e.target.value as TemplateDraft['progress_mode'] })}><option value="items">逐项完成</option><option value="percentage">百分比</option></select></Field>
      <Field label="任务名称"><input required maxLength={120} value={draft.name} onChange={e => patch({ name: e.target.value })} className={inputClass} /></Field>
      <Field label="科目"><SubjectSelect all value={draft.subject ?? ''} onChange={v => patch({ subject: v || null })} /></Field>
      <p className="text-sm text-slate-500 sm:col-span-2">在课程编辑器中选择要绑定的活动。{draft.course_id && `原课程关联：${api.data.courses.find(c => c.id === draft.course_id)?.name ?? '已保存课程'}；编辑活动会保留原关联。`}</p>
      <Field label="生成时机"><select value={draft.trigger} onChange={e => { const trigger = e.target.value as TaskTemplate['trigger']; patch({ trigger, target: trigger === 'unit_completed' ? 'unit' : trigger === 'confirmed' && draft.target === 'next' ? 'next' : 'current' }) }} className={inputClass}>{Object.entries(triggerLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      {draft.trigger === 'before_class' && <Field label="提前多少分钟生成"><input required type="number" min={0} max={525600} value={draft.trigger_minutes} onChange={e => patch({ trigger_minutes: Number(e.target.value) })} className={inputClass} /></Field>}
      <Field label="内容对象"><select className={inputClass} value={draft.target} onChange={e => patch({ target: e.target.value as TaskTemplate['target'] })}><option value="current">本次课程</option><option value="next" disabled={draft.trigger !== 'confirmed'}>下次预备课（需课程确认）</option><option value="unit" disabled={!['confirmed', 'unit_completed'].includes(draft.trigger)}>当前单元</option></select></Field>
      <Field label="执行方式"><select className={inputClass} value={draft.mode} onChange={e => patch({ mode: e.target.value as TaskTemplate['mode'] })}><option value="checklist">清单</option><option value="reading">阅读入口</option><option value="audio">多音频单条循环</option></select></Field>
      <Field label="清单（每行一项）"><textarea rows={4} className={`${inputClass} resize-none`} value={draft.checklist.join('\n')} onChange={e => patch({ checklist: e.target.value.split('\n') })} onBlur={() => patch({ checklist: lines(draft.checklist.join('\n')) })} /></Field>
      <Field label="预计分钟"><input required type="number" min={1} max={1440} className={inputClass} value={draft.estimated_minutes} onChange={e => patch({ estimated_minutes: Number(e.target.value) })} /></Field>
      <Field label="清单来源"><select className={inputClass} value={draft.item_source} onChange={e => patch({ item_source: e.target.value as TaskTemplate['item_source'] })}><option value="template">本活动清单</option><option value="class">确认课程时选择的课上题</option><option value="homework">确认课程时选择的作业题</option></select></Field>
      <Field label="厚海课次（与适用范围同时匹配）"><select className={inputClass} value={draft.lesson_filter ?? ''} onChange={e => patch({ lesson_filter: e.target.value ? Number(e.target.value) : null })}><option value="">全部课次</option>{[1, 2, 3].map(n => <option value={n} key={n}>L{n}</option>)}</select></Field>
      <Field label="资料类型"><select className={inputClass} value={draft.material_kind} onChange={e => patch({ material_kind: e.target.value as TaskTemplate['material_kind'] })}><option value="general">通用</option><option value="reading">阅读</option><option value="dictation">听记</option><option value="recitation">背诵</option></select></Field>
      <Field label="截止规则"><select className={inputClass} value={draft.deadline.kind} onChange={e => patch({ deadline: { ...draft.deadline, kind: e.target.value as TaskTemplate['deadline']['kind'] } })}>{!['weekly', 'once'].includes(draft.trigger) && <option value="course_default">继承课程默认</option>}<option value="next_class">下次同课程前</option><option value="same_day">当天指定时间</option><option value="days_after">生成 N 天后</option><option value="fixed">指定日期时间</option></select></Field>
      {draft.deadline.kind === 'days_after' && <Field label="N 天"><input required type="number" min={0} max={365} className={inputClass} value={draft.deadline.days} onChange={e => patch({ deadline: { ...draft.deadline, days: Number(e.target.value) } })} /></Field>}
      {['same_day', 'days_after'].includes(draft.deadline.kind) && <Field label="截止时刻"><input required type="time" className={inputClass} value={draft.deadline.time} onChange={e => patch({ deadline: { ...draft.deadline, time: e.target.value } })} /></Field>}
      {draft.deadline.kind === 'fixed' && <Field label="截止日期时间（北京时间）"><input required type="datetime-local" className={inputClass} value={draft.deadline.at ? new Date(new Date(draft.deadline.at).getTime() + 28800000).toISOString().slice(0, 16) : ''} onChange={e => patch({ deadline: { ...draft.deadline, at: e.target.value ? new Date(`${e.target.value}+08:00`).toISOString() : null } })} /></Field>}
      {['once', 'weekly'].includes(draft.trigger) && <Field label="首次生成时间（北京时间）"><input required type="datetime-local" className={inputClass} value={draft.scheduled_at ? new Date(new Date(draft.scheduled_at).getTime() + 28800000).toISOString().slice(0, 16) : ''} onChange={e => patch({ scheduled_at: e.target.value ? new Date(`${e.target.value}+08:00`).toISOString() : null })} /></Field>}
      {draft.trigger === 'weekly' && <fieldset className="flex flex-wrap gap-3"><legend>每周重复</legend>{[1, 2, 3, 4, 5, 6, 0].map(n => <label key={n}><input type="checkbox" checked={draft.weekdays.includes(n)} onChange={e => patch({ weekdays: e.target.checked ? [...draft.weekdays, n] : draft.weekdays.filter(x => x !== n) })} />{weekdays[n]}</label>)}</fieldset>}
      <fieldset className="space-y-2 sm:col-span-2"><legend className="text-sm font-bold">提醒（负数提前，正数延后，0 为当天对应时刻）</legend>{draft.reminders.map((r, i) => <div key={i} className="flex gap-2"><select aria-label="提醒基准" className={inputClass} value={r.anchor} onChange={e => setReminder(i, { anchor: e.target.value as ReminderRule['anchor'] })}><option value="deadline">任务截止时间</option><option value="course_start">课程开始</option><option value="course_end">课程结束</option></select><input aria-label="相差分钟" type="number" required min={-525600} max={525600} className={inputClass} value={r.minutes} onChange={e => setReminder(i, { minutes: Number(e.target.value) })} /><button type="button" className={minorClass} onClick={() => patch({ reminders: draft.reminders.filter((_, n) => n !== i) })}>移除</button></div>)}<button type="button" className={minorClass} onClick={() => patch({ reminders: [...draft.reminders, { anchor: 'deadline', minutes: -60 }] })}>添加提醒</button></fieldset>
      <button disabled={busy} className={buttonClass}>保存活动</button>
      </fieldset>
    </form>
  </Panel></div>
}
