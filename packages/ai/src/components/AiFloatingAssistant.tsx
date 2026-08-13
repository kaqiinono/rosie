'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useImmersive } from '@rosie/core'
import type { AgentBlock, AiSubject, ChatContext } from '../types'
import { findManifestByHref } from '../server/tools/resolve-links'
import AiChatPanel from './AiChatPanel'
import RosieAssistantAvatar from './RosieAssistantAvatar'

export function shouldShowAiAssistant(pathname: string, isImmersive: boolean): boolean {
  if (isImmersive) return false
  return !(
    pathname === '/ai' ||
    pathname.startsWith('/ai/') ||
    pathname === '/auth' ||
    pathname.startsWith('/auth/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  )
}

export function subjectFromPathname(pathname: string): AiSubject | undefined {
  if (pathname === '/english' || pathname.startsWith('/english/')) return 'english'
  if (pathname === '/chinese' || pathname.startsWith('/chinese/')) return 'chinese'
  if (
    pathname === '/math' ||
    pathname.startsWith('/math/') ||
    pathname === '/calc' ||
    pathname.startsWith('/calc/')
  ) {
    return 'math'
  }
  return undefined
}

type AiFloatingAssistantProps = {
  renderMathProblem?: (problemId: string) => ReactNode
  renderWordCard?: (block: Extract<AgentBlock, { type: 'word_card' }>) => ReactNode
  renderCharCard?: (block: Extract<AgentBlock, { type: 'char_card' }>) => ReactNode
  renderPoemRecite?: (block: Extract<AgentBlock, { type: 'poem_recite' }>) => ReactNode
  renderPassage?: (block: Extract<AgentBlock, { type: 'passage_excerpt' }>) => ReactNode
  renderLearningStatus?: (block: Extract<AgentBlock, { type: 'learning_status' }>) => ReactNode
  renderTodayTasks?: (block: Extract<AgentBlock, { type: 'today_tasks' }>) => ReactNode
  onVisibilityChange?: (open: boolean) => void
}

export default function AiFloatingAssistant({
  renderMathProblem,
  renderWordCard,
  renderCharCard,
  renderPoemRecite,
  renderPassage,
  renderLearningStatus,
  renderTodayTasks,
  onVisibilityChange,
}: AiFloatingAssistantProps) {
  const pathname = usePathname()
  const { isImmersive } = useImmersive()
  const [open, setOpen] = useState(false)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const context = useMemo<ChatContext>(() => {
    const manifestEntry = findManifestByHref(pathname)
    return {
      subject: subjectFromPathname(pathname),
      lessonId: pathname,
      activeContent: manifestEntry
        ? {
            sourceRef: manifestEntry.sourceRef,
            title: manifestEntry.title,
            problemId: manifestEntry.problemId,
            wordKey: manifestEntry.wordKey,
          }
        : undefined,
    }
  }, [pathname])
  const closeAssistant = useCallback(() => {
    setOpen(false)
    requestAnimationFrame(() => launcherRef.current?.focus())
  }, [])

  useEffect(() => {
    onVisibilityChange?.(open)
  }, [onVisibilityChange, open])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAssistant()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [closeAssistant, open])

  if (!shouldShowAiAssistant(pathname, isImmersive)) return null

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        aria-label={open ? '收起 Rosie 学习助手' : '打开 Rosie 学习助手'}
        aria-expanded={open}
        onClick={() => (open ? closeAssistant() : setOpen(true))}
        className={`group fixed right-4 bottom-24 z-50 flex min-h-14 items-center gap-2 rounded-full bg-gradient-to-br from-violet-500 to-sky-500 p-2.5 text-white shadow-[0_10px_30px_rgba(59,130,246,0.35)] ring-2 ring-white/80 transition hover:-translate-y-1 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-500 active:translate-y-0 md:right-6 md:bottom-6 ${open ? 'pr-3' : 'pr-4'}`}
      >
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center overflow-hidden rounded-full bg-white/20 text-2xl transition group-hover:scale-110"
        >
          {open ? '×' : <RosieAssistantAvatar className="size-full" />}
        </span>
        <span className="text-sm font-bold whitespace-nowrap">{open ? '收起' : '问问我'}</span>
      </button>

      <button
        type="button"
        aria-label="关闭 Rosie 学习助手"
        tabIndex={open ? 0 : -1}
        onClick={closeAssistant}
        className={`fixed inset-0 z-60 bg-slate-950/25 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      <aside
        aria-label="Rosie 学习助手对话框"
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-x-2 top-2 bottom-2 z-70 flex flex-col overflow-hidden rounded-[28px] border border-white/80 bg-[#f9faff]/96 shadow-[0_28px_90px_rgba(15,23,42,0.3)] backdrop-blur-2xl transition duration-300 ease-out sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-4 sm:w-[440px] ${open ? 'pointer-events-auto translate-x-0 opacity-100' : 'pointer-events-none translate-x-[110%] opacity-0'}`}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white/85 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <RosieAssistantAvatar className="size-10 rounded-2xl shadow-sm ring-1 ring-rose-100" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-900">Rosie 学习助手</h2>
                <span className="size-2 rounded-full bg-emerald-400" />
              </div>
              <p className="text-[11px] text-slate-500">
                {context.subject ? '已带入当前学科上下文' : '陪你一步一步找到思路'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={`/ai?from=${encodeURIComponent(pathname)}`}
              aria-label="在完整页面打开"
              className="grid size-9 place-items-center rounded-xl text-sm text-slate-500 transition hover:bg-slate-100 hover:text-violet-600"
            >
              ↗
            </Link>
            <button
              type="button"
              aria-label="收起 Rosie 学习助手"
              onClick={closeAssistant}
              className="grid size-9 place-items-center rounded-xl text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              ×
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1">
          <AiChatPanel
            mode="overlay"
            context={context}
            renderMathProblem={renderMathProblem}
            renderWordCard={renderWordCard}
            renderCharCard={renderCharCard}
            renderPoemRecite={renderPoemRecite}
            renderPassage={renderPassage}
            renderLearningStatus={renderLearningStatus}
            renderTodayTasks={renderTodayTasks}
          />
        </div>
      </aside>
    </>
  )
}
