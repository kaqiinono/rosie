'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import {
  CHINESE_BOOKS,
  getChineseBook,
  useChineseCharData,
  useChineseCharAdmin,
  type ChineseBookSlug,
  type ChineseCharProfile,
  type ChineseLessonRow,
} from '@rosie/chinese'
import ChineseCharFormModal from './ChineseCharFormModal'
import ChineseLessonRecallModal from './ChineseLessonRecallModal'

type Props = { user: User | null }
type Tab = 'chars' | 'lessons'
type BookFilter = ChineseBookSlug | 'all'
type UnitFilter = number | 'all'

const PAGE_SIZE = 40

function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null

  const pageNums: (number | '…')[] =
    totalPages <= 7
      ? Array.from({ length: totalPages }, (_, i) => i + 1)
      : (() => {
          const nums: (number | '…')[] = [1]
          if (page > 3) nums.push('…')
          for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) nums.push(i)
          if (page < totalPages - 2) nums.push('…')
          nums.push(totalPages)
          return nums
        })()

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-slate-100 px-3 py-3">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-sm font-bold text-slate-600 disabled:opacity-30"
      >
        ‹
      </button>
      {pageNums.map((n, i) =>
        n === '…' ? (
          <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-slate-400">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
              n === page ? 'bg-amber-500 text-white' : 'bg-slate-50 text-slate-600'
            }`}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-sm font-bold text-slate-600 disabled:opacity-30"
      >
        ›
      </button>
      <span className="ml-1 text-[11px] text-slate-400">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
      </span>
    </div>
  )
}

function matchesBookFilter(lesson: ChineseLessonRow, bookSlug: BookFilter): boolean {
  if (bookSlug === 'all') return true
  const book = getChineseBook(bookSlug)
  if (!book) return true
  return lesson.grade === book.grade && lesson.semester === book.semester
}

function matchesCharBookFilter(char: ChineseCharProfile, bookSlug: BookFilter): boolean {
  if (bookSlug === 'all') return true
  const book = getChineseBook(bookSlug)
  if (!book) return true
  return char.grade === book.grade && char.semester === book.semester
}

export default function ChineseCharManagerPage({ user }: Props) {
  const { chars, lessons, lessonChars, isLoading, error, refresh } = useChineseCharData(user)
  const { updateCharEntry, updateLesson } = useChineseCharAdmin(user, refresh)

  const [tab, setTab] = useState<Tab>('chars')
  const [search, setSearch] = useState('')
  const [bookSlug, setBookSlug] = useState<BookFilter>('all')
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('all')
  const [page, setPage] = useState(1)
  const [editChar, setEditChar] = useState<ChineseCharProfile | null>(null)
  const [editLesson, setEditLesson] = useState<ChineseLessonRow | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const triggerFlash = (msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 1800)
  }

  const bookOptions = useMemo(() => CHINESE_BOOKS.filter((b) => b.isOpen), [])

  const unitOptions = useMemo(() => {
    if (bookSlug === 'all') return []
    const book = getChineseBook(bookSlug)
    if (!book) return []
    return book.units.map((u) => u.unit).sort((a, b) => a - b)
  }, [bookSlug])

  const loadedBookCounts = useMemo(() => {
    const counts = new Map<ChineseBookSlug, { chars: number; lessons: number }>()
    for (const book of bookOptions) {
      counts.set(book.slug, {
        chars: chars.filter((c) => c.grade === book.grade && c.semester === book.semester).length,
        lessons: lessons.filter((l) => l.grade === book.grade && l.semester === book.semester).length,
      })
    }
    return counts
  }, [bookOptions, chars, lessons])

  const charKeysForUnit = useMemo(() => {
    if (unitFilter === 'all') return null
    const lessonKeys = new Set(
      lessons
        .filter((l) => matchesBookFilter(l, bookSlug) && l.unit === unitFilter)
        .map((l) => l.lessonKey),
    )
    const keys = new Set<string>()
    for (const lc of lessonChars) {
      if (lessonKeys.has(lc.lessonKey)) keys.add(lc.charKey)
    }
    return keys
  }, [lessons, lessonChars, bookSlug, unitFilter])

  const filteredChars = useMemo(() => {
    let list = chars.filter((c) => matchesCharBookFilter(c, bookSlug))
    if (charKeysForUnit) list = list.filter((c) => charKeysForUnit.has(c.charKey))
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (c) =>
        c.char.includes(q) ||
        c.pinyin.toLowerCase().includes(q) ||
        c.charKey.toLowerCase().includes(q) ||
        c.phrases.some((p) => p.includes(q)),
    )
  }, [chars, charKeysForUnit, search, bookSlug])

  const filteredLessons = useMemo(() => {
    const list = lessons.filter(
      (l) => matchesBookFilter(l, bookSlug) && (unitFilter === 'all' || l.unit === unitFilter),
    )
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (l) =>
        l.lessonTitle.toLowerCase().includes(q) ||
        l.lessonKey.toLowerCase().includes(q) ||
        l.recallPhrases.some((p) => p.includes(q)),
    )
  }, [lessons, bookSlug, unitFilter, search])

  const selectedBookLoadHint = useMemo(() => {
    if (bookSlug === 'all' || isLoading) return null
    const book = getChineseBook(bookSlug)
    const loaded = loadedBookCounts.get(bookSlug)
    if (!book || !loaded || (loaded.chars > 0 && loaded.lessons > 0)) return null
    return `${book.label} 在本地缓存中尚无数据（字 ${loaded.chars} · 课 ${loaded.lessons}）。请点击右上角「刷新」重新从 Supabase 拉取；若仍为 0，请在 SQL 编辑器运行 docs/sql/chinese-${bookSlug}/99-verify.sql 核对灌库结果。`
  }, [bookSlug, isLoading, loadedBookCounts])

  const activeList = tab === 'chars' ? filteredChars : filteredLessons
  const totalPages = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pagedChars = filteredChars.slice(pageStart, pageStart + PAGE_SIZE)
  const pagedLessons = filteredLessons.slice(pageStart, pageStart + PAGE_SIZE)

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        请先登录
      </div>
    )
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg,#fffbeb 0%,#fff1f2 45%,#eff6ff 100%)' }}
    >
      <header
        className="sticky top-0 z-30 border-b border-amber-200/40 backdrop-blur"
        style={{ background: 'rgba(255,255,255,0.85)' }}
      >
        <div className="mx-auto flex h-14 max-w-[960px] items-center gap-3 px-4">
          <Link
            href="/admin"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-700 transition hover:scale-110"
            style={{ background: 'rgba(245,158,11,0.10)', border: '1.5px solid rgba(245,158,11,0.30)' }}
            aria-label="返回管理后台"
          >
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-extrabold text-amber-900">语文 · 字词维护</h1>
            <p className="truncate text-[11px] text-slate-500">
              已加载 {chars.length} 字 · {lessons.length} 课
              {bookOptions.map((b) => {
                const n = loadedBookCounts.get(b.slug)
                if (!n) return null
                return ` · ${b.label} ${n.chars}/${n.lessons}`
              })}
              {isLoading ? ' · 同步中…' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm"
          >
            刷新
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[960px] px-4 py-6 pb-20">
        {flash && (
          <div className="mb-4 rounded-xl bg-emerald-100 px-4 py-2 text-center text-sm font-bold text-emerald-800">
            {flash}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-xl bg-rose-100 px-4 py-2 text-sm text-rose-700">{error}</div>
        )}

        {selectedBookLoadHint && (
          <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {selectedBookLoadHint}
          </div>
        )}

        <div className="mb-4 flex gap-2">
          {(['chars', 'lessons'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t)
                setPage(1)
              }}
              className={`rounded-xl px-4 py-2 text-sm font-bold ${
                tab === t ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 shadow-sm'
              }`}
            >
              {t === 'chars' ? '字表' : '读一读记一记'}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder={tab === 'chars' ? '搜索汉字、拼音、组词…' : '搜索课文、词语…'}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="mb-3 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select
            value={bookSlug}
            onChange={(e) => {
              setBookSlug(e.target.value as BookFilter)
              setUnitFilter('all')
              setPage(1)
            }}
            className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 focus:border-amber-400 focus:outline-none"
          >
            <option value="all">全部册别</option>
            {bookOptions.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.label}
              </option>
            ))}
          </select>
          <select
            value={unitFilter === 'all' ? 'all' : String(unitFilter)}
            onChange={(e) => {
              const v = e.target.value
              setUnitFilter(v === 'all' ? 'all' : Number(v))
              setPage(1)
            }}
            disabled={bookSlug === 'all'}
            className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 focus:border-amber-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="all">全部单元</option>
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                第{u}单元
              </option>
            ))}
          </select>
          {activeList.length > 0 && (
            <span className="text-xs text-slate-400">
              共 {activeList.length} 条
              {totalPages > 1 ? ` · 第 ${safePage}/${totalPages} 页` : ''}
            </span>
          )}
        </div>

        {tab === 'chars' ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">字</th>
                  <th className="px-3 py-2">拼音</th>
                  <th className="px-3 py-2 hidden sm:table-cell">部首</th>
                  <th className="px-3 py-2 hidden sm:table-cell">结构</th>
                  <th className="px-3 py-2 hidden md:table-cell">组词</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody>
                {pagedChars.map((c) => (
                  <tr key={c.charKey} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-lg font-extrabold">{c.char}</td>
                    <td className="px-3 py-2 text-slate-600">{c.pinyin}</td>
                    <td className="px-3 py-2 hidden text-slate-500 sm:table-cell">
                      {c.radical}（{c.radicalName}）
                    </td>
                    <td className="px-3 py-2 hidden text-slate-500 sm:table-cell">{c.structure}</td>
                    <td className="px-3 py-2 hidden max-w-[200px] truncate text-slate-500 md:table-cell">
                      {c.phrases.join(' ')}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setEditChar(c)}
                        className="text-xs font-bold text-amber-700"
                      >
                        编辑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredChars.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-400">无匹配生字</p>
            )}
            <PaginationBar
              page={safePage}
              pageSize={PAGE_SIZE}
              total={filteredChars.length}
              onPageChange={setPage}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {pagedLessons.map((l) => (
              <div
                key={l.lessonKey}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-400">
                    第{l.unit}单元 · {l.lessonKind === 'garden' ? '园地' : `第${l.lesson}课`}
                  </p>
                  <h3 className="font-extrabold text-slate-800">{l.lessonTitle}</h3>
                  {l.recallPhrases.length > 0 ? (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                      {l.recallPhrases.join(' · ')}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-300">（暂无读一读记一记）</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditLesson(l)}
                  className="shrink-0 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800"
                >
                  编辑
                </button>
              </div>
            ))}
            {filteredLessons.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-400">无匹配课文</p>
            )}
            <PaginationBar
              page={safePage}
              pageSize={PAGE_SIZE}
              total={filteredLessons.length}
              onPageChange={setPage}
            />
          </div>
        )}

        <p className="mt-6 text-center text-[11px] text-slate-400">
          首次使用请在 Supabase 执行 docs/sql/chinese-char-entries-admin-rls.sql
        </p>
      </main>

      {editChar && (
        <ChineseCharFormModal
          char={editChar}
          onCancel={() => setEditChar(null)}
          onSubmit={async (patch) => {
            await updateCharEntry(editChar.charKey, patch)
            setEditChar(null)
            triggerFlash(`已保存「${editChar.char}」`)
          }}
        />
      )}

      {editLesson && (
        <ChineseLessonRecallModal
          lesson={editLesson}
          onCancel={() => setEditLesson(null)}
          onSubmit={async (recallPhrases) => {
            await updateLesson(editLesson.lessonKey, { recallPhrases })
            setEditLesson(null)
            triggerFlash(`已保存「${editLesson.lessonTitle}」`)
          }}
        />
      )}
    </div>
  )
}
