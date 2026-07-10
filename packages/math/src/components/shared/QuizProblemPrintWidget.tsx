'use client'

import { useEffect, useRef, useState } from 'react'
import type { Problem } from '@rosie/core'
import VerticalDigitPuzzlePanel from '@rosie/math/components/shared/VerticalDigitPuzzlePanel'
import ScratchPadCustomAnswerWidget from '@rosie/math/components/shared/ScratchPad/ScratchPadCustomAnswerWidget'
import {
  findSvgInHosts,
  pickExportDomElement,
  rasterizeDomElement,
  rasterizeSvgElement,
} from '@rosie/math/components/shared/ScratchPad/scratch-pad-figure'
import { getProblemAnswerMode } from '@rosie/math/utils/problem-answer-mode'
import { isVerticalPuzzleFills } from '@rosie/math/utils/vertical-digit-puzzle'

type Props = {
  problem: Problem
  /** 完整答卷模式下的交互作答快照 */
  interactiveState?: unknown
}

function waitForLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

async function rasterizeQuizWidget(host: HTMLElement): Promise<string | null> {
  await waitForLayout()
  if (document.fonts?.ready) {
    await document.fonts.ready
  }

  const hosts = [host]
  const svg = findSvgInHosts(hosts)
  if (svg) {
    const raster = await rasterizeSvgElement(svg)
    if (raster) return raster.src
  }

  const domTarget = pickExportDomElement(hosts)
  if (domTarget) {
    const raster = await rasterizeDomElement(domTarget)
    if (raster) return raster.src
  }

  return null
}

function renderWidgetSource(problem: Problem, interactiveState: unknown | undefined) {
  const answerMode = getProblemAnswerMode(problem)

  if (answerMode === 'custom-widget') {
    const puzzle = problem.verticalPuzzle
    if (puzzle && !puzzle.readonly) {
      const initialFills = isVerticalPuzzleFills(interactiveState) ? interactiveState : undefined
      return (
        <VerticalDigitPuzzlePanel
          spec={{ ...puzzle, readonly: true }}
          embedded
          initialFills={initialFills}
          disabled
          onSubmit={() => {}}
        />
      )
    }

    return (
      <ScratchPadCustomAnswerWidget
        problem={problem}
        initialState={interactiveState}
        disabled
        onStateChange={() => {}}
        onSubmit={() => {}}
      />
    )
  }

  if (answerMode === 'readonly-puzzle-numeric' && problem.verticalPuzzle) {
    return (
      <VerticalDigitPuzzlePanel
        spec={problem.verticalPuzzle}
        embedded
        disabled
        onSubmit={() => {}}
      />
    )
  }

  return null
}

/**
 * 试卷打印：将宫格（1-47）、竖式数字谜（2-7）等自定义题型栅格化为 PNG，
 * 避免打印 CSS 破坏 flex/竖式对齐。空白卷展示空题面；完整答卷注入 interactiveState。
 */
export default function QuizProblemPrintWidget({ problem, interactiveState }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const answerMode = getProblemAnswerMode(problem)
  const needsRaster = answerMode === 'custom-widget' || answerMode === 'readonly-puzzle-numeric'

  useEffect(() => {
    if (!needsRaster) return

    let cancelled = false
    setDataUrl(null)

    void (async () => {
      await waitForLayout()
      if (cancelled || !hostRef.current) return

      const src = await rasterizeQuizWidget(hostRef.current)
      if (!cancelled && src) setDataUrl(src)
    })()

    return () => {
      cancelled = true
    }
  }, [problem.id, interactiveState, needsRaster])

  if (!needsRaster) {
    if (!problem.figureNode) return null
    return <div className="problem-figure mt-2 flex justify-center">{problem.figureNode}</div>
  }

  return (
    <div className="quiz-print-widget mt-2 flex justify-center">
      <div
        ref={hostRef}
        className="pointer-events-none fixed top-0 -left-[9999px] w-max opacity-0"
        aria-hidden
      >
        {renderWidgetSource(problem, interactiveState)}
      </div>
      {dataUrl ? (
        <img
          src={dataUrl}
          alt=""
          className="quiz-print-raster block h-auto w-auto max-h-[200px] max-w-[200px] object-contain"
        />
      ) : (
        <p className="text-xs text-slate-400 no-print">题面生成中…</p>
      )}
    </div>
  )
}
