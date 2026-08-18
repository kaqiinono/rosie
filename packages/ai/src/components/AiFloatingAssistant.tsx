'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { STORAGE_KEYS, useImmersive } from '@rosie/core'
import type { AgentBlock, AiSubject, ChatContext, LessonNote, SimilarProblem } from '../types'
import { findManifestByHref, findManifestByProblemId } from '../server/tools/resolve-links'
import AiChatPanel from './AiChatPanel'
import RosieAssistantAvatar from './RosieAssistantAvatar'

export function shouldShowAiAssistant(pathname: string, isImmersive: boolean): boolean {
  if (isImmersive) return false
  return !(
    pathname === '/calc/session' ||
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

/** Detect a math lesson home page URL like `/math/ny/1/12`. */
export function parseMathLessonPathname(pathname: string): boolean {
  return /^\/math\/ny\/\d+\/\d+$/.test(pathname)
}

type AiFloatingAssistantProps = {
  renderMathProblem?: (problemId: string, renderRemainingActions?: () => ReactNode) => ReactNode
  renderWordCard?: (block: Extract<AgentBlock, { type: 'word_card' }>) => ReactNode
  renderCharCard?: (block: Extract<AgentBlock, { type: 'char_card' }>) => ReactNode
  renderPoemRecite?: (block: Extract<AgentBlock, { type: 'poem_recite' }>) => ReactNode
  renderPassage?: (block: Extract<AgentBlock, { type: 'passage_excerpt' }>) => ReactNode
  renderLearningStatus?: (block: Extract<AgentBlock, { type: 'learning_status' }>) => ReactNode
  renderTodayTasks?: (block: Extract<AgentBlock, { type: 'today_tasks' }>) => ReactNode
  onVisibilityChange?: (open: boolean) => void
  /** Pre-loaded math enrichment data (fetched by the host in apps/web). */
  mathEnrichment?: {
    lessonNotes?: LessonNote[]
    similarProblem?: SimilarProblem
  }
}

type LauncherPosition = { x: number; y: number }
type DragStart = LauncherPosition & { pointerX: number; pointerY: number; pointerId: number }

const LAUNCHER_EDGE_GAP = 8
const DRAG_THRESHOLD = 6

function clampLauncherPosition(
  position: LauncherPosition,
  width: number,
  height: number,
): LauncherPosition {
  return {
    x: Math.min(
      Math.max(LAUNCHER_EDGE_GAP, position.x),
      Math.max(LAUNCHER_EDGE_GAP, window.innerWidth - width - LAUNCHER_EDGE_GAP),
    ),
    y: Math.min(
      Math.max(LAUNCHER_EDGE_GAP, position.y),
      Math.max(LAUNCHER_EDGE_GAP, window.innerHeight - height - LAUNCHER_EDGE_GAP),
    ),
  }
}

export function findVisibleActiveProblem(candidates: HTMLElement[]): HTMLElement | undefined {
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const element = candidates[index]
    if (!element) continue
    const rect = element.getBoundingClientRect()
    const isVisible =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    if (isVisible) return element
  }
  return undefined
}

/**
 * Derive a human-readable lesson label from a math lesson URL like `/math/ny/1/12`.
 * Returns null when the pathname is not a lesson home page.
 */
function mathLessonLabel(pathname: string): string | null {
  const match = pathname.match(/^\/math\/ny\/(\d+)\/(\d+)$/)
  if (!match) return null
  const gradeLabel = match[1] === '1' ? '一年级' : match[1] === '2' ? '二年级' : `G${match[1]}`
  return `${gradeLabel} · 第 ${match[2]} 讲`
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
  mathEnrichment,
}: AiFloatingAssistantProps) {
  const pathname = usePathname()
  const { isImmersive } = useImmersive()
  const [open, setOpen] = useState(false)
  const [launcherPosition, setLauncherPosition] = useState<LauncherPosition | null>(null)
  const [dragging, setDragging] = useState(false)
  const [activeProblem, setActiveProblem] = useState<{
    problemId: string
    hasAttempted: boolean
    title?: string
  } | null>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const dragStartRef = useRef<DragStart | null>(null)
  const didDragRef = useRef(false)
  const suppressClickRef = useRef(false)
  const context = useMemo<ChatContext>(() => {
    const manifestEntry = findManifestByHref(pathname)
    const activeProblemEntry = activeProblem
      ? findManifestByProblemId(activeProblem.problemId)
      : undefined
    const isLessonPage = parseMathLessonPathname(pathname)
    const label = isLessonPage ? mathLessonLabel(pathname) : null

    const activeContent = activeProblemEntry
      ? {
          sourceRef: activeProblemEntry.sourceRef,
          title: activeProblemEntry.title,
          problemId: activeProblemEntry.problemId,
          hasAttempted: activeProblem?.hasAttempted,
        }
      : activeProblem
        ? {
            sourceRef: `math:problem:${activeProblem.problemId}`,
            title: activeProblem.title ?? activeProblem.problemId,
            problemId: activeProblem.problemId,
            hasAttempted: activeProblem.hasAttempted,
          }
        : manifestEntry
          ? {
              sourceRef: manifestEntry.sourceRef,
              title: manifestEntry.title,
              problemId: manifestEntry.problemId,
              wordKey: manifestEntry.wordKey,
            }
          : label
            ? { sourceRef: `math:lesson:${pathname}`, title: label }
            : undefined

    return {
      subject: subjectFromPathname(pathname),
      lessonId: pathname,
      lessonPage: isLessonPage || undefined,
      activeContent,
      lessonNotes: mathEnrichment?.lessonNotes,
      similarProblem: mathEnrichment?.similarProblem,
    }
  }, [activeProblem, pathname, mathEnrichment])
  const closeAssistant = useCallback(() => {
    setOpen(false)
    requestAnimationFrame(() => launcherRef.current?.focus())
  }, [])

  const openAssistant = useCallback(() => {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>('[data-ai-active-problem-id]'),
    )
    const visibleProblem = findVisibleActiveProblem(candidates)
    const problemId = visibleProblem?.dataset.aiActiveProblemId
    const ds = visibleProblem?.dataset
    setActiveProblem(
      problemId
        ? {
            problemId,
            hasAttempted: ds?.aiProblemAttempted === 'true',
            title: ds?.aiActiveProblemTitle,
          }
        : null,
    )
    setOpen(true)
  }, [])

  const saveLauncherPosition = useCallback((position: LauncherPosition) => {
    try {
      localStorage.setItem(STORAGE_KEYS.AI_ASSISTANT_POSITION, JSON.stringify(position))
    } catch {
      // The launcher remains draggable when browser storage is unavailable.
    }
  }, [])

  const positionLauncher = useCallback(
    (position: LauncherPosition, persist = false) => {
      const launcher = launcherRef.current
      if (!launcher) return
      const nextPosition = clampLauncherPosition(
        position,
        launcher.offsetWidth,
        launcher.offsetHeight,
      )
      setLauncherPosition(nextPosition)
      if (persist) saveLauncherPosition(nextPosition)
    },
    [saveLauncherPosition],
  )

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AI_ASSISTANT_POSITION)
      if (!saved) return
      const parsed: unknown = JSON.parse(saved)
      if (typeof parsed === 'object' && parsed !== null) {
        const candidate = parsed as Record<string, unknown>
        if (typeof candidate.x === 'number' && typeof candidate.y === 'number') {
          const savedPosition = { x: candidate.x, y: candidate.y }
          requestAnimationFrame(() => positionLauncher(savedPosition))
        }
      }
    } catch {
      // Ignore malformed or unavailable local storage and use the default corner.
    }
  }, [positionLauncher])

  useEffect(() => {
    const keepLauncherOnScreen = () => {
      if (launcherPosition) positionLauncher(launcherPosition, true)
    }
    window.addEventListener('resize', keepLauncherOnScreen)
    return () => window.removeEventListener('resize', keepLauncherOnScreen)
  }, [launcherPosition, positionLauncher])

  const handleLauncherPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (open || event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    dragStartRef.current = {
      x: rect.left,
      y: rect.top,
      pointerX: event.clientX,
      pointerY: event.clientY,
      pointerId: event.pointerId,
    }
    didDragRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleLauncherPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    const deltaX = event.clientX - start.pointerX
    const deltaY = event.clientY - start.pointerY
    if (!didDragRef.current && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return
    didDragRef.current = true
    setDragging(true)
    positionLauncher({ x: start.x + deltaX, y: start.y + deltaY })
  }

  const finishLauncherDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = dragStartRef.current
    if (!start || start.pointerId !== event.pointerId) return
    dragStartRef.current = null
    setDragging(false)
    if (didDragRef.current) {
      suppressClickRef.current = true
      positionLauncher(
        {
          x: start.x + event.clientX - start.pointerX,
          y: start.y + event.clientY - start.pointerY,
        },
        true,
      )
    }
  }

  const cancelLauncherDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragStartRef.current?.pointerId !== event.pointerId) return
    dragStartRef.current = null
    didDragRef.current = false
    suppressClickRef.current = false
    setDragging(false)
    if (launcherPosition) saveLauncherPosition(launcherPosition)
  }

  const handleLauncherKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const movement: Record<string, LauncherPosition> = {
      ArrowLeft: { x: -24, y: 0 },
      ArrowRight: { x: 24, y: 0 },
      ArrowUp: { x: 0, y: -24 },
      ArrowDown: { x: 0, y: 24 },
    }
    const delta = movement[event.key]
    if (!delta || open) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    positionLauncher({ x: rect.left + delta.x, y: rect.top + delta.y }, true)
  }

  const launcherStyle: CSSProperties | undefined = launcherPosition
    ? { left: launcherPosition.x, top: launcherPosition.y, right: 'auto', bottom: 'auto' }
    : undefined

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
        aria-label={open ? '收起不不' : '打开不不，可拖动调整位置'}
        aria-expanded={open}
        title={open ? '收起不不' : '拖动可移开，方向键也可调整位置'}
        style={launcherStyle}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
          }
          if (open) closeAssistant()
          else openAssistant()
        }}
        onKeyDown={handleLauncherKeyDown}
        onPointerDown={handleLauncherPointerDown}
        onPointerMove={handleLauncherPointerMove}
        onPointerUp={finishLauncherDrag}
        onPointerCancel={cancelLauncherDrag}
        className={`group fixed right-4 bottom-24 z-50 flex min-h-14 touch-none items-center gap-2 rounded-full bg-gradient-to-br from-violet-500 to-sky-500 p-2.5 text-white shadow-[0_10px_30px_rgba(59,130,246,0.35)] ring-2 ring-white/80 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-500 md:right-6 md:bottom-6 ${dragging ? 'cursor-grabbing' : 'cursor-grab transition hover:-translate-y-1 active:translate-y-0'} ${open ? 'pr-3' : 'pr-4'}`}
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
        aria-label="关闭不不"
        tabIndex={open ? 0 : -1}
        onClick={closeAssistant}
        className={`fixed inset-0 z-60 bg-slate-950/25 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      <aside
        aria-label="不不对话框"
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-x-2 top-2 bottom-2 z-70 flex flex-col overflow-hidden rounded-[28px] border border-white/80 bg-[#f9faff]/96 shadow-[0_28px_90px_rgba(15,23,42,0.3)] backdrop-blur-2xl transition duration-300 ease-out sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-4 sm:w-[440px] md:w-[480px] lg:w-[520px] ${open ? 'pointer-events-auto translate-x-0 opacity-100' : 'pointer-events-none translate-x-[110%] opacity-0'}`}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white/85 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <RosieAssistantAvatar className="size-10 rounded-2xl shadow-sm ring-1 ring-rose-100" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-900">不不</h2>
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
              aria-label="收起不不"
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
