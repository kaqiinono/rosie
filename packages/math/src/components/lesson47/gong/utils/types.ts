/** 1-indexed coordinate: [row, col, value] */
export type CellCoord = [number, number, number];

/** [行数] 或 [行数, 列数]；列数省略时取行数（如 [3] 表示 3×3） */
export type BudengGridSize = [number, number?];

/** 坐标谜题公共入参：rows 定义行列，列数省略时取行数 */
export interface CoordGridProps {
  /** [行数] 或 [行数, 列数]；列数省略时取行数 */
  rows: BudengGridSize;
  cells: CellCoord[];
  /** 点击「检查答案」时上报当前宫格 state，由 Problem.checkAnswer 权威校验 */
  onSubmit?: (state: unknown) => void;
  /** 宫格内容变化时同步 state（答卷等场景交卷时自动判分） */
  onStateChange?: (state: unknown) => void;
}

export interface ShulianProps extends CoordGridProps {}

export interface ShufangProps extends CoordGridProps {}

export interface BridgeIsland {
  /** 1-indexed row */
  row: number;
  /** 1-indexed col */
  col: number;
  bridges: number;
}

export interface ShuqiaoProps extends CoordGridProps {
  /** 坐标值 [行, 列, 桥数]，行列从 1 开始；检查答案时验证每个岛连线数与数字一致 */
}

export type InequalityOp = "<" | ">" | null;

/** [行/列, 线号, 符号]；线号从 1 起，外框线为 1 与 size+1（不等号仅写在内部线 2..size） */
export type IneqCoord = [number, number, InequalityOp];

/** 数独类组件公共入参：rows + cells；点击「检查」时按各玩法规则自动校验，无需传入 answer */
export interface SudokuGridProps {
  /** [行数] 或 [行数, 列数]；列数省略时取行数 */
  rows: BudengGridSize;
  /** 已知数字 [行, 列, 值]，行列从 1 开始 */
  cells?: CellCoord[];
  onSubmit?: (state: unknown) => void;
  onStateChange?: (state: unknown) => void;
}

export interface BudengSudokuProps extends SudokuGridProps {
  /** 水平不等号：[行, 竖线号, 符号]，左→右，竖线 2=第1-2列之间 */
  hIneq?: IneqCoord[];
  /** 垂直不等号：[列, 横线号, 符号]，上→下，横线 2=第1-2行之间 */
  vIneq?: IneqCoord[];
}

export interface ChangguiSudokuProps extends SudokuGridProps {}

export interface DuijiaoxianSudokuProps extends SudokuGridProps {}

/** [行, 竖线号] 第 row 行从左往右第 line 根竖线描粗（1=左外框，2..colCount=内部，colCount+1=右外框） */
export type HLineCoord = [number, number];

/** [列, 横线号] 第 col 列从上往下第 line 根横线描粗（1=上外框，2..rowCount=内部，rowCount+1=下外框） */
export type VLineCoord = [number, number];

/** 区域坐标 [行, 列]，从 1 开始（内部推导宫格用） */
export type RegionPos = readonly [number, number];

export interface JuchiSudokuProps extends SudokuGridProps {
  /** 宫界竖线：[行, 第几根竖线]（从左往右） */
  hLine?: HLineCoord[];
  /** 宫界横线：[列, 第几根横线]（从上往下） */
  vLine?: VLineCoord[];
}

export interface WumaSudokuProps extends SudokuGridProps {}

/** 窗口起始坐标 [行, 列]，从 1 开始 */
export type ChuangkouWindowPos = readonly [number, number];

/** [起始坐标列表, 窗口尺寸]；尺寸省略列时取行（如 [3] 表示 3×3） */
export type ChuangkouWindowConfig = readonly [readonly ChuangkouWindowPos[], BudengGridSize];

export interface ChuangkouSudokuProps extends SudokuGridProps {
  /** 窗口区域：起始坐标 + 窗口尺寸；省略或 positions 为空时使用默认四宫窗口 */
  window?: ChuangkouWindowConfig;
}
