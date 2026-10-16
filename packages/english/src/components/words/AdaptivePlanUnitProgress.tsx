import type { AdaptivePlanWordProgress } from '../../utils/adaptivePlanTypes'
import type { SimulateAdaptivePlanResult } from '../../utils/adaptivePlanSimulate'

type ProgressStatus = 'notStarted' | 'started' | 'inProgress' | 'waitingBoss' | 'completed'

type ProgressGroup = {
  name: string
  rows: AdaptivePlanWordProgress[]
  lessons: Map<string, AdaptivePlanWordProgress[]>
}

const STATUS_STYLE: Record<ProgressStatus, { label: string; className: string }> = {
  notStarted: { label: '未开始', className: 'bg-white/[.06] text-[var(--wm-text-dim)]' },
  started: { label: '已开始', className: 'bg-[rgba(96,165,250,.12)] text-[#93c5fd]' },
  inProgress: { label: '进行中', className: 'bg-[rgba(167,139,250,.12)] text-[#c4b5fd]' },
  waitingBoss: { label: '待完成', className: 'bg-[rgba(245,158,11,.12)] text-[#fbbf24]' },
  completed: { label: '已完成', className: 'bg-[rgba(74,222,128,.12)] text-[#86efac]' },
}

function isBossPending(row: AdaptivePlanWordProgress): boolean {
  return row.status === 'LEARNING_PENDING' && row.boxIndex === 5 && row.targetBox == null
}

function wasActivated(row: AdaptivePlanWordProgress): boolean {
  return row.introducedOn != null || row.status === 'LEARNING' || isBossPending(row)
}

function progressStatus(rows: AdaptivePlanWordProgress[]): ProgressStatus {
  if (rows.every((row) => row.status === 'MASTERED')) return 'completed'
  if (rows.every((row) => row.status === 'MASTERED' || isBossPending(row))) {
    return 'waitingBoss'
  }

  const needsActivation = rows.filter((row) => row.status !== 'MASTERED' || row.introducedOn != null)
  const activated = needsActivation.filter(wasActivated).length
  if (activated === 0) return 'notStarted'
  return activated < needsActivation.length ? 'started' : 'inProgress'
}

function progressCounts(rows: AdaptivePlanWordProgress[]) {
  return {
    activated: rows.filter(wasActivated).length,
    mastered: rows.filter((row) => row.status === 'MASTERED').length,
    total: rows.length,
  }
}

function statusWordCount(rows: AdaptivePlanWordProgress[], status: ProgressStatus): number {
  if (status === 'notStarted') {
    return rows.filter((row) => row.status !== 'MASTERED' && !wasActivated(row)).length
  }
  if (status === 'started') return rows.filter(wasActivated).length
  if (status === 'inProgress') {
    return rows.filter((row) => wasActivated(row) && row.status !== 'MASTERED' && !isBossPending(row)).length
  }
  if (status === 'waitingBoss') return rows.filter(isBossPending).length
  return rows.filter((row) => row.status === 'MASTERED').length
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function groupProgress(rows: AdaptivePlanWordProgress[]): ProgressGroup[] {
  const byUnit = new Map<string, ProgressGroup>()
  for (const row of rows) {
    const [unit, lesson] = row.wordKey.split('::')
    if (!unit || !lesson) continue
    let group = byUnit.get(unit)
    if (!group) {
      group = { name: unit, rows: [], lessons: new Map() }
      byUnit.set(unit, group)
    }
    group.rows.push(row)
    const lessonRows = group.lessons.get(lesson) ?? []
    lessonRows.push(row)
    group.lessons.set(lesson, lessonRows)
  }
  return [...byUnit.values()].sort((a, b) => compareNames(a.name, b.name))
}

function StatusBadge({ status, rows }: { status: ProgressStatus; rows: AdaptivePlanWordProgress[] }) {
  const style = STATUS_STYLE[status]
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[.65rem] font-extrabold ${style.className}`}>
      {style.label} {statusWordCount(rows, status)}/{rows.length}
    </span>
  )
}

export default function AdaptivePlanUnitProgress({
  rows,
  simulation,
}: {
  rows: AdaptivePlanWordProgress[]
  simulation: SimulateAdaptivePlanResult
}) {
  const units = groupProgress(rows)
  const nextDay = simulation.days[0]
  const currentKeys = nextDay?.newWordKeys.length
    ? nextDay.newWordKeys
    : nextDay?.mode === 'boss'
      ? nextDay.bossWordKeys
      : nextDay?.reviewWordKeys ?? []
  const currentLessons = [...new Set(currentKeys.map((key) => key.split('::').slice(0, 2).join(' · ')))]

  return (
    <section id="unit-progress" className="mb-5 scroll-mt-6 rounded-[24px] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-6">
      <div className="mb-4">
        <h2 className="font-fredoka text-xl text-[#93c5fd]">Unit / Lesson 进度</h2>
        <p className="mt-1 text-[.72rem] font-bold text-[var(--wm-text-dim)]">
          {currentLessons.length > 0
            ? `${nextDay?.mode === 'boss' ? '当前 Boss 验收' : '下一批涉及'}：${currentLessons.join('、')}`
            : '当前没有待执行的课程'}
        </p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {units.map((unit) => {
          const counts = progressCounts(unit.rows)
          return (
            <details
              key={unit.name}
              className="rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface2)]"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-3 marker:hidden">
                <span className="min-w-0 font-extrabold text-[var(--wm-text)]">{unit.name}</span>
                <StatusBadge status={progressStatus(unit.rows)} rows={unit.rows} />
                <span className="ml-auto text-[.68rem] font-bold text-[var(--wm-text-dim)]">
                  已掌握 {counts.mastered}/{counts.total}
                </span>
              </summary>
              <div className="border-t border-[var(--wm-border)] px-3 pb-3 pt-2 text-[.7rem] font-bold text-[var(--wm-text-dim)]">
                <div className="mb-2">已激活 {counts.activated}/{counts.total} · 已掌握 {counts.mastered}/{counts.total}</div>
                <div className="space-y-1.5">
                  {[...unit.lessons.entries()]
                    .sort(([a], [b]) => compareNames(a, b))
                    .map(([lesson, lessonRows]) => {
                      const lessonCounts = progressCounts(lessonRows)
                      return (
                        <div key={lesson} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg bg-white/[.03] px-2 py-1.5">
                          <span className="font-extrabold text-[var(--wm-text)]">{lesson}</span>
                          <StatusBadge status={progressStatus(lessonRows)} rows={lessonRows} />
                          <span className="ml-auto">已掌握 {lessonCounts.mastered}/{lessonCounts.total}</span>
                        </div>
                      )
                    })}
                </div>
              </div>
            </details>
          )
        })}
      </div>
      <p className="mt-3 text-[.65rem] font-bold text-[var(--wm-text-dim)]">
        创建计划前已掌握的词无需再次激活；“待完成”表示剩余词均在第 5 箱等待 Boss 验收。
      </p>
    </section>
  )
}
