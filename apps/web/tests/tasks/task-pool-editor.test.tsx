import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Templates from '../../../../packages/tasks/src/components/Templates'

const { save, refresh } = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }))
vi.mock('../../../../packages/tasks/src/components/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../../packages/tasks/src/components/shared')>()
  return { ...actual, useTasks: () => ({
    api: { data: { pool_items: [], courses: [] }, save, refresh },
    busy: false, catalog: { chinese: [], english: [], math: [] },
    run: async (work: () => Promise<unknown>) => { try { await work(); return true } catch { return false } },
  }) }
})

function setup() {
  const view = render(<Templates />)
  fireEvent.change(screen.getByLabelText('任务名称'), { target: { value: '课后练习' } })
  fireEvent.change(screen.getByLabelText('科目'), { target: { value: 'english' } })
  return view.container.querySelector('form')!
}
async function submit(form: HTMLFormElement) { await act(async () => { fireEvent.submit(form) }) }
function change(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }) }

beforeEach(() => { save.mockReset().mockResolvedValue({}); refresh.mockReset().mockResolvedValue(undefined) })

describe('task pool editor constraint validation', () => {
  it.each(['-1', '1.5', '366'])('does not save invalid days-after count %s', async value => {
    const form = setup()
    change('截止规则', 'days_after')
    change('N 天', value)
    await submit(form)
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByLabelText('N 天')).toHaveFocus()
    expect(screen.getByRole('alert')).toHaveTextContent('N 天')
  })
  it.each(['-1', '0.5', '525601'])('does not save invalid before-class minutes %s', async value => {
    const form = setup()
    change('生成时机', 'before_class')
    change('提前多少分钟生成', value)
    await submit(form)
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByLabelText('提前多少分钟生成')).toHaveFocus()
  })
  it.each(['-525601', '1.5', '525601'])('does not save invalid reminder minutes %s', async value => {
    const form = setup()
    change('相差分钟', value)
    await submit(form)
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByLabelText('相差分钟')).toHaveAttribute('aria-invalid', 'true')
  })
  it.each(['0', '1.5', '1441'])('does not save invalid estimated minutes %s', async value => {
    const form = setup()
    change('预计分钟', value)
    await submit(form)
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByLabelText('预计分钟')).toHaveFocus()
  })
  it.each(['same_day', 'days_after'])('requires a deadline clock time for %s', async kind => {
    const form = setup()
    change('截止规则', kind)
    change('截止时刻', '')
    await submit(form)
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByLabelText('截止时刻')).toHaveFocus()
    expect(screen.getByLabelText('截止时刻')).toHaveAccessibleDescription(/截止时刻/)
  })
  it('requires a fixed deadline date and a first scheduled date', async () => {
    const form = setup()
    change('截止规则', 'fixed')
    await submit(form)
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByLabelText('截止日期时间（北京时间）')).toHaveFocus()
    change('截止规则', 'same_day')
    change('生成时机', 'once')
    await submit(form)
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByLabelText('首次生成时间（北京时间）')).toHaveFocus()
  })
  it.each([['0', '0', '-525600', '1'], ['365', '525600', '525600', '1440']])('preserves valid days/trigger/reminder/estimate boundaries %s/%s/%s/%s', async (days, trigger, reminder, estimate) => {
    const form = setup()
    change('生成时机', 'before_class')
    change('提前多少分钟生成', trigger)
    change('截止规则', 'days_after')
    change('N 天', days)
    change('截止时刻', '23:59')
    change('相差分钟', reminder)
    change('预计分钟', estimate)
    await submit(form)
    expect(save).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith('pool_items', expect.objectContaining({ estimated_minutes: Number(estimate), trigger_minutes: Number(trigger), deadline: expect.objectContaining({ days: Number(days), time: '23:59' }), reminders: [{ anchor: 'deadline', minutes: Number(reminder) }] }))
  })
  it('preserves an invalid draft and clears its accessible error after correction', async () => {
    const form = setup()
    change('截止规则', 'days_after')
    change('N 天', '1.5')
    await submit(form)
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByLabelText('任务名称')).toHaveValue('课后练习')
    change('N 天', '2')
    await submit(form)
    expect(save).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
