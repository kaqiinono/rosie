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

两个 prop 都不传时，回退到 `type` 字段驱动的默认渲染（lesson35 现有行为）。

**lesson35（倍比图 + 拆解图）**：无需传这两个 prop，默认渲染。

**新讲次有流程图**（示例）：
```tsx
// apps/web/src/app/math/ny/36/lesson/[id]/page.tsx
import Lesson36Flowchart from '@rosie/math/components/lesson36/Lesson36Flowchart'

return (
  <ProblemDetail
    problem={problem}
    tip={LESSON_TIP}
    rightDiagram={<Lesson36Flowchart problem={problem} />}
    leftDiagram={null}   // 明确不显示左列图表
  />
)
```

**新讲次无任何图表**：
```tsx
return (
  <ProblemDetail
    problem={problem}
    leftDiagram={null}
    rightDiagram={null}
  />
)
```

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

**当 `docs/math/new-lesson.md` 的题目正文里内联了 tsx 组件代码块**（例如数连/数桥/数方、各类变型数独的
`<ShulianGrid .../>`、`<ChuangkouSudokuGrid .../>` 等），这些组件是**可交互、自带「检查/重置」与结果反馈**的
完整题目载体，处理方式与普通 `figureNode` 不同。第47讲是第一个这样的讲次，可作范例。

### 铁律：严格按代码块使用组件与入参

- 组件已经预先放在 `packages/math/src/components/lesson{N}/<子目录>/`（第47讲是 `lesson47/gong/`），
  **入参类型定义在该目录的 `utils/types.ts`**。录入时**逐字照搬代码块里的组件名与 props**
  （`rows` / `cells` / `hIneq` / `vIneq` / `window` / `hLine` / `vLine` …），**不得自己发明 prop、改名或改值**。
- 组件用**具名导出**：`import { ShulianGrid } from '@rosie/math/components/lesson{N}/gong/ShulianGrid'`。
  **逐个组件按其自身文件深子路径导入**，不要图省事去 import 该目录的 `index.ts`——桶文件可能 re-export
  仅 demo 用、实际不存在的文件（第47讲的 `gong/index.ts` 原本 re-export `../demo/*`，会直接编译失败，已删除）。
- 数据文件含 JSX，**必须用 `.tsx`** 后缀（`lesson{N}-data.tsx`）。`figureNode` 写成内联 JSX
  `figureNode: <ShulianGrid rows={[5]} cells={[[1,1,3], …]} />` 时，TS 会用 props 类型做**上下文推断**，
  因此 `[[1,1,3]]` 会被正确收窄成 `CellCoord[]`、`'<'` 收窄成 `InequalityOp`，无需手动 `as` 断言。
- **修正明显笔误**：代码块偶有手误（如第47讲无马数独里 `[,4,2]` 这种缺首元素的稀疏数组），照搬会破坏
  tuple 类型且渲染异常——按上下文（所在行号）补成 `[6,4,2]`，并在交付说明里指出。

### 这类题没有数字答案 → ProblemDetail 要改造

组件自己负责答题与判分，**没有 `finalAns` 数字答案**。因此：

- 每题数据里 `type: 'none'`，`finalQ: ''`、`finalUnit: ''`、`finalAns: 0`（占位，满足 `Problem` 必填字段）。
- 该讲的 `ProblemDetail.tsx` **不要渲染数字答题框**。改为：把 `figureNode`（交互组件）放在题面下方作为答题区，
  题解区放玩法规则（`analysis`），答案区放一个「✅ 我做出来啦！」按钮 → 调用 `handleSolve(problem.id)` 记录一次
  掌握；**不调用 `addWrong`**（探索类谜题不进错题本）。
- `pretest` 没有就 `pretest: []`，侧边栏 / HomePage 模块 / FilterPanel sourceBtns / alltest 的 source Set
  里都**不要**列 `pretest`、`supplement`（按该讲真实存在的 section 来配）。
- `PROBLEM_TYPES` 按**谜题种类**分（第47讲 9 种：数连/数桥/数方/不等号/无马/窗口/常规/对角线/锯齿），
  每题 `tag` 对应其谜题类型，难度按棋盘规模/复杂度评（4×4≈1–2，5×5≈2–3，6×6≈3–4，9×9≈4–5）。

### ⚠️ 组件依赖的 CSS 必须落地（green build ≠ 渲染正常）

这类组件常引用一组 **CSS 变量 + 结构类**（第47讲是 `--gong-*` 变量与 `.gong-table` / `.gong-cell` /
`.gong-cell-sm` / `.gong-box-r` / `.gong-box-b`）。这些**不是 Tailwind 工具类**，如果没在全局样式里定义，
组件会渲染成无边框、无尺寸的一坨——而且 `pnpm build` **不会报错**。处理步骤：

1. 枚举组件用到的所有 token：
   ```bash
   grep -rho "var(--xxx-[a-z0-9-]*)" packages/math/src/components/lesson{N}/<子目录>/ | sort -u
   grep -rho "xxx-[a-z0-9-]*"        packages/math/src/components/lesson{N}/<子目录>/ | sort -u
   ```
2. 在 `apps/web/src/app/globals.css` 末尾补 `:root { --xxx-*: … }` 变量与各结构类的实际样式
   （宽高、`border-collapse`、单元格边框、宫界粗线等）。第47讲的 `gong` 样式块即此范例，可参考其取值。
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

**3. 确保 `ProblemDetail.tsx` 已渲染该字段**（lesson41 已接入；新讲次复制 lesson41 的 ProblemDetail 时自动具备此能力）：
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
