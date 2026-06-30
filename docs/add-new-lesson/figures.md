# 图表 / 图形 / 配图（按需阅读）

> 仅当讲次包含图表、SVG 图形、可交互组件或题解配图时才需要读本文件。
> 纯文字题（无任何图）可**跳过整篇**。

---

## 图表插槽（拆解图 / 倍比图 / 流程图 / 其他）

**图表是完全可定制的，每个讲次可以有独立的图表组件，互不干扰。**

`ProblemDetail` 支持两个图表插槽（props）：

| prop | 位置 | 说明 |
|------|------|------|
| `leftDiagram` | 左列（题目下方） | 传入时替换默认拆解图；传 `null` 则不显示任何内容 |
| `rightDiagram` | 右列（答题框上方） | 传入时替换默认倍比图；传 `null` 则不显示任何内容 |

两个 prop 都不传时，回退到 `type` 字段驱动的默认渲染（`type` 为 `ratio3` / `ratio3b` 等时）。

**有倍比图/拆解图字段（`rows`/`rcols`/`ops`）的题**：`ProblemDetail` 无需传这两个 prop，由 `type` 默认渲染。

**新讲次有流程图**（示例）：图表 props 挂在**该讲**的 `ProblemDetail` 上；路由仍用 `LessonProblemRoutePage`，静态 props 走 `detailProps`：

```tsx
// apps/web/src/app/math/ny/36/lesson/[id]/page.tsx
import LessonProblemRoutePage from '@rosie/math/components/shared/LessonProblemRoutePage'
import { PROBLEMS, LESSON_TIP } from '@rosie/math/utils/lesson36-data'
import ProblemDetail from '@rosie/math/components/lesson36/ProblemDetail'

export default function LessonProblemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LessonProblemRoutePage
      params={params}
      basePath="/math/ny/36"
      section="lesson"
      problems={PROBLEMS.lesson}
      Detail={ProblemDetail}
      detailProps={{ tip: LESSON_TIP }}
    />
  )
}
```

在 `lesson36/ProblemDetail.tsx` 内按 `problem` 渲染 `rightDiagram` / `leftDiagram`（见该文件现有实现）。

**新讲次无任何图表**：在 `ProblemDetail` 内不传图表插槽，或显式 `leftDiagram={null}`、`rightDiagram={null}`。

**新建图表组件的规范**：在 `packages/math/src/components/lessonN/` 下新建 `LessonNXxxDiagram.tsx`，接收 `problem: Problem` 作为 prop，返回图表 JSX。图表组件内部不依赖任何特定 Provider，只读取 `problem` 数据。

**口诀提示框**通过 `tip` prop 控制：
- 每个讲次在数据文件中导出 `export const LESSON_TIP = '...'`
- 不需要口诀的讲次不导出该常量，路由页面不传 `tip` prop 即可

---

## 自定义图形组件（figureNode）

**当题目需要配套 SVG 图形时，使用 `figureNode` 字段。**

- `figureNode?: ReactNode` — 题目中的图形插图（SVG React 组件），显示在题目卡片内
- 图形组件放在 `packages/math/src/components/lessonN/Figure/` 目录，每个组件对应一道题的图
- 命名规范：`LessonFigN.tsx`、`HomeworkFigN.tsx`、`WorkbookFigN.tsx`、`PretestFigN.tsx` 等

**⚠️ 重要：** 若数据文件中任何题目使用了 `figureNode: <SomeComponent />`（JSX 语法），数据文件**必须使用 `.tsx` 扩展名**，而非 `.ts`。例：
- 有 figureNode → `packages/math/src/utils/lesson38-data.tsx`（JSX 扩展名必须）
- 无 figureNode → `packages/math/src/utils/lesson36-data.ts`（普通 TypeScript 文件）

典型的图形组件结构（以一笔画 SVG 图为例）：
```tsx
// packages/math/src/components/lesson38/Figure/LessonFig2.tsx
const stroke = '#0891b2'
export default function LessonFig2() {
  return (
    <svg viewBox="0 0 260 200" className="h-full w-full">
      {/* SVG 图形内容 */}
    </svg>
  )
}
```

---

## 交互式组件题（自带校验的图形组件，如方格谜题）

**当 `docs/math/lessons/N.md` 的题目正文里内联了 tsx 组件代码块**（例如数连/数桥/数方、各类变型数独的
`<ShulianGrid .../>`、`<ChuangkouSudokuGrid .../>` 等），这些组件是**可交互、自带「检查/重置」与结果反馈**的
完整题目载体，处理方式与普通 `figureNode` 不同。**按下列步骤从 N.md 代码块新建，不要打开旧讲次目录对照。**

### 铁律：严格按代码块使用组件与入参

- 组件放在 `packages/math/src/components/lesson{N}/<子目录>/`（子目录名自定，如 `gong/`），
  **入参类型定义在该目录的 `utils/types.ts`**。录入时**逐字照搬 N.md 代码块里的组件名与 props**
  （`rows` / `cells` / `hIneq` / `vIneq` / `window` / `hLine` / `vLine` …），**不得自己发明 prop、改名或改值**。
- 组件用**具名导出**。不要去 import 该目录的 `index.ts` 桶文件——桶文件可能 re-export 仅 demo 用、实际不存在的文件。
- 数据文件含 JSX，**必须用 `.tsx`** 后缀（`lesson{N}-data.tsx`）。
- **修正明显笔误**：代码块偶有手误（如第47讲无马数独里 `[,4,2]` 这种缺首元素的稀疏数组），照搬会破坏
  tuple 类型且渲染异常——按上下文（所在行号）补成 `[6,4,2]`，并在交付说明里指出。

### 用 `create-gong-problem` 工厂封装组件 + 自动判分

这类题**没有 `finalAns` 数字答案**，而是**靠组件自己判对错**。在
`packages/math/src/components/lesson{N}/<子目录>/create-gong-problem.tsx`（文件名可自定）里为每种谜题导出一个工厂函数，数据文件只调工厂、不写 JSX：

- 工厂为每种谜题导出一个 `gongXxx(config)`，内部 `<XxxGrid {...config} />` 建元素、`makeXxxChecker(config)`（在
  同目录 `checkers.ts`）造判分函数，返回一组 `Problem` 字段：`type:'none'`、`finalQ/finalUnit:''`、`finalAns:0`、
  `figureNode`（组件）、**`checkAnswer`**（核心：组件提交时按谜题规则判对错）。
- 数据文件里**用展开语法**填进每道题，props 由 `config` 上下文收窄（`[[1,1,3]]`→`CellCoord[]`、`'<'`→`InequalityOp`，无需 `as`）：
  ```tsx
  { id: '47-L1', title: '例题1 · 数连', tag: 'type1', tagLabel: '数连', difficulty: 2,
    text: RULE_SHULIAN, analysis: ['先点数字格选颜色再连线', …],
    ...gongShulian({ rows: [5], cells: [[1,1,3], [1,3,2], …] }) }
  ```
- **答题/判分链路（勿重复造轮子）**：`Problem.checkAnswer`（`@rosie/core`）+ 共享
  `utils/check-problem-answer.ts` + `hooks/useProblemAnswer.ts` + `components/shared/injectFigureSubmit.tsx`
  （`injectFigureGridCallbacks` 把组件的 `onCheck/onComplete` 接到提交逻辑）。`ProblemDetail` 用
  **`components.md` 模板 B**（`useProblemAnswer` + `QuestionLayout` + `injectFigureGridCallbacks`），答对自动 `handleSolve`、答错记错题。
- `pretest` 没有就 `pretest: []`，侧边栏 / HomePage 模块 / FilterPanel sourceBtns / alltest 的 source Set
  里都**不要**列 `pretest`、`supplement`（按该讲真实存在的 section 来配）。
- `PROBLEM_TYPES` 按**谜题种类**分（例如数连/数桥/数方/不等号/无马/窗口/常规/对角线/锯齿），
  每题 `tag` 对应其谜题类型，难度按棋盘规模/复杂度评（4×4≈1–2，5×5≈2–3，6×6≈3–4，9×9≈4–5）。

### ⚠️ 组件依赖的 CSS 跟组件走（green build ≠ 渲染正常）

这类组件常引用一组 **CSS 变量 + 结构类**（如 `--gong-*` 变量与 `.gong-table` / `.gong-cell` 等）。这些**不是 Tailwind 工具类**，未定义则组件渲染成
无边框无尺寸的一坨——且 `pnpm build` **不会报错**。**正确做法是让样式随包走，不要塞进 app 的 `globals.css`：**

1. 枚举组件用到的所有 token：
   ```bash
   grep -rho "var(--xxx-[a-z0-9-]*)" packages/math/src/components/lesson{N}/<子目录>/ | sort -u
   grep -rho "xxx-[a-z0-9-]*"        packages/math/src/components/lesson{N}/<子目录>/ | sort -u
   ```
2. 在**组件子目录内**新建 `<子目录>.css`，写 `:root { --xxx-*: … }` 变量与各结构类
   样式（宽高、`border-collapse`、单元格边框、宫界粗线等），并在该子目录**被所有组件共用的文件**（如 `shared.tsx`）顶部 `import './xxx.css'`。
3. 跑 `pnpm dev` **真机打开新讲次页面**确认组件能正常显示、能点选、能「检查」。

---

## 题解配图（analysisImg）

**当题目需要在「题解」区域配一张静态图（手绘讲解图 / 标注示意图 / 拍照截图）时，使用 `analysisImg` 字段。**

- `analysisImg?: string` — 题解配图，**只是字符串路径**，无需 JSX，因此 `.ts` 数据文件无需改名为 `.tsx`
- 图片放到 `public/img/math/` 下，命名建议为 `{讲次}-{题号}.png`（例 `41-P5.png`）
- 渲染位置：题解面板（🔍 题型分析）下方，由共享组件 `AnalysisImage`（`packages/math/src/components/shared/AnalysisImage.tsx`）统一渲染样式
- 仅当字段存在时才显示，未设置时不影响任何题目

### 使用步骤

**1. 把图片放入 public：**
```
public/img/math/41-P5.png
```

**2. 在题目对象中加一行：**
```typescript
{
  id: '41-P5',
  title: '课前测5 · 圆圈站队（一）',
  // ...其他字段...
  analysisImg: '/img/math/41-P5.png',   // ← 新增
  // ...
}
```

**3. 在 `ProblemDetail.tsx` 题解区渲染该字段**（模板 A 已包含）：
```tsx
import AnalysisImage from '@rosie/math/components/shared/AnalysisImage'

const solution = (
  <div className="...">
    <div>🔍 题型分析</div>
    <ul>{problem.analysis.map(...)}</ul>
    {problem.analysisImg && <AnalysisImage src={problem.analysisImg} alt={problem.title} />}
  </div>
)
```

### `analysisImg` vs `figureNode` 怎么选

| 字段 | 显示位置 | 类型 | 适用场景 | 是否要求 `.tsx` |
|------|----------|------|----------|----------------|
| `analysisImg` | 题解区（折叠面板内） | `string` 路径 | 静态题解图（PNG / JPG / SVG 文件） | 否，`.ts` 即可 |
| `figureNode` | 题目区（题面下方） | `ReactNode` | 题目本身配图、可交互 SVG、动态 JSX | 是，必须 `.tsx` |

两者可同时使用：`figureNode` 展示题目所需的图，`analysisImg` 展示题解推导图。
