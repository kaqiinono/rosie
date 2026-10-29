import type { Subject } from './types'

import type { TaskPoolItem } from './courseTypes'

export type TemplateDraft = Omit<TaskPoolItem, 'id' | 'user_id' | 'created_at'>
export function templateDraft(subject: Subject | null = null): TemplateDraft {
  return { activity_key: '', scope: { kind: 'all' }, progress_mode: 'items', material_selector: { kind: 'auto' }, name: '', subject, course_id: null, enabled: true, mode: 'checklist', trigger: 'confirmed', target: 'current', checklist: [], estimated_minutes: 20, deadline: { kind: 'next_class', time: '20:30', days: 1, at: null }, reminders: [{ anchor: 'deadline', minutes: -60 }], trigger_minutes: 0, weekdays: [1], scheduled_at: null, lesson_filter: null, material_kind: 'general', item_source: 'template' }
}
export function builtInTemplates(): TemplateDraft[] {
  const make = (subject: Subject, name: string, change: Partial<TemplateDraft> = {}): TemplateDraft => ({ ...templateDraft(subject), name, activity_key: `${subject}:${name}`, checklist: [name], ...change })
  return [
    make('chinese', '预习', { target: 'next', checklist: ['朗读课文', '圈出生字和不懂的地方'] }),
    make('chinese', '课后复习', { checklist: ['复读本课', '复习字词与课堂笔记'], deadline: { kind: 'same_day', time: '20:30', days: 0, at: null } }),
    make('chinese', '单元复习', { trigger: 'unit_completed', target: 'unit', checklist: ['回顾单元课文', '复习单元字词', '整理不熟悉的内容'], deadline: { kind: 'days_after', time: '20:30', days: 7, at: null } }),
    ...['会认字认读', '会写字认读', '会写字书写', '组词', '默写', '日积月累', '古诗词背诵', '古诗词会写字书写', '成语积累', '好词好句积累'].map(name => make('chinese', name)),
    make('math', '课上题', { item_source: 'class', checklist: ['课堂复习（待选题）'] }), make('math', '作业题', { item_source: 'homework', checklist: ['待选题'] }),
    ...[1, 2, 3].flatMap(n => [make('english', `L${n} workbook`, { lesson_filter: n }), make('english', `L${n} ${n === 1 ? '阅读' : n === 2 ? '听记' : '背诵'}`, { lesson_filter: n, checklist: n === 1 ? ['听读课文', '跟读课文', '理解课文'] : n === 2 ? ['听写单词', '默写课文文章'] : ['背诵课文'], mode: n === 1 ? 'reading' : 'audio', material_kind: n === 1 ? 'reading' : n === 2 ? 'dictation' : 'recitation' })]),
    ...['当课单词认读', '课文预习'].map(name => make('english', name, { trigger: 'before_class', trigger_minutes: 1440 })),
    ...['单词背诵', '单词拼写', '课文语法掌握'].map(name => make('english', name)),
    make('english', 'L3 作文', { lesson_filter: 3, estimated_minutes: 30, progress_mode: 'percentage' }),
    ...(['dance', 'swimming', 'piano'] as const).map(s => make(s, s === 'dance' ? '带舞蹈衣' : s === 'swimming' ? '带游泳装备' : '练琴', { trigger: 'before_class', trigger_minutes: s === 'piano' ? 1440 : 60, deadline: { kind: 'next_class', time: '20:30', days: 0, at: null }, reminders: [{ anchor: 'course_start', minutes: s === 'piano' ? -1440 : -60 }] })),
  ]
}
