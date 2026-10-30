import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CourseRiskList from '../../../../packages/tasks/src/components/planning/CourseRiskList'
import { input, result } from './planning-view-fixture'
describe('course risk view', () => {
  it('retains shortages and forecast labels, never shows safe green for an incomplete model', () => {
    const selected = vi.fn()
    const { container } = render(
      <CourseRiskList
        result={result}
        demands={input.demands}
        courseNames={{ math: '数学', english: '英语' }}
        onSelectBatch={selected}
      />,
    )
    expect(screen.getByText(/含未来预计任务/)).toBeInTheDocument()
    expect(screen.getByText(/缺口 30 分钟/)).toBeInTheDocument()
    expect(container.querySelector('.bg-emerald-50')).toBeNull()
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(selected).toHaveBeenCalledWith('batch-math')
  })
  it('replaces safe status on expiry and distinguishes progress, coverage and independent headroom', () => {
    render(
      <CourseRiskList
        result={{ ...result, complete: true }}
        demands={input.demands}
        stale
        onSelectBatch={() => {}}
      />,
    )
    expect(screen.getAllByText(/预测已过期/)).toHaveLength(2)
    expect(screen.getAllByText(/实际完成（按预计用时加权）/)).toHaveLength(2)
    expect(screen.getAllByText(/本批今天至少：未知/)).toHaveLength(2)
    expect(screen.getByText(/不可相加/)).toBeInTheDocument()
  })
})

import { undatedScenario } from './planning-view-fixture'
it('preserves course identity, actual completion and missing-deadline labels for solver fixed-only work', () => {
  const s = undatedScenario()
  expect(s.input.demands).toHaveLength(0)
  expect(s.result.allow_weekend.allocations).toHaveLength(2)
  expect(s.result.allow_weekend.batch_metrics['undated-partial'].unallocated_minutes).toBe(30)
  expect(s.result.allow_weekend.batch_metrics['undated-full'].unallocated_minutes).toBe(0)
  render(
    <CourseRiskList
      result={s.result.allow_weekend}
      demands={s.input.demands}
      {...{ undated: s.input.undated_work }}
      tasks={s.tasks}
      courseNames={{ math: '数学', english: '英语' }}
      onSelectBatch={() => {}}
    />,
  )
  expect(screen.getByRole('heading', { name: /数学/ })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /英语/ })).toBeInTheDocument()
  expect(screen.getAllByText(/未设置截止 · 仅固定承诺/)).toHaveLength(2)
  expect(screen.getAllByText(/25%/)).toHaveLength(2)
})
it('identifies two issue-only courses without inventing metrics', () => {
  render(
    <CourseRiskList
      result={{
        ...result,
        batch_metrics: {},
        issues: ['manual-a', 'manual-b'].map((id) => ({
          code: 'manual_demand_unmodeled',
          affected_keys: [id, 'event'],
          detail: '手动任务尚未建模',
        })),
      }}
      courseNames={{ 'manual-a': '美术', 'manual-b': '音乐' }}
      onSelectBatch={() => {}}
    />,
  )
  expect(screen.getByRole('link', { name: '配置美术' })).toHaveAttribute(
    'href',
    '/tasks/timetable?course=manual-a',
  )
  expect(screen.getByRole('link', { name: '配置音乐' })).toHaveAttribute(
    'href',
    '/tasks/timetable?course=manual-b',
  )
  expect(screen.queryByText(/独立余量：/)).not.toBeInTheDocument()
})
