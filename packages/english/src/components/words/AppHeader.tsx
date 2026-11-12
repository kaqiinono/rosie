'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useWordsContext } from '../../WordsContext'
import { FormSelect, LearningIcon } from '@rosie/ui'
import { Button } from '@rosie/ui/themes'

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
  const readingCollection =
    pathname.includes('/reading/story') || searchParams.get('collection') === 'story'
      ? 'story'
      : 'houhai'

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--wm-border)] bg-[var(--wm-bg)]/95 px-3 py-2.5 md:px-4">
      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2.5 md:flex md:flex-wrap md:justify-between md:gap-2.5">
        <Link href="/english" className="min-w-0">
          <div className="font-fredoka truncate text-xl font-bold whitespace-nowrap text-[var(--wm-accent)] md:text-2xl">
            📚 {username ?? 'Rosie'} Fun
          </div>
        </Link>

        {isReading && (
          <div
            className="flex items-center gap-2 justify-self-end rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] p-1.5 sm:gap-3"
            role="group"
            aria-label="切换阅读分类"
          >
            <span className="hidden items-center gap-1.5 pl-1 text-xs font-extrabold text-[var(--wm-text-dim)] sm:inline-flex">
              <LearningIcon name="focus" size={18} />
              分类
            </span>
            {(
              [
                { id: 'houhai', label: '厚海', href: `${BASE}/reading?collection=houhai` },
                { id: 'story', label: 'Story', href: `${BASE}/reading?collection=story` },
              ] as const
            ).map((collection) => {
              const active = collection.id === readingCollection
              return (
                <Button
                  key={collection.id}
                  type="button"
                  onClick={() => router.push(collection.href)}
                  aria-pressed={active}
                  variant={active ? 'solid' : 'soft'}
                  color={active ? 'indigo' : 'gray'}
                  size="2"
                >
                  {collection.label}
                </Button>
              )
            })}
          </div>
        )}

        {!isReading && availableStages.length > 0 && (
          <>
            <div className="flex items-center justify-self-end md:hidden">
              <FormSelect
                size="2"
                value={selStage}
                onValueChange={setSelStage}
                ariaLabel="切换教材"
                className="max-w-[7.5rem]"
                options={availableStages.map((stage) => ({
                  value: stage,
                  label: `教材 ${stage}`,
                }))}
              />
            </div>

            <div
              className="hidden items-center gap-2 rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] p-1 md:flex"
              role="group"
              aria-label="切换教材"
            >
              <span className="px-1.5 text-sm font-extrabold whitespace-nowrap text-[var(--wm-text-dim)]">
                📗 教材
              </span>
              {availableStages.map((stage) => {
                const active = stage === selStage
                return (
                  <Button
                    key={stage}
                    type="button"
                    onClick={() => {
                      if (!active) setSelStage(stage)
                    }}
                    aria-pressed={active}
                    title={`切换到 ${stage}`}
                    variant={active ? 'solid' : 'soft'}
                    color={active ? 'indigo' : 'gray'}
                    size="2"
                    className="shrink-0 whitespace-nowrap"
                  >
                    {stage}
                    {active && isVocabLoading && <span aria-hidden>·</span>}
                  </Button>
                )
              })}
            </div>
          </>
        )}

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
