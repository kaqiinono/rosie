import { SUBJECTS } from '@/components/tree-demo/garden/model'
import { isEarly, tomatoWallet } from './rewards'
import { dayOf, shift, type DiaryNote, type TreeData, type WorkStep } from './types'

type GrowthDiaryEntry = DiaryNote & { tomatoChange?: number; doubled?: boolean; detail?: string }
type CompletedHomework = Pick<WorkStep, 'name' | 'subject' | 'occurrence'> & { completedAt: number }

export function growthDiary(tree: TreeData) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = shift(tree.today, index - 6)
    return { date, start: Date.parse(`${date}T00:00:00+08:00`), milliseconds: 0, tomatoes: 0, homework: [] as CompletedHomework[] }
  })
  const tomorrow = Date.parse(`${shift(tree.today, 1)}T00:00:00+08:00`)
  const dayByDate = new Map(days.map(day => [day.date, day]))
  const entries: GrowthDiaryEntry[] = [...(tree.diary ?? [])]
  const homeworkByOccurrence = new Map<string, WorkStep[]>()

  for (const step of tree.steps) {
    if (step.subject === 'life') continue
    const parts = homeworkByOccurrence.get(step.occurrence)
    if (parts) parts.push(step)
    else homeworkByOccurrence.set(step.occurrence, [step])
    if (step.skipped || !step.end) continue
    const end = Date.parse(step.end)
    if (!Number.isFinite(end)) continue
    const start = step.start ? Date.parse(step.start) : Number.NaN
    const sessionMs = end > start ? end - start : 0
    if (sessionMs && end > days[0].start && start < tomorrow) {
      for (let index = 0; index < days.length; index++) {
        const day = days[index]
        const dayEnd = days[index + 1]?.start ?? tomorrow
        day.milliseconds += Math.max(0, Math.min(end, dayEnd) - Math.max(start, day.start))
      }
    }
    if (!step.tomatoes) continue
    const day = dayByDate.get(dayOf(step.end))
    if (day) day.tomatoes += step.tomatoes
    const totalMs = step.flowers?.elapsedMs ?? sessionMs
    const doubled = step.flowers ? totalMs < step.minutes * 60_000 : isEarly(step)
    entries.push({
      id: `harvest:${step.id}`,
      t: step.end,
      icon: '🍅',
      text: step.name,
      tomatoChange: step.tomatoes,
      doubled,
      detail: `${step.flowers ? '整份用时' : '用时'} ${Math.ceil(totalMs / 60_000)} 分钟`,
    })
  }

  for (const parts of homeworkByOccurrence.values()) {
    const finalParts = parts.some(part => part.flowers) ? parts.filter(part => part.flowers?.complete) : parts
    const endTimes = finalParts.map(part => !part.skipped && part.end ? Date.parse(part.end) : Number.NaN)
    if (!endTimes.length || !endTimes.every(Number.isFinite)) continue
    const completedAt = Math.max(...endTimes)
    const day = dayByDate.get(dayOf(new Date(completedAt)))
    if (!day) continue
    const { occurrence, name, subject, flowers } = finalParts[endTimes.indexOf(completedAt)]
    day.homework.push({
      occurrence,
      name: !flowers && parts.length > 1 ? name.replace(/（[12]\/2）$/, '') : name,
      subject,
      completedAt,
    })
  }

  for (const spend of tree.tomatoSpends ?? []) {
    entries.push({
      id: `spend:${spend.id}`,
      t: spend.t,
      icon: spend.kind === 'gem' ? '💎' : '🎁',
      text: spend.kind === 'gem' ? `兑换 ${SUBJECTS[spend.color].stone}` : `抽中 ${spend.prize}`,
      tomatoChange: -spend.amount,
    })
  }

  const trend = days.map(day => ({
    date: day.date,
    minutes: Math.ceil(day.milliseconds / 60_000),
    tomatoes: day.tomatoes,
    completed: day.homework.length,
    homework: day.homework.sort((a, b) => b.completedAt - a.completedAt),
  }))
  const streak = tree.lastDoneDay === tree.today || tree.lastDoneDay === shift(tree.today, -1) ? tree.streak ?? 0 : 0
  return {
    trend,
    today: trend[6],
    streak,
    earned: tomatoWallet(tree).earned,
    entries: entries.filter(entry => Number.isFinite(Date.parse(entry.t))).sort((a, b) => Date.parse(b.t) - Date.parse(a.t)),
  }
}
