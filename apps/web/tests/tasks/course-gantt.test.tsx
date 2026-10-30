import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CourseGantt from '../../../../packages/tasks/src/components/planning/CourseGantt'
import AllocationDetails from '../../../../packages/tasks/src/components/planning/AllocationDetails'
import { input, result } from './planning-view-fixture'
describe('course gantt', () => {
  it('exposes exact handmarked weekend capacity, forecast line style and original task navigation', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <CourseGantt
        result={result}
        demands={input.demands}
        capacity={input.capacity}
        view="capacity"
        onSelectAllocation={onSelect}
      />,
    )
    expect(screen.getByText(/非自然时间比例/)).toBeInTheDocument()
    expect(screen.getByText(/60 分钟 · 周末人工备用/)).toBeInTheDocument()
    expect(container.querySelector('button.border-dashed')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '定位原始任务' })).toHaveAttribute(
      'href',
      '/tasks?task=task-1#task-task-1',
    )
    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent?.includes('正式建议'))!)
    expect(onSelect).toHaveBeenCalledWith(result.allocations[0])
  })
  it('provides mobile daily aggregation and focusable short fragments with explicit fixed status', () => {
    render(
      <CourseGantt
        result={{ ...result, allocations: [{ ...result.allocations[1], fixed: true }] }}
        demands={input.demands}
        capacity={input.capacity}
        view="dates"
        onSelectAllocation={() => {}}
      />,
    )
    expect(screen.getByText('每日聚合')).toBeInTheDocument()
    expect(screen.getByText(/已固定 ▥/)).toBeInTheDocument()
  })
  it('keeps zero-capacity explicit and allocation exact details readable', () => {
    render(
      <CourseGantt
        result={{ ...result, allocations: [] }}
        demands={input.demands}
        capacity={[]}
        view="capacity"
        onSelectAllocation={() => {}}
      />,
    )
    expect(screen.getByText(/没有手动可用容量/)).toBeInTheDocument()
    render(
      <AllocationDetails
        allocation={result.allocations[1]}
        demand={input.demands[1]}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText(/未来预计 · 任务尚未生成/)).toBeInTheDocument()
    expect(screen.getByText(/10 分钟 · Asia/)).toBeInTheDocument()
  })
})

import { undatedScenario } from './planning-view-fixture'
it('keeps solver undated fixed allocations in course task text navigation without a manufactured cutoff', () => {
  const s = undatedScenario()
  render(
    <CourseGantt
      result={s.result.allow_weekend}
      demands={s.input.demands}
      {...{ undated: s.input.undated_work }}
      capacity={s.input.capacity}
      view="dates"
      courseNames={{ math: '数学', english: '英语' }}
      onSelectAllocation={() => {}}
    />,
  )
  expect(screen.getAllByRole('link', { name: '定位原始任务' })).toHaveLength(2)
  expect(screen.getAllByText(/未设置截止，仅固定承诺/)).toHaveLength(2)
  expect(screen.queryByText(/截止点/)).not.toBeInTheDocument()
})
it('repositions far-date selected batches while keeping a keyboard today action', () => {
  const scroll = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scroll })
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
    configurable: true,
    get() {
      const day = (this as HTMLElement).dataset.planningDay
      return day ? ((Date.parse(day) - Date.parse('2026-10-30')) / 86400000) * 208 + 208 : 0
    },
  })
  const far = {
    ...input.demands[0],
    release_at: '2027-02-01T04:00:00Z',
    due_at: '2027-02-02T04:00:00Z',
  }
  render(
    <CourseGantt
      result={{
        ...result,
        horizon_end: '2027-03-01T04:00:00Z',
        allocations: [
          { ...result.allocations[0], start: far.release_at, end: '2027-02-01T04:50:00Z' },
        ],
      }}
      demands={[far]}
      capacity={[]}
      view="dates"
      selectedBatch={far.batch_key}
      onSelectAllocation={() => {}}
    />,
  )
  expect(scroll).toHaveBeenCalledWith(
    expect.objectContaining({
      left: ((Date.parse(far.release_at.slice(0, 10)) - Date.parse('2026-10-30')) / 86400000) * 208,
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: '回到今天' }))
  expect(scroll).toHaveBeenLastCalledWith(expect.objectContaining({ left: 0 }))
})
