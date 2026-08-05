import type { ReactNode } from 'react'
import type { Problem } from '@rosie/core'
import { ShulianGrid } from './ShulianGrid'
import { ShuqiaoGrid } from './ShuqiaoGrid'
import { ShufangGrid } from './ShufangGrid'
import { BudengSudokuGrid } from './BudengSudokuGrid'
import { WumaSudokuGrid } from './WumaSudokuGrid'
import { ChuangkouSudokuGrid } from './ChuangkouSudokuGrid'
import { ChangguiSudokuGrid } from './ChangguiSudokuGrid'
import { DuijiaoxianSudokuGrid } from './DuijiaoxianSudokuGrid'
import { JuchiSudokuGrid } from './JuchiSudokuGrid'
import {
  makeBudengSudokuChecker,
  makeChangguiSudokuChecker,
  makeChuangkouSudokuChecker,
  makeDuijiaoxianSudokuChecker,
  makeJuchiSudokuChecker,
  makeShufangChecker,
  makeShulianChecker,
  makeShuqiaoChecker,
  makeWumaSudokuChecker,
} from './checkers'
import type {
  BudengSudokuProps,
  ChangguiSudokuProps,
  ChuangkouSudokuProps,
  DuijiaoxianSudokuProps,
  JuchiSudokuProps,
  ShufangProps,
  ShulianProps,
  ShuqiaoProps,
  WumaSudokuProps,
} from './utils/types'

type GongProblemFields = Pick<
  Problem,
  'type' | 'finalQ' | 'finalUnit' | 'finalAns' | 'figureNode' | 'checkAnswer'
>

function gongBase(grid: ReactNode, checkAnswer: Problem['checkAnswer']): GongProblemFields {
  return {
    type: 'none',
    finalQ: '',
    finalUnit: '',
    finalAns: 0,
    figureNode: grid,
    checkAnswer,
  }
}

export function gongShulian(config: ShulianProps): GongProblemFields {
  return gongBase(<ShulianGrid {...config} />, makeShulianChecker(config))
}

export function gongShuqiao(config: ShuqiaoProps): GongProblemFields {
  return gongBase(<ShuqiaoGrid {...config} />, makeShuqiaoChecker(config))
}

export function gongShufang(config: ShufangProps): GongProblemFields {
  return gongBase(<ShufangGrid {...config} />, makeShufangChecker(config))
}

export function gongBudengSudoku(config: BudengSudokuProps): GongProblemFields {
  return gongBase(<BudengSudokuGrid {...config} />, makeBudengSudokuChecker(config))
}

export function gongWumaSudoku(config: WumaSudokuProps): GongProblemFields {
  return gongBase(<WumaSudokuGrid {...config} />, makeWumaSudokuChecker(config))
}

export function gongChuangkouSudoku(config: ChuangkouSudokuProps): GongProblemFields {
  return gongBase(<ChuangkouSudokuGrid {...config} />, makeChuangkouSudokuChecker(config))
}

export function gongChangguiSudoku(config: ChangguiSudokuProps): GongProblemFields {
  return gongBase(<ChangguiSudokuGrid {...config} />, makeChangguiSudokuChecker(config))
}

export function gongDuijiaoxianSudoku(config: DuijiaoxianSudokuProps): GongProblemFields {
  return gongBase(<DuijiaoxianSudokuGrid {...config} />, makeDuijiaoxianSudokuChecker(config))
}

export function gongJuchiSudoku(config: JuchiSudokuProps): GongProblemFields {
  return gongBase(<JuchiSudokuGrid {...config} />, makeJuchiSudokuChecker(config))
}
