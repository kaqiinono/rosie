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
import { IconButton } from '@rosie/ui/themes'

export function shouldShowAiAssistant(pathname: string, isImmersive: boolean): boolean {
  if (isImmersive) return false
  return !(
    pathname === '/calc/session' ||
    pathname === '/english/words/practice/print' ||
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
  // 仅本次页面生命周期内隐藏；刷新后重新出现（不持久化）。对话抽屉打开时不会隐藏。
  const [dismissed, setDismissed] = useState(false)
  const launcherHidden = dismissed && !open
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
      // 隐藏时（display:none）尺寸为 0，不计算也不保存位置
      if (!launcher || launcher.offsetWidth === 0) return
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
      {/* 外层负责固定定位；关闭按钮是启动器的兄弟节点，避免嵌套 button。 */}
      <div
        style={launcherStyle}
        className={`fixed right-4 bottom-24 z-50 w-fit md:right-6 md:bottom-6 [body:has(#reading-listening-drawer)_&]:hidden ${launcherHidden ? 'hidden' : ''}`}
      >
        {/* native-ok: 可拖动、键盘微调位置的悬浮启动器，依赖 pointer 事件与内联定位，Radix Button 无法承载 */}
        <button
          ref={launcherRef}
          type="button"
          aria-label={open ? '收起不不' : '打开不不，可拖动调整位置'}
          aria-expanded={open}
          title={open ? '收起不不' : '拖动可移开，方向键也可调整位置'}
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
          className={`grid size-14 touch-none place-items-center rounded-full bg-rose-100 shadow-[inset_0_-4px_0_var(--color-rose-200)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${dragging ? 'cursor-grabbing' : 'cursor-grab motion-safe:transition-transform motion-safe:hover:-translate-y-0.5'}`}
        >
          <RosieAssistantAvatar className="pointer-events-none size-12" />
        </button>
        {!open && (
          <IconButton
            type="button"
            aria-label="暂时隐藏不不，刷新页面后恢复"
            title="暂时隐藏，刷新页面后恢复"
            size="1"
            radius="full"
            variant="surface"
            color="gray"
            className="absolute -top-2 -right-2"
            onClick={() => setDismissed(true)}
          >
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="m3 3 6 6m0-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </IconButton>
        )}
      </div>

      {/* native-ok: 全屏半透明遮罩，点击关闭对话框，不是视觉按钮 */}
      <button
        type="button"
        aria-label="关闭不不"
        tabIndex={open ? 0 : -1}
        onClick={closeAssistant}
        className={`fixed inset-0 z-60 bg-amber-950/30 transition-opacity duration-300 ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      <aside
        aria-label="不不对话框"
        aria-hidden={!open}
        inert={!open}
        className={`border-kid-line bg-kid-paper shadow-sticker-lg fixed inset-x-2 top-2 bottom-2 z-70 flex flex-col overflow-hidden rounded-[28px] border-[3px] transition duration-300 ease-out sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-4 sm:w-[440px] md:w-[480px] lg:w-[520px] ${open ? 'pointer-events-auto translate-x-0 opacity-100' : 'pointer-events-none translate-x-[110%] opacity-0'}`}
      >
        <header className="border-kid-line flex shrink-0 items-center justify-between border-b-2 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <RosieAssistantAvatar className="size-10 rounded-2xl ring-2 ring-rose-100" />
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
            <IconButton
              type="button"
              aria-label="收起不不"
              onClick={closeAssistant}
              variant="ghost"
              color="gray"
              size="3"
            >
              ×
            </IconButton>
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
