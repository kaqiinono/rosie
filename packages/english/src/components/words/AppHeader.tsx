'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useWordsContext } from '../../WordsContext'
import { LearningIcon } from '@rosie/ui'
import { Button, DropdownMenu } from '@rosie/ui/themes'

const BASE = '/english/words'

const TABS = [
  { id: 'cards', path: `${BASE}/cards`, icon: 'wordCards', label: '单词' },
  { id: 'practice', path: `${BASE}/practice`, icon: 'learn', label: '练习' },
  { id: 'daily', path: `${BASE}/daily`, icon: 'plan', label: '计划' },
  { id: 'reading', path: `${BASE}/reading`, icon: 'focus', label: '阅读' },
] as const

export default function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { availableStages, selStage, setSelStage, isVocabLoading } = useWordsContext()
  const raw = user?.email?.replace('@rosie.app', '') ?? user?.email?.split('@')[0]
  const username = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : undefined
  const isReading = pathname.includes('/reading')
  const isPet = pathname.startsWith(`${BASE}/practice/pet`)
  const houhai = ['4A', '4B', '5A', '5B'].filter((stage) => availableStages.includes(stage))
  const grades = ['G2', 'G3', 'G4']
  const psStage = (grade: string) =>
    availableStages.find((stage) => stage === `PS-${grade}-BJ-DICT`) ??
    availableStages.find((stage) => stage === grade || stage === `PS-${grade}`)
  const psGrades = grades.flatMap((label) => {
    const stage = psStage(label)
    return stage ? [{ label, stage }] : []
  })
  const grade = psGrades.find((item) => item.stage === selStage)?.label
  const activeLabel = isPet ? 'PET'
    : houhai.includes(selStage) ? `厚海 / ${selStage}`
    : grade ? `PS / ${grade}` : selStage || '选择教材'

  function selectStage(stage: string) {
    setSelStage(stage)
    if (isReading && (stage === '4A' || stage === '5A')) {
      router.push(`${BASE}/reading?collection=houhai&volume=${stage}`)
    } else if (isReading || isPet || searchParams.has('stage')) {
      router.push(`${BASE}/cards`)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--wm-border)] bg-[var(--wm-bg)]/95 px-3 py-2.5 md:px-4">
      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2.5 md:flex md:flex-wrap md:justify-between md:gap-2.5">
        <Link href="/english" className="min-w-0">
          <div className="font-fredoka truncate text-xl font-bold whitespace-nowrap text-[var(--wm-accent)] md:text-2xl">
            📚 {username ?? 'Rosie'} Fun
          </div>
        </Link>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <Button variant="soft" className="justify-self-end" aria-label={`切换教材，当前：${activeLabel}`}>
              {activeLabel}{isVocabLoading && ' ·'} <DropdownMenu.TriggerIcon />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            {[
              { label: '厚海', entries: houhai.map((stage) => ({ label: stage, stage })) },
              { label: 'PS', entries: psGrades },
            ].filter((group) => group.entries.length > 0).map((group) => (
              <DropdownMenu.Sub key={group.label}>
                <DropdownMenu.SubTrigger>{group.label}</DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                  {group.entries.map(({ label, stage }) => (
                    <DropdownMenu.Item key={stage} onSelect={() => selectStage(stage)}>
                      {label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
            ))}
            {['KET', 'PET'].map((stage) => (
              <DropdownMenu.Item key={stage} disabled={!availableStages.includes(stage)} onSelect={() => selectStage(stage)}>
                {stage}
              </DropdownMenu.Item>
            ))}
            {availableStages.filter((stage) => !houhai.includes(stage) && !grades.some((g) => psStage(g) === stage)
              && !['KET', 'PET', 'STORY'].includes(stage.toUpperCase())).map((stage) => (
              <DropdownMenu.Item key={stage} onSelect={() => selectStage(stage)}>{stage}</DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        <nav className="col-span-2 grid w-full grid-cols-4 gap-1 rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] p-1 md:flex md:w-auto">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.path)
            return (
              <Button
                key={t.id}
                asChild
                variant={active ? 'solid' : 'soft'}
                color={active ? 'red' : 'gray'}
                size="2"
                className="min-w-0 whitespace-nowrap md:shrink-0 md:text-[0.875rem]"
              >
                <Link href={t.path} title={t.label} aria-current={active ? 'page' : false}>
                  <LearningIcon name={t.icon} />
                  <span>{t.label}</span>
                </Link>
              </Button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
