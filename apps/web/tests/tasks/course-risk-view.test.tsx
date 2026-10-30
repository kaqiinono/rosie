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
