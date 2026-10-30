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
    fireEvent.click(screen.getAllByRole('button')[0])
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
