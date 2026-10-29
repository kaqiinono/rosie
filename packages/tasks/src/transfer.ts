import type { TaskData, TimetableSnapshotPayload, Subject } from './types'
import type { CourseDomainData } from './courseTypes'
import { SUBJECTS } from './types'
import { coursePastelColor as courseColor, colorAppearance } from './courseColors'
import { localDate, dateAfter, atTime } from './time'
import { previewOccurrences, layoutOccurrences } from './timetable'

const MAX_BYTES = 2_000_000
const record = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('数据必须是对象'); return v as Record<string, unknown> }
const str = (v: unknown, max = 5000): string => { if (typeof v !== 'string' || v.length > max) throw new Error('文本格式或长度不正确'); return v }
const num = (v: unknown, min: number, max: number): number => { if (!Number.isInteger(v) || Number(v) < min || Number(v) > max) throw new Error(`数字必须在 ${min}–${max} 之间`); return Number(v) }
const date = (v: unknown): string => { const s = str(v, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) throw new Error('日期无效'); return s }
const stamp = (v: unknown): string => { const s = str(v, 40); if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/.test(s) || !Number.isFinite(Date.parse(s))) throw new Error('时间必须包含有效时区'); date(s.slice(0, 10)); const hour = Number(s.slice(11, 13)), minute = Number(s.slice(14, 16)); if (hour > 23 || minute > 59) throw new Error('时间无效'); return new Date(s).toISOString() }
const time = (v: unknown): string => { const s = str(v, 8); if (!/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(s)) throw new Error('时刻无效或包含非零秒'); return s.slice(0, 5) }
const list = (v: unknown): unknown[] => { if (!Array.isArray(v) || v.length > 5000) throw new Error('列表格式无效或超过 5000 项'); return v }
const color = (v: unknown) => { const s = str(v, 7); if (!/^#[0-9a-fA-F]{6}$/.test(s)) throw new Error('课程颜色必须是六位十六进制颜色'); return s }
const name = (v: unknown, max: number) => { const value = str(v, max).trim(); if (!value) throw new Error('名称不能为空'); return value }
const optionalText = (v: unknown) => v == null ? '' : str(v, 10000)
const reminder = (v: unknown) => v == null ? null : num(v, 0, 10080)
const optionalDate = (v: unknown) => v == null ? null : date(v)
const flag = (v: unknown): boolean => { if (typeof v !== 'boolean') throw new Error('布尔值无效'); return v }

/** Whitelist configuration only; never accept user IDs, progress, audio or external references. */
export function parseTimetableJSON(source: string): TimetableSnapshotPayload {
  if (new Blob([source]).size > MAX_BYTES) throw new Error('文件不能超过 2 MB')
  const root = record(JSON.parse(source) as unknown)
  if (root.version !== 1 && root.version !== 2) throw new Error('仅支持 Rosie 课表 JSON 版本 1 或 2')
  const ids = new Set<string>()
  const id = (v: unknown) => { const s = str(v, 100); if (!/^[a-zA-Z0-9:_-]+$/.test(s) || ids.has(s)) throw new Error('标识无效或重复'); ids.add(s); return s }
  const calendars = list(root.calendars).map(value => { const r = record(value); const starts_on = date(r.starts_on), ends_on = optionalDate(r.ends_on); if (ends_on && ends_on < starts_on) throw new Error('学期结束早于开始'); return { id: id(r.id), name: name(r.name, 120), starts_on, ends_on, created_at: new Date().toISOString() } })
  const calendarIds = new Set(calendars.map(c => c.id))
  const courses = list(root.courses).map<TimetableSnapshotPayload['courses'][number]>(value => { const r = record(value); const calendar_id = r.calendar_id == null ? null : str(r.calendar_id, 100); if (calendar_id && !calendarIds.has(calendar_id)) throw new Error('课程引用了文件外的课表'); const subject = str(r.subject); if (!Object.prototype.hasOwnProperty.call(SUBJECTS, subject)) throw new Error('不支持的科目'); const credits = r.credits == null ? null : Number(r.credits); if (credits !== null && (typeof r.credits !== 'number' || !Number.isFinite(credits) || credits < 0 || credits > 1000)) throw new Error('学分无效'); const course_type = root.version === 1 ? 'timetabled' : r.course_type ?? 'timetabled'; if (course_type !== 'timetabled' && course_type !== 'flexible') throw new Error('课程类型无效'); return { id: id(r.id), course_type, effective_from: root.version === 1 ? null : optionalDate(r.effective_from), calendar_id, name: name(r.name, 120), subject: subject as Subject, teacher: r.teacher == null ? '' : str(r.teacher, 200), location: r.location == null ? '' : str(r.location, 500), notes: optionalText(r.notes), color: r.color == null ? '#059669' : color(r.color), credits, reminder_minutes: reminder(r.reminder_minutes), created_at: new Date().toISOString() } })
  const courseIds = new Set(courses.map(c => c.id))
  const rules = list(root.rules).map<TimetableSnapshotPayload['rules'][number]>(value => { const r = record(value); const course_id = str(r.course_id, 100); if (!courseIds.has(course_id)) throw new Error('时段引用了文件外的课程'); const recurrence = r.recurrence ?? 'weekly'; if (recurrence !== 'weekly' && recurrence !== 'once' && recurrence !== 'weeks') throw new Error('不支持的重复方式'); const kind = root.version === 1 ? 'timetabled' : r.kind ?? 'timetabled'; if (kind !== 'timetabled' && kind !== 'flexible') throw new Error('规则类型无效'); if (kind === 'flexible' && (r.start_time != null || r.end_time != null)) throw new Error('自由课程不能填写时刻'); const valid_from = date(r.valid_from), valid_until = optionalDate(r.valid_until), start_time = kind === 'flexible' ? null : time(r.start_time), end_time = kind === 'flexible' ? null : time(r.end_time); if ((start_time !== null && end_time !== null && end_time <= start_time) || (valid_until && valid_until < valid_from)) throw new Error('时段结束必须晚于开始'); const teaching_weeks = list(r.teaching_weeks ?? []).map(v => num(v, 1, 520)); if (teaching_weeks.length > 520) throw new Error('教学周最多 520 项'); if (recurrence === 'weeks' && !teaching_weeks.length) throw new Error('指定教学周不能为空'); return { id: id(r.id), course_id, kind, weekday: num(r.weekday, 0, 6), start_time, end_time, valid_from, valid_until, recurrence, interval_weeks: num(r.interval_weeks ?? 1, 1, 520), anchor_date: date(r.anchor_date ?? valid_from), teaching_weeks, disabled_from: optionalDate(r.disabled_from) } as TimetableSnapshotPayload['rules'][number] })
  const ruleIds = new Set(rules.map(r => r.id))
  const exams = list(root.exams ?? []).map(value => { const r = record(value); const calendar_id = r.calendar_id == null ? null : str(r.calendar_id, 100), course_id = r.course_id == null ? null : str(r.course_id, 100); if ((calendar_id && !calendarIds.has(calendar_id)) || (course_id && !courseIds.has(course_id))) throw new Error('考试引用了文件外的数据'); const starts_at = stamp(r.starts_at), ends_at = stamp(r.ends_at); if (ends_at <= starts_at) throw new Error('考试结束必须晚于开始'); return { id: id(r.id), calendar_id, course_id, title: name(r.title, 200), starts_at, ends_at, location: r.location == null ? '' : str(r.location, 500), notes: optionalText(r.notes), reminder_minutes: reminder(r.reminder_minutes) } })
  const exceptions = list(root.exceptions ?? []).map(value => { const r = record(value), rule_id = str(r.rule_id, 100); if (!ruleIds.has(rule_id)) throw new Error('调课引用了文件外的时段'); const starts_at = r.starts_at == null ? null : stamp(r.starts_at), ends_at = r.ends_at == null ? null : stamp(r.ends_at); if ((!flag(r.cancelled) && !starts_at) || !!starts_at !== !!ends_at || (starts_at && ends_at && starts_at >= ends_at)) throw new Error('调课时间无效'); return { id: id(r.id), rule_id, original_date: date(r.original_date), cancelled: flag(r.cancelled), starts_at, ends_at } })
  const p = root.settings == null ? null : record(root.settings)
  const settings = p ? { week_start: num(p.week_start, 0, 1) as 0 | 1, show_weekends: flag(p.show_weekends), start_hour: num(p.start_hour, 0, 23), end_hour: num(p.end_hour, 1, 24), hour_height: num(p.hour_height, 40, 160), hour12: flag(p.hour12), show_teacher: flag(p.show_teacher), show_location: flag(p.show_location), default_reminder_minutes: reminder(p.default_reminder_minutes) } : undefined
  if (settings && settings.start_hour >= settings.end_hour) throw new Error('显示时间范围无效')
  return { version: 2, calendars, courses, rules, exams, exceptions, ...(settings ? { settings } : {}) }
}

export function schedulePayload(data: TaskData & Partial<Pick<CourseDomainData, 'course_rules'>>, calendarId?: string | null): TimetableSnapshotPayload {
  const courses = data.courses.filter(c => !c.archived_at && (!calendarId || c.calendar_id === calendarId))
  const courseIds = new Set(courses.map(c => c.id)), rules = (data.course_rules ?? data.rules).filter(r => courseIds.has(r.course_id)), ruleIds = new Set(rules.map(r => r.id))
  // Parsing is the single schedule whitelist for both outbound and inbound payloads.
  return parseTimetableJSON(JSON.stringify({ version: 2, calendars: data.calendars.filter(c => !calendarId || c.id === calendarId), courses, rules, exams: data.exams.filter(e => !calendarId || e.calendar_id === calendarId).map(e => ({ ...e, course_id: e.course_id && courseIds.has(e.course_id) ? e.course_id : null })), exceptions: data.exceptions.filter(e => ruleIds.has(e.rule_id)) }))
}
export function omittedFlexibleCourses(data: TaskData, calendarId?: string | null): number {
  return data.courses.filter(c => c.course_type === 'flexible' && !c.archived_at && (!calendarId || c.calendar_id === calendarId)).length
}

const esc = (s: string) => s.replace(/\r/g, '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
const foldICS = (line: string) => { let bytes = 0, result = ''; for (const char of line) { const size = new TextEncoder().encode(char).length; if (bytes + size > 73) { result += '\r\n '; bytes = 1 } result += char; bytes += size } return result }
const icsStamp = (s: string) => new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
/** Export concrete events for an explicit range, accurately including moved/cancelled classes. */
export function exportICS(data: TaskData, from: string, to: string, calendarId?: string | null): string {
  const rows = previewOccurrences(data, from, to).filter(o => o.status !== 'cancelled' && (!calendarId || data.courses.find(c => c.id === o.course_id)?.calendar_id === calendarId))
  const events = rows.map(o => ({ id: `${o.rule_id}-${o.original_date}`, title: data.courses.find(c => c.id === o.course_id)?.name || '课程', start: o.starts_at, end: o.ends_at, location: data.courses.find(c => c.id === o.course_id)?.location || '', exam: false }))
  events.push(...data.exams.filter(e => (!calendarId || e.calendar_id === calendarId) && localDate(new Date(e.starts_at)) >= from && localDate(new Date(e.starts_at)) <= to).map(e => ({ id: e.id, title: e.title, start: e.starts_at, end: e.ends_at, location: e.location, exam: true })))
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rosie//Timetable//ZH', `X-ROSIE-OMITTED-FLEXIBLE:${omittedFlexibleCourses(data, calendarId)}`, ...events.flatMap(e => ['BEGIN:VEVENT', `UID:${e.id}@rosie`, `DTSTAMP:${icsStamp(new Date().toISOString())}`, `DTSTART:${icsStamp(e.start)}`, `DTEND:${icsStamp(e.end)}`, `SUMMARY:${esc(e.title)}`, `LOCATION:${esc(e.location)}`, ...(e.exam ? ['CATEGORIES:ROSIE-EXAM'] : []), 'END:VEVENT']), 'END:VCALENDAR'].map(foldICS).join('\r\n')
}

export function parseICS(source: string): TimetableSnapshotPayload {
  if (new Blob([source]).size > MAX_BYTES) throw new Error('文件不能超过 2 MB')
  const lines = source.replace(/\r\n[ \t]/g, '').split(/\r?\n/)
  if (!lines.includes('BEGIN:VCALENDAR') || !lines.includes('END:VCALENDAR')) throw new Error('不是完整的 ICS 日历')
  const payload: TimetableSnapshotPayload = { version: 1, calendars: [], courses: [], rules: [], exams: [], exceptions: [] }
  let event: Map<string, { parameters: string; value: string }> | null = null
  const unescape = (s: string) => s.replace(/\\[nN]/g, '\n').replace(/\\([,;\\])/g, '$1')
  const readTime = (v: { parameters: string; value: string } | undefined) => { if (!v) throw new Error('事件缺少开始或结束时间'); if (v.parameters && v.parameters !== ';TZID=Asia/Shanghai') throw new Error('仅支持 UTC 或 Asia/Shanghai 时区，不支持全天事件'); const m = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)(Z?)$/.exec(v.value); if (!m || (!m[7] && !v.parameters) || m[6] !== '00') throw new Error('不支持浮动时间或非零秒'); const result = stamp(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00${m[7] ? 'Z' : '+08:00'}`); return new Date(Date.parse(result) + 8 * 3600000).toISOString().slice(0, 19) }
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { if (event) throw new Error('ICS 事件嵌套无效'); event = new Map(); continue }
    if (line === 'END:VEVENT') {
      if (!event || payload.courses.length + payload.exams.length >= 5000) throw new Error('事件无效或超过 5000 项')
      for (const key of ['EXDATE', 'RDATE', 'RECURRENCE-ID', 'DURATION']) if (event.has(key)) throw new Error(`暂不支持 ${key}，请导出为独立事件后导入`)
      if (event.get('STATUS')?.value === 'CANCELLED') throw new Error('取消事件需要完整例外规则，请使用 Rosie JSON 导入')
      const start = readTime(event.get('DTSTART')), end = readTime(event.get('DTEND'))
      if (event.get('CATEGORIES')?.value === 'ROSIE-EXAM') { if (event.has('RRULE')) throw new Error('考试重复事件请先展开'); payload.exams.push({ id: `exam-${payload.exams.length}`, calendar_id: null, course_id: null, title: unescape(event.get('SUMMARY')?.value || '导入考试'), starts_at: stamp(`${start}+08:00`), ends_at: stamp(`${end}+08:00`), location: unescape(event.get('LOCATION')?.value || ''), notes: '', reminder_minutes: null }); event = null; continue }
      if (start.slice(0, 10) !== end.slice(0, 10) || start >= end) throw new Error('不支持跨日或倒序事件')
      const courseId = `course-${payload.courses.length}`, ruleId = `rule-${payload.rules.length}`, startDate = start.slice(0, 10)
      const rawRule = event.get('RRULE')?.value
      let interval = 1, until: string | null = startDate, recurrence: 'weekly' | 'once' = 'once'
      let days = [new Date(`${startDate}T00:00:00Z`).getUTCDay()]
      if (rawRule && event.get('DTSTART')?.value.endsWith('Z') && event.get('DTSTART')?.value.slice(0, 8) !== startDate.replace(/-/g, '')) throw new Error('UTC 周重复跨北京时间日期边界，请先展开为独立事件')
      if (rawRule) { const entries = rawRule.split(';').map(part => part.split('=')); const rule = new Map(entries.map(([k, v]) => [k, v])); if (entries.length !== rule.size || [...rule.keys()].some(k => !['FREQ', 'INTERVAL', 'UNTIL', 'BYDAY', 'WKST'].includes(k)) || rule.get('FREQ') !== 'WEEKLY' || (rule.has('WKST') && rule.get('WKST') !== 'MO')) throw new Error('仅支持周重复、间隔、结束日期及星期；COUNT/月度/自定义周起点等规则请先展开事件'); recurrence = 'weekly'; interval = num(Number(rule.get('INTERVAL') || 1), 1, 520); until = null; if (rule.has('UNTIL')) { const u = readTime({ parameters: '', value: rule.get('UNTIL') || '' }); if (u.slice(11, 16) < start.slice(11, 16)) throw new Error('UNTIL 必须包含最后一次开始时刻'); until = u.slice(0, 10) } if (rule.has('BYDAY')) { days = (rule.get('BYDAY') || '').split(',').map(d => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(d)); if (days.some(d => d < 0)) throw new Error('不支持带序号的 BYDAY') } }
      payload.courses.push({ id: courseId, name: unescape(event.get('SUMMARY')?.value || '导入课程'), subject: 'other', location: unescape(event.get('LOCATION')?.value || ''), notes: unescape(event.get('DESCRIPTION')?.value || ''), created_at: new Date().toISOString() })
      for (const weekday of days) payload.rules.push({ id: `${ruleId}-${weekday}`, course_id: courseId, weekday, start_time: start.slice(11, 16), end_time: end.slice(11, 16), valid_from: startDate, valid_until: until, recurrence, interval_weeks: interval, anchor_date: startDate, teaching_weeks: [] })
      event = null; continue
    }
    if (event) { const colon = line.indexOf(':'); if (colon < 1) throw new Error('ICS 属性格式错误'); const header = line.slice(0, colon), semi = header.indexOf(';'), key = semi < 0 ? header : header.slice(0, semi); if (key === 'BEGIN' || key === 'END') throw new Error('请移除嵌套提醒后重新导入'); if (event.has(key)) throw new Error(`重复 ICS 属性 ${key}`); event.set(key, { parameters: semi < 0 ? '' : header.slice(semi), value: line.slice(colon + 1) }) }
  }
  if (event || (!payload.courses.length && !payload.exams.length)) throw new Error('没有可导入的完整事件')
  return parseTimetableJSON(JSON.stringify(payload))
}

export function downloadFile(name: string, content: BlobPart, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
export function scheduleSVG(data: TaskData, from: string, to: string, calendarId?: string | null): string {
  const xml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] || c)
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1
  if (days < 1 || days > 42) throw new Error('图片与打印最多导出 42 天，请缩小日期范围')
  const rows = previewOccurrences(data, from, to).filter(o => o.status !== 'cancelled' && (!calendarId || data.courses.find(c => c.id === o.course_id)?.calendar_id === calendarId))
  const exams = data.exams.filter(e => (!calendarId || e.calendar_id === calendarId) && Date.parse(e.ends_at) > Date.parse(atTime(from, '00:00')) && Date.parse(e.starts_at) < Date.parse(atTime(dateAfter(to, 1), '00:00'))).map(e => ({ ...e, course_id: e.course_id || '', rule_id: '', original_date: localDate(new Date(e.starts_at)), status: 'scheduled' as const, confirmation: null, preview: false }))
  const events = [...rows, ...exams]
  if (events.length > 300) throw new Error('图片导出最多 300 项，请缩小日期范围')
  const hour = (s: string) => { const d = new Date(Date.parse(s) + 8 * 3600000); return d.getUTCHours() + d.getUTCMinutes() / 60 }
  const startHour = events.some(e => localDate(new Date(e.starts_at)) !== localDate(new Date(e.ends_at))) ? 0 : Math.min(7, ...events.map(e => Math.floor(hour(e.starts_at))))
  const endHour = Math.max(22, ...events.map(e => localDate(new Date(e.starts_at)) === localDate(new Date(e.ends_at)) ? Math.ceil(hour(e.ends_at)) : 24))
  const hourHeight = 52, weekHeight = (endHour - startHour) * hourHeight + 70, width = 1400, left = 64, colWidth = 188
  const parts: string[] = []
  const text = (x: number, y: number, value: string, size = 14, fill = '#1e293b') => `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" fill="${fill}">${xml(value)}</text>`
  for (let offset = 0; offset < days; offset += 7) {
    const top = 100 + Math.floor(offset / 7) * weekHeight
    for (let h = startHour; h <= endHour; h++) { const y = top + 36 + (h - startHour) * hourHeight; parts.push(text(8, y + 4, `${String(h).padStart(2, '0')}:00`, 12), `<path d="M${left} ${y}H1380" stroke="#e2e8f0"/>`) }
    for (let day = 0; day < Math.min(7, days - offset); day++) {
      const current = dateAfter(from, offset + day), x = left + day * colWidth
      parts.push(text(x + 8, top + 22, `${current} 周${'日一二三四五六'[new Date(current).getUTCDay()]}`), `<path d="M${x} ${top + 36}V${top + 36 + (endHour - startHour) * hourHeight}" stroke="#e2e8f0"/>`)
      const dayStart = atTime(current, '00:00'), dayEnd = atTime(dateAfter(current, 1), '00:00')
      const dayEvents = events.filter(e => Date.parse(e.starts_at) < Date.parse(dayEnd) && Date.parse(e.ends_at) > Date.parse(dayStart)).map(e => ({ ...e, starts_at: new Date(Math.max(Date.parse(e.starts_at), Date.parse(dayStart))).toISOString(), ends_at: new Date(Math.min(Date.parse(e.ends_at), Date.parse(dayEnd))).toISOString() }))
      for (const { occurrence: e, column, columns } of layoutOccurrences(dayEvents)) {
        const course = data.courses.find(c => c.id === e.course_id), exam = data.exams.find(r => r.id === e.id)
        const title = exam ? `考试 · ${exam.title}` : course?.name || '课程'
        const appearance = exam ? colorAppearance('#b45309') : courseColor(course)
        const color = appearance.value
        const w = (colWidth - 6) / columns, y = top + 36 + (hour(e.starts_at) - startHour) * hourHeight, end = Date.parse(e.ends_at) === Date.parse(dayEnd) ? 24 : hour(e.ends_at), h = Math.max(8, (end - hour(e.starts_at)) * hourHeight - 2), bx = x + 3 + column * w
        const clip = `clip-${offset}-${day}-${parts.length}`
        parts.push(`<defs><clipPath id="${clip}"><rect x="${bx + 3}" y="${y}" width="${Math.max(1, w - 6)}" height="${h}"/></clipPath></defs><rect x="${bx}" y="${y}" width="${w - 2}" height="${h}" rx="4" fill="${color}" stroke="${color}"/><g clip-path="url(#${clip})">`, text(bx + 5, y + 15, title, 13, appearance.text), text(bx + 5, y + 31, `${new Date(e.starts_at).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false })}–${new Date(e.ends_at).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false })}`, 11, appearance.text), '</g>')
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${100 + Math.ceil(days / 7) * weekHeight}"><rect width="100%" height="100%" fill="white"/><rect width="100%" height="76" fill="#064e3b"/>${text(24, 45, `Rosie 课表 · ${from} — ${to}（北京时间）`, 24, 'white')}${parts.join('')}</svg>`
}
