'use client'
import type { CapacityInterval } from '../../planning/types'
import { planningDay, planningTime } from './presentation'
export type GanttView = 'dates' | 'capacity'
export default function GanttAxis({
  capacity,
  view,
}: {
  capacity: CapacityInterval[]
  view: GanttView
}) {
  return (
    <div className="space-y-2 text-sm text-slate-600">
      <p>
        {view === 'dates'
          ? '自然日期概览：等宽日期列；每日片段聚合，展开可查精确时刻。'
          : '可用时段展开：非自然时间比例；仅展示手动标记后扣除课程的容量，空隙已折叠。'}
      </p>
      <details>
        <summary className="cursor-pointer rounded py-2 focus-visible:outline-2">
          手动容量明细 · {capacity.length} 段
        </summary>
        <ul className="space-y-2">
          {capacity.map((c) => (
            <li key={c.key}>
              {planningDay(c.start)} · {planningTime(c.start)} — {planningTime(c.end)} · {c.minutes}{' '}
              分钟 · {c.kind === 'weekend_reserve' ? '周末人工备用' : '周中人工时段'}
            </li>
          ))}
          {!capacity.length && <li>没有手动可用容量；未配置与明确不可用均不会生成全天容量。</li>}
        </ul>
      </details>
    </div>
  )
}
