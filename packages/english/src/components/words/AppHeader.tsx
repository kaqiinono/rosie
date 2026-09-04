'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useWordsContext } from '../../WordsContext'

const BASE = '/english/words'

const TABS = [
  { id: 'cards', path: `${BASE}/cards`, icon: '🃏', label: '单词' },
  { id: 'practice', path: `${BASE}/practice`, icon: '✏️', label: '练习' },
  { id: 'daily', path: `${BASE}/daily`, icon: '📅', label: '计划' },
  { id: 'reading', path: `${BASE}/reading`, icon: '📖', label: '阅读' },
]

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
    <header className="sticky top-0 z-50 border-b border-[var(--wm-border)] bg-[var(--wm-bg)]/95 px-3 py-2.5 backdrop-blur-xl md:px-4">
      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2.5 md:flex md:flex-wrap md:justify-between md:gap-2.5">
        <Link href="/english" className="min-w-0">
          <div className="font-fredoka truncate bg-gradient-to-br from-[var(--wm-accent)] to-[var(--wm-accent2)] bg-clip-text text-xl font-bold whitespace-nowrap text-transparent md:text-2xl">
            📚 {username ?? 'Rosie'} Fun
          </div>
        </Link>

        {isReading && (
          <div
            className="flex items-center gap-1 justify-self-end rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] p-1"
            role="group"
            aria-label="切换阅读分类"
          >
            <span className="hidden px-1.5 text-[.7rem] font-extrabold text-[var(--wm-text-dim)] sm:inline">
              📚 分类
            </span>
            {([
              { id: 'houhai', label: '厚海', href: `${BASE}/reading?collection=houhai` },
              { id: 'story', label: 'Story', href: `${BASE}/reading?collection=story` },
            ] as const).map((collection) => {
              const active = collection.id === readingCollection
              return (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => router.push(collection.href)}
                  className={`font-nunito min-h-9 cursor-pointer rounded-[9px] px-3 text-[0.8rem] font-bold transition-all ${
                    active
                      ? 'bg-gradient-to-br from-[#0ea5e9] to-[#6366f1] text-white shadow-[0_3px_10px_rgba(99,102,241,.35)]'
                      : 'text-[var(--wm-text-dim)] hover:bg-[var(--wm-surface2)] hover:text-[var(--wm-text)]'
                  }`}
                >
                  {collection.label}
                </button>
              )
            })}
          </div>
        )}

        {!isReading && availableStages.length > 0 && (
          <>
            <label className="relative flex items-center justify-self-end md:hidden">
              <span className="sr-only">切换教材</span>
              <select
                value={selStage}
                onChange={(event) => setSelStage(event.target.value)}
                aria-label="切换教材"
                className={`font-nunito max-w-[7.5rem] cursor-pointer appearance-none rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] py-2 pr-7 pl-3 text-[0.8rem] font-bold text-[var(--wm-text)] transition-colors outline-none focus:border-[#6366f1] ${
                  isVocabLoading ? 'animate-pulse' : ''
                }`}
              >
                {availableStages.map((stage) => (
                  <option key={stage} value={stage}>
                    教材 {stage}
                  </option>
                ))}
              </select>
              <span
                aria-hidden
                className="pointer-events-none absolute right-2.5 text-[0.6rem] text-[var(--wm-text-dim)]"
              >
                ▼
              </span>
            </label>

            <div
              className="hidden items-center gap-1 rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] p-1 md:flex"
              role="group"
              aria-label="切换教材"
            >
              <span className="px-1.5 text-[.7rem] font-extrabold text-[var(--wm-text-dim)]">
                📗 教材
              </span>
              {availableStages.map((stage) => {
                const active = stage === selStage
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setSelStage(stage)}
                    disabled={active}
                    title={`切换到 ${stage}`}
                    className={`font-nunito flex shrink-0 cursor-pointer items-center gap-1 rounded-[9px] px-2.5 py-1.5 text-[0.8rem] font-bold whitespace-nowrap transition-all ${
                      active
                        ? 'bg-gradient-to-br from-[#0ea5e9] to-[#6366f1] text-white shadow-[0_3px_10px_rgba(99,102,241,.35)]'
                        : 'bg-transparent text-[var(--wm-text-dim)] hover:bg-[var(--wm-surface2)] hover:text-[var(--wm-text)]'
                    } ${active && isVocabLoading ? 'animate-pulse' : ''}`}
                  >
                    {stage}
                    {active && isVocabLoading && <span aria-hidden>·</span>}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <nav className="col-span-2 grid w-full grid-cols-4 gap-1 rounded-xl border border-[var(--wm-border)] bg-[var(--wm-surface)] p-1 md:flex md:w-auto">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.path)
            return (
              <button
                key={t.id}
                onClick={() => router.push(t.path)}
                title={t.label}
                aria-label={t.label}
                className={`font-nunito flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-[9px] px-2 py-2 text-[0.8rem] font-bold whitespace-nowrap transition-all md:shrink-0 md:px-2.5 md:py-1.5 md:text-[0.875rem] ${
                  active
                    ? 'bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] text-white shadow-[0_3px_10px_rgba(233,69,96,.35)]'
                    : 'bg-transparent text-[var(--wm-text-dim)] hover:bg-[var(--wm-surface2)] hover:text-[var(--wm-text)]'
                }`}
              >
                <span aria-hidden className="text-[1rem] leading-none">
                  {t.icon}
                </span>
                <span>{t.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
