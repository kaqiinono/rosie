import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MathVideoReport from '@/components/settings/MathVideoReport'
import type { MathVideoReport as Report } from '@/lib/baidu-math-video-report-types'
import { requestBaiduVideoData } from '@/components/settings/baidu-video-client'

vi.mock('@/components/settings/baidu-video-client', () => ({
  requestBaiduVideoData: vi.fn(), videoSyncTime: (value: string) => value,
  VIDEO_SECONDARY_BUTTON: '',
}))
vi.mock('@rosie/ui', () => ({
  SelectControl: ({ value, options, onValueChange, ariaLabel }: {
    value: string; options: { value: string; label: string }[];
    onValueChange: (value: string) => void; ariaLabel: string;
  }) => <select aria-label={ariaLabel} value={value} onChange={(event) => onValueChange(event.target.value)}>
    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>,
}))

const report: Report = {
  lessonKey: '2-10', syncedAt: '2026-10-25T09:52:46Z', directory: '/airosie/math/ny',
  summary: { files: 1, matchedFiles: 0, videoKeys: 1, problems: 0, matched: 0, missing: 0,
    unknown: 0, conflictKeys: 0, invalidProblems: 0, orphanFiles: 1, invalidFiles: 0 },
  problems: [],
  files: [{ path: '/airosie/math/ny/2-10-L99.mp4', filename: '2-10-L99.mp4', key: '2-10-L99',
    parsedQuestionNumber: 'L99', grade: 2, lessonKey: '2-10', status: 'orphan', reason: '无对应题目' }],
}
const request = vi.mocked(requestBaiduVideoData)

beforeEach(() => { request.mockReset(); request.mockResolvedValue(report) })
afterEach(cleanup)

describe('math video matching report', () => {
  it('keeps unmatched paths visible when sources change, without fetching again', async () => {
    const { rerender } = render(<MathVideoReport userId="u1" lessonKey="2-10" revision={report.syncedAt} sources={['lesson']} />)
    expect(await screen.findByText('实际网盘路径：/airosie/math/ny/2-10-L99.mp4')).toBeInTheDocument()
    rerender(<MathVideoReport userId="u1" lessonKey="2-10" revision={report.syncedAt} sources={['homework']} />)
    expect(screen.getByText('实际网盘路径：/airosie/math/ny/2-10-L99.mp4')).toBeInTheDocument()
    expect(request).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: '对照本讲题目编号' }))
    expect(screen.getByText('待排查文件：/airosie/math/ny/2-10-L99.mp4')).toBeInTheDocument()
  })

  it('shows loading during a retry and preserves the old report on failure', async () => {
    render(<MathVideoReport userId="u1" lessonKey="2-10" revision={report.syncedAt} sources={['lesson']} />)
    await screen.findByText('实际网盘路径：/airosie/math/ny/2-10-L99.mp4')
    await waitFor(() => expect(screen.getByRole('button', { name: '重新读取报告' })).toBeEnabled())
    let rejectRequest: (reason: Error) => void = () => {}
    request.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRequest = reject }))
    fireEvent.click(screen.getByRole('button', { name: '重新读取报告' }))
    expect(screen.getByRole('button', { name: '重新读取报告' })).toBeDisabled()
    expect(screen.getByText('正在读取已保存的快照…')).toBeInTheDocument()
    rejectRequest(new Error('读取失败'))
    expect(await screen.findByRole('alert')).toHaveTextContent('下方保留上次读取的报告')
    expect(screen.getByText('实际网盘路径：/airosie/math/ny/2-10-L99.mp4')).toBeInTheDocument()
  })
})
