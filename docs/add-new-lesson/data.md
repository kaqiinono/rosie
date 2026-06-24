# 第一步：数据文件（必读）

> 文件落点：`packages/math/src/utils/lesson{N}-data.ts`（若有 `figureNode` 内联 JSX 则用 `.tsx`，见 `figures.md`）。

完整复制 `packages/math/src/utils/lesson35-data.ts`，然后：

1. 把题目内容全部替换为新讲次的内容
2. 如有新题型，修改 `PROBLEM_TYPES` / `TYPE_STYLE` / `TAG_STYLE`
3. 如有图形题目，创建 `Figure/` 目录并在数据文件中 import（文件须改为 `.tsx`，见 `figures.md`）

数据文件导出结构保持不变：

```typescript
export const PROBLEMS: ProblemSet = {
  pretest: [...],   // 课前测题目
  lesson: [...],    // 课堂讲解题目
  homework: [...],  // 课后巩固题目
  workbook: [...],  // 练习册题目
  // supplement: [...],  // 可选：补充题（有大量专项练习时添加，见文末）
}
export const PROBLEM_TYPES = [...]
export const TYPE_STYLE = {...}
export const TAG_STYLE = {...}
```

> `PROBLEM_TYPES` / `TYPE_STYLE` / `TAG_STYLE` 的字段含义与首页文案提取，见 `components.md`「HomePage 内容提取」。

---

## 每道题的数据结构

```typescript
{
  id: '36-L1',         // ⚠️ 必须加讲次前缀：36-L1 / 36-H1 / 36-W1 / 36-P1 / 36-S1
  title: '课1 · 标题',
  tag: 'type1',        // 题型分类 tag（对应 PROBLEM_TYPES 中的 tag）
  tagLabel: '标签文字',
  difficulty: 2,       // ⚠️ 必填：难度 1–5 星（见下方「难度系数」）
  text: '题目正文，可用 <strong>加粗</strong> 关键数字',
  analysis: [
    '第一步：说明',
    '第二步：说明',
    '⚠️ 注意事项',
  ],
  type: 'ratio3',      // 单变量用 'ratio3'，双变量用 'ratio3b'，无图表用 'none'
  rows: [              // 比例图左列（字符串=标签，对象=输入框）
    '已知条件',
    { id: 'rA1', ans: 3, unit: '分钟' },
    '目标条件',
    { id: 'rA2', ans: 8, unit: '分钟' },
  ],
  rcols: [             // 比例图右列
    '个数',
    { id: 'r1', ans: 180 },
    { id: 'r2', ans: 480 },
  ],
  ops: [               // 运算符圆圈
    { id: 'ot1', ans: '÷3' },
    { id: 'ob1', ans: '×8' },
    { id: 'oc1', ans: '÷3' },
    { id: 'oc2', ans: '×8' },
  ],
  hasBlocks: false,    // 是否显示方块图
  blockScene: {...},   // 单变量方块图配置（hasBlocks=true 时填）
  dualSc: {...},       // 双变量方块图配置（type='ratio3b' 时填）
  finalQ: '8分钟能打多少个',
  finalUnit: '个',
  finalAns: 480,
}
```

> **⚠️ ID 前缀防碰撞：** 所有讲次共享 `math-solved` / `math-wrong` 两个状态键，新讲次每道题 ID
> **必须**加讲次前缀（`36-L1`/`36-H1`/`36-W1`/`36-P1`/`36-S1`），否则不同讲次题目 ID 会碰撞。

---

## 难度系数（difficulty，必填）

每道题必须设置 `difficulty: 1 | 2 | 3 | 4 | 5`（整数，表示 1–5 星）。

| 星级 | 含义 | 判断要点 |
|------|------|----------|
| **1** | 入门 | 直接套公式或单步计算，几乎无需建模 |
| **2** | 基础 | 多一步（如先求公差/项数），或课前测常规题 |
| **3** | 中等 | 标准应用题、课后巩固、拓展前半段 |
| **4** | 较难 | 多步综合、一题多问、拓展后段 |
| **5** | 挑战 | 非标准规律、综合变化、讲次标注「最难」类 |

**录入流程：**

1. 录入题目时根据题面与解析**逐题评定**（不要全部填同一星）。
2. 同一讲次内：课堂「例题」通常 ≤「练一练」≤ 拓展「闯关10+」。
3. 拿不准的题可在 `scripts/difficulty-overrides.json` 写死 ID → 星级，再运行 `node scripts/apply-difficulty.mjs` 批量写入（仅用于补全或重算，新讲次仍建议手写进数据文件）。
4. UI 展示：`LessonProblemList` 与 `ProblemDetail` 会通过 `DifficultyStars` 显示星级；综合题库 `FilterPanel` 使用 `DifficultyFilterRow` 提供难度多选筛选（`alltest/page.tsx` 需同步 `filters.difficulty` 与 `toggleFilter` 逻辑）。

**示例：**

```typescript
{ id: '43-L1', title: '例1 · 递增数列第12项', tag: 'type1', tagLabel: '求第几项', difficulty: 1, ... }
{ id: '43-W12', title: '闯关12 · 算式和总和', tag: 'type6', tagLabel: '综合规律', difficulty: 5, ... }
```

---

## 本地缓存说明

所有讲次共享以下状态键（已在代码中固定，无需新增）：

| key | 存储内容 |
|-----|----------|
| `math-solved` | 所有题目的做题次数 `Record<problemId, count>` |
| `math-wrong` | 所有题目的错题 ID 集合 |
| `math-sidebar-collapsed` | 侧边栏折叠状态（所有讲次共用） |

`constant.ts` **无需改动**——所有讲次共享通用 key。

---

## 补充题模块（supplement，可选）

**补充题是可选模块**，用于提供额外的专项训练题目（如速算 100 题）。**默认讲次不包含补充题，只在有大量练习需求时添加。**

### 什么时候添加补充题

- 某道核心技巧需要大量重复练习（如分配律速算）
- PDF 中提供了额外的专项题目（通常是 50-100 道同类型题）
- 新讲次的题目总数明显不足，需要补充练习量

### 补充题数据结构

`ProblemSet` 中 `supplement` 字段是可选的（`supplement?: Problem[]`），不提供时不显示该模块：

```typescript
export const PROBLEMS: ProblemSet = {
  pretest: [...],
  lesson: [...],
  homework: [...],
  workbook: [...],
  supplement: [...],  // 可选，不写则不显示补充题入口
}
```

### 补充题 ID 命名规范

补充题 ID 使用 `N-S1` ... `N-S100` 格式（S = Supplement）：

```typescript
{ id: '34-S1', title: '补充题1', tag: 'type2', tagLabel: '分配律', ... }
```

### 批量生成补充题的 makeSupp 辅助函数

对于同类型的大量题目（如 100 道分配律速算），可用辅助函数批量生成：

```typescript
function makeSupp(n: number, text: string, factorN: number, inner: number, ans: number, isSubtract = false): Problem {
  const op = isSubtract ? '−' : '+'
  const coeff = ans / factorN
  const label = coeff === 100 ? '100' : coeff === 1000 ? '1000' : `${coeff}`
  return {
    id: `34-S${n}`, title: `补充题${n}`, tag: 'type2', tagLabel: '分配律', text,
    analysis: [`提取公因数${factorN}`, `= ${factorN}×(${inner})`, `= ${factorN}×${label}`, `= ${ans}`],
    type: 'none', finalQ: '计算结果是多少？', finalUnit: '', finalAns: ans,
  }
}

const S1 = makeSupp(1, '3×45 + 3×55 = ？', 3, '45+55', 300)
const S2 = makeSupp(2, '7×38 − 7×28 = ？', 7, '38−28', 70, true)
```

### 补充题模块需要的额外改动

相比标准讲次，添加补充题模块需要额外：

**1. Sidebar.tsx** 在 `sections` 中 workbook 后加入 `{ key: 'supplement', path: \`${BASE}/supplement\`, icon: '📒', label: '补充题' }`

**2. layout.tsx** 的 `SECTION_COUNTS` 增加 `supplement: PROBLEMS.supplement?.length ?? 0`

**3. FilterPanel.tsx** 的 `sourceBtns` 增加 `{ key: 'supplement', label: '📒 补充题' }`

**4. alltest/page.tsx** 的 source 初始 Set 增加 `'supplement'`

**5. HomePage.tsx** 的 `MODULES` 数组增加 `{ key: 'supplement', path: \`${BASE}/supplement\`, icon: '📒', bg: 'bg-amber-50', title: '补充题', desc: 'N道速算 · [主题描述]' }`

**6. 新增路由页面**（结构同 homework，见 `routes.md`「supplement 路由」）：
- `apps/web/src/app/math/ny/N/supplement/page.tsx`
- `apps/web/src/app/math/ny/N/supplement/[id]/page.tsx`
