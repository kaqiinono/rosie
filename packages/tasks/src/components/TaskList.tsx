'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { TaskInstance, Subject } from '../types'
import { SUBJECTS } from '../types'
import { localDate, displayTime, atTime } from '../time'
import TaskProgressEditor from './TaskProgressEditor'
import MathTaskItems from './MathTaskItems'
import TaskAudio from './TaskAudio'
import TodayCourseSummary from './TodayCourseSummary'
import {
  useTasks,
  Panel,
  Field,
  inputClass,
  buttonClass,
  minorClass,
  SubjectSelect,
  lines,
  text,
  safeHref,
} from './shared'

function TaskCard({
  task,
  audio,
  onAudio,
  now,
}: {
  task: TaskInstance
  audio: boolean
  onAudio: () => void
  now: number
}) {
  const { api, run, busy } = useTasks()
  const material = api.data.materials.find(
    (m) =>
      m.course_id === task.course_id &&
      m.lesson_key === task.lesson?.key &&
      m.kind === task.material_kind,
  )
  const href = safeHref(material?.href ?? task.lesson?.href)
  const overdue =
    !!task.due_at && +new Date(task.due_at) < now && ['pending', 'active'].includes(task.status)
  return (
    <article
      id={`task-${task.id}`}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-bold text-slate-800">{task.title}</h3>
        <span className="text-sm text-slate-500">
          {task.status === 'completed'
            ? '已完成'
            : task.status === 'cancelled'
              ? '已取消'
              : overdue
                ? '已逾期'
                : task.status === 'active'
                  ? '进行中'
                  : '未开始'}
        </span>
      </div>
      <p className="text-sm text-slate-500">
        {task.subject ? SUBJECTS[task.subject] : '未分类（历史任务）'} ·{' '}
        {task.due_at ? `截止 ${displayTime(task.due_at)}` : '未设置截止时间'}
      </p>
      {task.selection_state === 'pending' && (
        <p className="rounded-xl bg-amber-50 p-2 text-sm text-amber-800">待选题 · 预计用时已保留</p>
      )}
      {((task.mode === 'audio' && !material?.audio.length) ||
        (task.mode === 'reading' && !href)) && (
        <p className="rounded-xl bg-amber-50 p-2 text-sm text-amber-800">
          待准备资料 · 请在学习资料中关联{task.mode === 'audio' ? '多段音频' : '阅读链接'}
        </p>
      )}
      <TaskProgressEditor key={task.revision} task={task} />
      {task.subject === 'math' && task.progress_mode === 'items' ? (
        <MathTaskItems key={task.revision} task={task} />
      ) : (
        <ul className="space-y-2">
          {task.items.map((item) => (
            <li key={item.id} className="flex gap-2 text-sm">
              {task.progress_mode === 'items' ? (
                <input
                  aria-label={item.label}
                  type="checkbox"
                  checked={item.done}
                  disabled={busy || task.status === 'cancelled'}
                  onChange={(e) => void run(() => api.setItemDone(task, item.id, e.target.checked))}
                />
              ) : (
                <span>·</span>
              )}
              <span>{item.label}</span>
              {safeHref(item.href) && (
                <Link className="text-indigo-700 underline" href={safeHref(item.href)!}>
                  查看
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {task.mode === 'reading' && href && (
          <Link className={minorClass} href={href}>
            进入阅读
          </Link>
        )}
        {task.mode === 'audio' && material?.audio.length ? (
          <button className={minorClass} onClick={onAudio}>
            {audio ? '收起播放器' : '听记 / 背诵'}
          </button>
        ) : null}
        {task.progress_mode === 'percentage' && ['pending', 'active'].includes(task.status) && (
          <button
            disabled={busy || task.selection_state === 'pending'}
            className={buttonClass}
            onClick={() => void run(() => api.setCompletion(task, 100))}
          >
            确认完成
          </button>
        )}
        <button
          disabled={busy}
          className={minorClass}
          onClick={() =>
            void run(() =>
              api.save('tasks', {
                id: task.id,
                revision: task.revision,
                status: task.status === 'cancelled' ? 'pending' : 'cancelled',
              }),
            )
          }
        >
          {task.status === 'cancelled' ? '恢复任务' : '取消任务'}
        </button>
      </div>
      {audio && material && <TaskAudio key={material.id} material={material} />}
    </article>
  )
}

export default function TaskList() {
  const { api, run, busy } = useTasks()
  const [now, setNow] = useState(0)
  useEffect(() => {
    const measure = () => setNow(Date.now())
    measure()
    const timer = setInterval(measure, 15000)
    return () => clearInterval(timer)
  }, [])
  const [subject, setSubject] = useState<Subject | ''>('')
  const [history, setHistory] = useState(false)
  const [todayOnly, setTodayOnly] = useState(false)
  const [audioId, setAudioId] = useState('')
  const [courseFilter, setCourseFilter] = useState(''),
    [taskFilter, setTaskFilter] = useState('')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setCourseFilter(params.get('course') ?? '')
    setTaskFilter(params.get('task') ?? '')
    if (params.has('task')) setHistory(true)
  }, [])
  const tasks = api.data.tasks
    .filter(
      (t) =>
        (!courseFilter || t.course_id === courseFilter) &&
        (!taskFilter || t.id === taskFilter) &&
        (!subject || t.subject === subject) &&
        (history ? true : ['pending', 'active'].includes(t.status)) &&
        (!todayOnly ||
          !t.due_at ||
          localDate(new Date(t.due_at)) <= localDate() ||
          localDate(new Date(t.created_at)) === localDate() ||
          api.data.blocks.some(
            (b) => b.task_id === t.id && localDate(new Date(b.starts_at)) === localDate(),
          )),
    )
    .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'))
  const reminders = api.data.reminders.filter(
    (r) =>
      !r.source_key.startsWith('confirm:') &&
      !r.read_at &&
      r.status !== 'cancelled' &&
      +new Date(r.remind_at) <= now &&
      (!r.expires_at || +new Date(r.expires_at) > now) &&
      (!r.task_id ||
        api.data.tasks.some(
          (t) => t.id === r.task_id && ['pending', 'active'].includes(t.status),
        )) &&
      (!r.exam_id ||
        api.data.exams.some((exam) => exam.id === r.exam_id && +new Date(exam.ends_at) > now)) &&
      (r.task_id ||
        !r.occurrence_id ||
        api.data.occurrences.some((o) => o.id === r.occurrence_id && o.status === 'scheduled')),
  )
  const courseName = (id: string) => api.data.courses.find((c) => c.id === id)?.name ?? '课程'
  const reminderHref = (reminder: (typeof reminders)[number]) => {
    if (reminder.task_id) return `#task-${reminder.task_id}`
    const exam = api.data.exams.find((item) => item.id === reminder.exam_id)
    if (exam) return `/tasks/timetable?date=${localDate(new Date(exam.starts_at))}`
    const occurrence = api.data.occurrences.find((item) => item.id === reminder.occurrence_id)
    if (occurrence && +new Date(occurrence.ends_at) > now)
      return `/tasks/timetable?date=${localDate(new Date(occurrence.starts_at))}&course=${encodeURIComponent(occurrence.course_id)}`
    return '/tasks/timetable'
  }
  return (
    <div className="space-y-5">
      <TodayCourseSummary />
      {(courseFilter || taskFilter) && (
        <div className="flex items-center gap-3 text-sm text-emerald-900">
          <span>正在查看{courseFilter ? courseName(courseFilter) : '指定'}的关联任务</span>
          <button
            className={minorClass}
            onClick={() => {
              setCourseFilter('')
              setTaskFilter('')
            }}
          >
            查看全部任务
          </button>
        </div>
      )}
      {reminders.length > 0 && (
        <Panel title="现在需要留意">
          <div className="space-y-3">
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <Link href={reminderHref(r)} className="text-emerald-800 hover:underline">
                  {r.title} · {displayTime(r.remind_at)}
                </Link>
                <button
                  disabled={busy}
                  className={minorClass}
                  onClick={() =>
                    void run(() =>
                      api.save('reminders', { id: r.id, read_at: new Date().toISOString() }),
                    )
                  }
                >
                  已读
                </button>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <Panel title="我的任务">
        <div className="flex flex-wrap items-center gap-3">
          <SubjectSelect all value={subject} onChange={setSubject} />
          <label className="text-sm whitespace-nowrap">
            <input
              type="checkbox"
              checked={todayOnly}
              onChange={(e) => setTodayOnly(e.target.checked)}
            />{' '}
            今日、逾期及今日新任务
          </label>
          <label className="text-sm whitespace-nowrap">
            <input
              type="checkbox"
              checked={history}
              onChange={(e) => setHistory(e.target.checked)}
            />{' '}
            包含完成与取消
          </label>
        </div>
        <p className="text-sm text-slate-500">
          未完成任务持续保留；取消今日筛选查看全部任务。点击时间安排，为作业选择可用时段。
        </p>
      </Panel>
      {!tasks.length && (
        <p className="p-4 text-sm text-slate-500">
          暂无任务。绑定课程活动后按课程设置自动分配，也可在课程详情手动完课或创建自定义任务。
        </p>
      )}
      {tasks.map((t) => (
        <TaskCard
          key={t.id}
          now={now}
          task={t}
          audio={t.id === audioId && ['pending', 'active'].includes(t.status)}
          onAudio={() => setAudioId((p) => (p === t.id ? '' : t.id))}
        />
      ))}
      <Panel title="添加一次性自定义任务">
        <form
          noValidate
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            const form = e.currentTarget
            const f = new FormData(form)
            void run(async () => {
              if (!text(f, 'subject')) throw new Error('请选择科目')
              const date = text(f, 'date')
              const due = date ? atTime(date, text(f, 'time')) : null
              const task = await api.save('tasks', {
                title: text(f, 'title'),
                source_key: `custom:${crypto.randomUUID()}`,
                subject: text(f, 'subject') as Subject,
                progress_mode: text(f, 'subject') === 'math' ? 'items' : 'percentage',
                mode: 'checklist',
                status: 'pending',
                due_at: due,
                due_kind: 'fixed',
                estimated_minutes: Number(text(f, 'minutes')),
                items: (text(f, 'subject') === 'math' ? [] : lines(text(f, 'items'))).map(
                  (label, i) => ({
                    id: String(i),
                    label,
                    done: false,
                  }),
                ),
              })
              if (due && f.get('remind') === 'on')
                await api.save('reminders', {
                  task_id: task.id,
                  source_key: `custom:${task.id}`,
                  title: task.title,
                  remind_at: new Date(
                    +new Date(due) - Number(text(f, 'reminder_minutes')) * 60000,
                  ).toISOString(),
                })
              form.reset()
            })
          }}
        >
          <Field label="名称">
            <input required name="title" maxLength={120} className={inputClass} />
          </Field>
          <Field label="科目">
            <select required name="subject" className={inputClass}>
              <option value="">请选择科目</option>
              {Object.entries(SUBJECTS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="普通任务内容（每行一项；数学创建后选题）">
            <textarea name="items" className={`${inputClass} min-h-24 resize-none`} />
          </Field>
          <Field label="预计分钟">
            <input
              required
              type="number"
              min={1}
              max={1440}
              name="minutes"
              defaultValue={20}
              className={inputClass}
            />
          </Field>
          <Field label="截止日期（可选）">
            <input type="date" name="date" defaultValue={localDate()} className={inputClass} />
          </Field>
          <Field label="截止时间">
            <input required type="time" name="time" defaultValue="20:30" className={inputClass} />
          </Field>
          <label className="text-sm">
            <input type="checkbox" name="remind" defaultChecked /> 截止前提醒
          </label>
          <Field label="提前分钟">
            <input
              type="number"
              required
              min={0}
              max={525600}
              name="reminder_minutes"
              defaultValue={60}
              className={inputClass}
            />
          </Field>
          <button disabled={busy} className={buttonClass}>
            创建任务
          </button>
        </form>
      </Panel>
    </div>
  )
}
