import type { TaskTemplate, Subject } from './types'

export type TemplateDraft = Omit<TaskTemplate, 'id' | 'user_id' | 'created_at'>
export function templateDraft(subject: Subject | null = null): TemplateDraft {
  return { name: '', subject, course_id: null, enabled: true, mode: 'checklist', trigger: 'confirmed', target: 'current', checklist: [], estimated_minutes: 20, deadline: { kind: 'next_class', time: '20:30', days: 1, at: null }, reminders: [{ anchor: 'deadline', minutes: -60 }], trigger_minutes: 0, weekdays: [1], scheduled_at: null, lesson_filter: null, material_kind: 'general', item_source: 'template' }
}
export function builtInTemplates(): TemplateDraft[] {
  const make = (subject: Subject, name: string, change: Partial<TemplateDraft> = {}): TemplateDraft => ({ ...templateDraft(subject), name, checklist: [name], ...change })
  return [
    make('chinese', '预习', { target: 'next', checklist: ['朗读课文', '圈出生字和不懂的地方'] }),
    make('chinese', '课后复习', { checklist: ['复读本课', '复习字词与课堂笔记'], deadline: { kind: 'same_day', time: '20:30', days: 0, at: null } }),
    make('chinese', '单元复习', { trigger: 'unit_completed', target: 'unit', checklist: ['回顾单元课文', '复习单元字词', '整理不熟悉的内容'], deadline: { kind: 'days_after', time: '20:30', days: 7, at: null } }),
    make('math', '课上题', { item_source: 'class' }), make('math', '作业题', { item_source: 'homework' }),
    ...[1, 2, 3].flatMap(n => [make('english', `L${n} workbook`, { lesson_filter: n }), make('english', `L${n} ${n === 1 ? '阅读' : n === 2 ? '听记' : '背诵'}`, { lesson_filter: n, mode: n === 1 ? 'reading' : 'audio', material_kind: n === 1 ? 'reading' : n === 2 ? 'dictation' : 'recitation' })]),
    ...(['dance', 'swimming', 'piano'] as const).map(s => make(s, s === 'dance' ? '带舞蹈衣' : s === 'swimming' ? '带游泳装备' : '练琴', { trigger: 'before_class', trigger_minutes: s === 'piano' ? 1440 : 60, deadline: { kind: 'next_class', time: '20:30', days: 0, at: null }, reminders: [{ anchor: 'course_start', minutes: s === 'piano' ? -1440 : -60 }] })),
  ]
}
