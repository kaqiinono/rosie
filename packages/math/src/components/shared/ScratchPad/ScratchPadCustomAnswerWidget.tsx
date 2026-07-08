'use client'

import type { RefObject } from 'react'
import type { AnswerCheckResult, Problem } from '@rosie/core'
import VerticalDigitPuzzlePanel from '@rosie/math/components/shared/VerticalDigitPuzzlePanel'
import { injectFigureGridCallbacks } from '@rosie/math/components/shared/injectFigureSubmit'
import { isVerticalPuzzleFills } from '@rosie/math/utils/vertical-digit-puzzle'

type Props = {
  problem: Problem
  initialState?: unknown
  feedback?: AnswerCheckResult | null
  onStateChange: (state: unknown) => void
  onSubmit: (state: unknown) => void
  /** 供草稿纸栅格化导出（竖式 grid 或 figure 容器） */
  exportHostRef?: RefObject<HTMLDivElement | null>
  /** 竖式键盘固定底栏槽位；传入 `null` 表示槽位尚未挂载，键盘暂不内联显示 */
  padSlot?: HTMLElement | null
}

/**
 * 统一渲染「答题区自定义组件」——竖式数字谜（2-7）与宫格交互题（1-47）等。
 * 详情页与草稿纸共用同一套注入/校验约定。
 */
export default function ScratchPadCustomAnswerWidget({
  problem,
  initialState,
  feedback,
  onStateChange,
  onSubmit,
  exportHostRef,
  padSlot,
}: Props) {
  const puzzle = problem.verticalPuzzle
  if (puzzle && !puzzle.readonly) {
    const initialFills = isVerticalPuzzleFills(initialState) ? initialState : undefined
    return (
      <VerticalDigitPuzzlePanel
        spec={puzzle}
        embedded
        initialFills={initialFills}
        exportGridRef={exportHostRef}
        onFillsChange={onStateChange}
        onStateChange={() => {}}
        onSubmit={(fills) => onSubmit(fills)}
        feedback={feedback ?? null}
        padSlot={padSlot}
      />
    )
  }

  if (problem.figureNode) {
    return (
      <div ref={exportHostRef} data-scratch-answer-export="">
        {injectFigureGridCallbacks(problem.figureNode, {
          initialState,
          onStateChange: (state) => onStateChange(state),
          onSubmit: (state) => onSubmit(state),
        })}
      </div>
    )
  }

  return null
}
