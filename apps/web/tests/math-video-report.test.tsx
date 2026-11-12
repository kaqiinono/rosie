import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MathVideoReport from '@/components/settings/MathVideoReport'
import MathVideoFilePicker from '@/components/settings/MathVideoFilePicker'
import type { MathVideoEditor } from '@/lib/baidu-math-video-report-types'

vi.mock('@/components/settings/baidu-video-client', () => ({ VIDEO_SECONDARY_BUTTON: '' }))
afterEach(cleanup)

const editor: MathVideoEditor = {
  lessonKey: '2-10', generation: 'account-version',
  directoryId: 'dir', mainPath: '/数学', selectedId: 'dir', selectedPath: '/数学',
  directories: [{ id: 'dir', path: '/数学' }],
  revision: 'lesson-version', version: 'scan-version', reviewNames: ['旧文件.mp4'],
  savedAt: '2026-11-01T01:00:00Z', syncedAt: '2026-11-01T01:01:00Z',
  files: { '90071992547409931': '鸡兔同笼-附加1.mp4', '123': '课堂.mp4' },
  occupied: { '123': { lessonKey: '2-9', problemId: '2-9-L2' } },
  bindings: [{ problemId: '2-10-L1', fileId: '456', name: '原课堂.mp4', available: false }],
  problems: [{ id: '2-10-L1', label: 'L1', source: 'lesson', title: '课堂例题' },
    { id: '2-10-S1', label: 'S1', source: 'supplement', title: '附加题' }],
}

describe('手动绑定数学回放', () => {
  it('keeps a missing published binding distinct from an unbound problem', () => {
    render(<MathVideoReport editor={editor} />)
    fireEvent.click(screen.getByRole('button', { name: '查看匹配报告' }))
    expect(screen.getByText('文件缺失（1）')).toBeInTheDocument()
    expect(screen.getByText('未绑定（1）')).toBeInTheDocument()
    expect(screen.getByText(/L1 · 课堂例题 → 原课堂.mp4/)).toBeInTheDocument()
    expect(screen.getByText('旧清单待确认（1）')).toBeInTheDocument()
  })

  it('prevents cross-lesson reuse and selects a Chinese filename by its exact provider ID', () => {
    const choose = vi.fn()
    render(<MathVideoFilePicker editor={editor} picks={{}} problemId="2-10-S1" choose={choose} />)
    expect(screen.getByRole('button', { name: /已占用：2-9/ })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('搜索视频文件名'), { target: { value: '附加' } })
    fireEvent.click(screen.getByRole('button', { name: '鸡兔同笼-附加1.mp4' }))
    expect(choose).toHaveBeenCalledWith('90071992547409931')
  })
})
