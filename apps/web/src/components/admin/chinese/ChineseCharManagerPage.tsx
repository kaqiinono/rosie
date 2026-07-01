'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import {
  useChineseCharData,
  useChineseCharAdmin,
  type ChineseCharProfile,
  type ChineseLessonRow,
} from '@rosie/chinese'
import ChineseCharFormModal from './ChineseCharFormModal'
import ChineseLessonRecallModal from './ChineseLessonRecallModal'

type Props = { user: User | null }
type Tab = 'chars' | 'lessons'

export default function ChineseCharManagerPage({ user }: Props) {
  const { chars, lessons, isLoading, error, refresh } = useChineseCharData(user)
  const { updateCharEntry, updateLesson } = useChineseCharAdmin(user, refresh)

  const [tab, setTab] = useState<Tab>('chars')
  const [search, setSearch] = useState('')
  const [editChar, setEditChar] = useState<ChineseCharProfile | null>(null)
  const [editLesson, setEditLesson] = useState<ChineseLessonRow | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const triggerFlash = (msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 1800)
  }

  const filteredChars = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return chars
    return chars.filter(
      (c) =>
        c.char.includes(q) ||
        c.pinyin.toLowerCase().includes(q) ||
        c.charKey.toLowerCase().includes(q) ||
        c.phrases.some((p) => p.includes(q)),
    )
  }, [chars, search])

  const filteredLessons = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lessons
    return lessons.filter(
      (l) =>
        l.lessonTitle.toLowerCase().includes(q) ||
        l.lessonKey.toLowerCase().includes(q) ||
        l.recallPhrases.some((p) => p.includes(q)),
    )
  }, [lessons, search])

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
              {chars.length} 字 · {lessons.length} 课
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

        <div className="mb-4 flex gap-2">
          {(['chars', 'lessons'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
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
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-amber-400 focus:outline-none"
        />

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
                {filteredChars.map((c) => (
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
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLessons.map((l) => (
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
