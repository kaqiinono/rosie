'use client'
import type { TaskAllocation, TaskDemand } from '../../planning/types'
import { minorClass } from '../shared'
import { planningTime } from './presentation'
export default function AllocationDetails({
  allocation,
  demand,
  onClose,
}: {
  allocation: TaskAllocation
  demand?: TaskDemand
  onClose: () => void
}) {
  return (
    <section
      aria-label="片段详情"
      className="space-y-2 rounded-xl border-2 border-emerald-800 bg-white p-4"
      tabIndex={-1}
    >
      <h3 className="font-bold">
        {allocation.fixed
          ? '已固定安排'
          : demand?.origin === 'forecast'
            ? '未来预计 · 任务尚未生成'
            : '正式任务建议'}
      </h3>
      <p className="text-sm tabular-nums">
        {planningTime(allocation.start)} — {planningTime(allocation.end)} · {allocation.minutes}{' '}
        分钟 · Asia/Shanghai
      </p>
      <p className="text-sm">
        {allocation.kind === 'weekend_reserve'
          ? '占用人工标记周末备用时段'
          : '占用人工标记周中时段'}
        ；安排不表示实际完成。
      </p>
      {demand?.task_id && (
        <a
          className="text-emerald-800 underline"
          href={`/tasks?task=${encodeURIComponent(demand.task_id)}#task-${encodeURIComponent(demand.task_id)}`}
        >
          查看原始任务
        </a>
      )}
      <button className={`${minorClass} block`} onClick={onClose}>
        收起详情
      </button>
    </section>
  )
}
