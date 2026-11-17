import { StickerCard } from '@rosie/ui'
import { Badge, Heading, Progress, Text } from '@rosie/ui/themes'
import type { homeworkTomatoProgress } from '@/lib/time-tree/rewards'
import HomeworkTomatoMascot from './HomeworkTomatoMascot'

const STAGES = [
  { icon: '🌱', label: '小种子', at: 0 },
  { icon: '🌿', label: '冒新芽', at: 20 },
  { icon: '🌼', label: '开小花', at: 45 },
  { icon: '🍏', label: '青番茄', at: 70 },
  { icon: '🍅', label: '熟透啦', at: 100 },
]
const ROUND_DOT = 'grid size-6 shrink-0 place-items-center rounded-full border-2 bg-[var(--tomato-3)] text-xs'
const ACTIVE_ROUND_RING = 'border-[var(--tomato-9)] ring-2 ring-[var(--tomato-5)]'

export default function HomeworkTomatoTimer({ progress }: { progress: ReturnType<typeof homeworkTomatoProgress> }) {
  const { started, rounds, completed, round, seconds, percent, justRipened } = progress
  const hasCurrentRound = completed < rounds
  const minutes = Math.floor(seconds / 60)
  const clock = [minutes, seconds % 60].map(value => String(value).padStart(2, '0')).join(':')

  return (
    <StickerCard as="section" aria-label="番茄钟" tone="white" size="sm">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-center md:flex md:flex-col md:gap-3 md:p-2">
        <div className="col-start-2 row-start-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 md:w-full md:justify-between">
          <Heading as="h3" size="3">番茄钟</Heading>
          <div className="flex items-center gap-1.5">
            <Badge color="tomato" variant="soft" size="2" className="whitespace-nowrap tabular-nums">
              第 {round} / {rounds} 轮
            </Badge>
            {hasCurrentRound && (
              <span aria-hidden="true" className={`${ROUND_DOT} ${ACTIVE_ROUND_RING} md:[@media(min-height:481px)]:hidden`}>🌱</span>
            )}
          </div>
        </div>
        <div className="relative col-start-1 row-span-3 row-start-1 grid size-20 place-items-center rounded-full bg-[var(--tomato-2)] md:aspect-square md:h-[min(11.5rem,30dvh)] md:w-auto lg:h-[min(14rem,30dvh)]">
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r="47" fill="none" stroke="var(--tomato-4)" strokeWidth="6" />
            {percent > 0 && <circle cx="50" cy="50" r="47" fill="none" stroke="var(--tomato-9)" strokeWidth="6"
              strokeLinecap="round" pathLength="100" strokeDasharray={`${percent} 100`} />}
          </svg>
          <HomeworkTomatoMascot focused={started && hasCurrentRound} celebrating={justRipened} />
        </div>
        <Text role="timer" aria-label={`本轮剩余 ${minutes} 分 ${seconds % 60} 秒`}
          className="col-start-2 row-start-2 text-2xl leading-none font-bold tabular-nums md:text-5xl">
          {clock}
        </Text>
        <div className="col-start-2 row-start-3 flex w-full flex-col gap-1 md:gap-2">
          <ol className="hidden grid-cols-5 gap-1 md:grid [@media(max-height:480px)]:hidden" aria-label="番茄成长阶段">
            {STAGES.map(({ icon, label, at }) => (
              <li key={label} className={percent >= at ? undefined : 'text-text-secondary'}>
                <span aria-hidden="true" className={`block text-lg ${percent >= at ? '' : 'opacity-50 grayscale'}`}>{icon}</span>
                <span className="whitespace-nowrap text-xs">{label}</span>
              </li>
            ))}
          </ol>
          <Progress value={percent} color="tomato" aria-label="本轮番茄成长进度" />
          <Text size="2" weight="bold" color={justRipened ? 'tomato' : undefined} className="tabular-nums">
            {justRipened ? '种熟 1 颗' : started ? `已熟 ${completed} 颗` : '等待开始'}
          </Text>
          <ol aria-hidden="true" className="hidden flex-wrap justify-center gap-1.5 md:[@media(min-height:481px)]:flex">
            {Array.from({ length: rounds }, (_, index) => {
              const active = hasCurrentRound && index + 1 === round
              return (
                <li key={index} className={`${ROUND_DOT} ${active ? ACTIVE_ROUND_RING : 'border-[var(--tomato-5)]'}`}>
                  {index < completed ? '🍅' : active ? '🌱' : '○'}
                </li>
              )
            })}
          </ol>
        </div>
        <Text size="2" color="gray" role="status" className="hidden md:block">
          {completed === rounds ? `番茄都熟啦，做完后收 ${rounds} 颗` : `提前做完可收 ${rounds * 2} 颗番茄`}
        </Text>
      </div>
    </StickerCard>
  )
}
