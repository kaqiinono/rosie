'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import AiChatPanel from './AiChatPanel'

const SUBJECTS = [
  { icon: 'A', label: '英语', note: '单词 · 阅读', color: 'from-emerald-400 to-teal-500' },
  { icon: 'π', label: '数学', note: '理解 · 解题', color: 'from-blue-400 to-indigo-500' },
  { icon: '文', label: '语文', note: '生字 · 课文', color: 'from-orange-400 to-rose-400' },
] as const

export default function AiAssistantPage({ chatPanel }: { chatPanel?: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f7ff] px-3 py-3 sm:px-5 sm:py-5 lg:px-8">
      <div className="pointer-events-none absolute -top-32 -left-32 size-80 rounded-full bg-violet-300/35 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-40 size-96 rounded-full bg-sky-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-44 left-1/4 size-96 rounded-full bg-emerald-200/25 blur-3xl" />

      <div className="relative mx-auto max-w-[1280px]">
        <header className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
          <Link
            href="/"
            className="flex size-11 items-center justify-center rounded-2xl border border-white/80 bg-white/75 text-xl text-slate-700 shadow-sm backdrop-blur-xl transition hover:-translate-x-0.5 hover:bg-white"
            aria-label="返回学习乐园"
          >
            ←
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur-xl">
            <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.15)]" />
            Rosie 在线
          </div>
        </header>

        <div className="grid items-stretch gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-5">
          <aside className="hidden overflow-hidden rounded-[32px] bg-gradient-to-br from-[#25245e] via-[#383488] to-[#4d61bd] p-6 text-white shadow-[0_24px_70px_rgba(41,45,100,0.22)] lg:flex lg:flex-col">
            <div className="relative mb-7">
              <div className="absolute -top-9 -right-9 size-28 rounded-full border border-white/10 bg-white/5" />
              <div className="relative grid size-16 place-items-center rounded-[22px] bg-white/15 text-4xl shadow-inner ring-1 ring-white/20 backdrop-blur">
                🤖
              </div>
              <p className="mt-5 text-xs font-bold tracking-[0.2em] text-indigo-200 uppercase">
                Rosie Study Mate
              </p>
              <h1 className="mt-2 text-3xl leading-tight font-black tracking-tight">
                嗨，我是
                <br />
                Rosie 老师
              </h1>
              <p className="mt-3 text-sm leading-6 text-indigo-100/80">
                我不会急着说答案，而是陪你找到自己的思路。
              </p>
            </div>

            <div className="space-y-2.5">
              {SUBJECTS.map((subject) => (
                <div
                  key={subject.label}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 p-3 backdrop-blur"
                >
                  <span
                    className={`grid size-10 place-items-center rounded-xl bg-gradient-to-br ${subject.color} text-base font-black shadow-lg`}
                  >
                    {subject.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{subject.label}</span>
                    <span className="block text-xs text-indigo-100/65">{subject.note}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6">
              <div className="rounded-2xl border border-white/10 bg-slate-950/15 p-4">
                <p className="text-xs font-bold text-indigo-100">学习小约定</p>
                <p className="mt-1.5 text-xs leading-5 text-indigo-100/65">
                  不懂就问，答错也没关系。每一次尝试都算进步。
                </p>
              </div>
            </div>
          </aside>

          <section className="min-w-0 overflow-hidden rounded-[28px] border border-white/90 bg-white/72 shadow-[0_24px_80px_rgba(69,75,130,0.15)] backdrop-blur-2xl sm:rounded-[32px]">
            <div className="border-b border-slate-100/90 px-5 py-4 sm:px-7 sm:py-5">
              <div className="flex items-center gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 text-2xl shadow-[0_8px_20px_rgba(99,102,241,0.25)] lg:hidden">
                  🤖
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                      今天想学什么？
                    </h2>
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black tracking-wide text-violet-600 ring-1 ring-violet-100">
                      三科智能辅导
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                    打字或按住麦克风，Rosie 会根据你的学习进度一步步引导。
                  </p>
                </div>
              </div>
            </div>
            {chatPanel ?? <AiChatPanel />}
          </section>
        </div>
      </div>
    </main>
  )
}
