# 口算模块融合设计 — 把 `/calculate` 的精华并入 `/calc` 自由模式

**日期:** 2026-06-12
**状态:** 已批准设计,待实现计划

## 背景与目标

仓库里有两个心算/计算模块:

- **`/calc`(口算)** — 可组合的自由练习。家长用积木块(`BLOCKS`)+ 7 个混合骨架(`SKELETONS`)在 `/calc/settings` 自由编排;按 signature 的轻量 0–5 熟练度 + 弱点加权出题(`buildSession`)。**这是要保留的骨架。**
- **`/calculate`** — 进阶机制(技能树 / 关卡 / 三档 tier / IRT 能力值 / 解锁前置 / 间隔复习)。题型更丰富、考察更深,但进阶脚手架是用户**明确不想要**的。

**目标:以 `calc` 为骨架,把 `calculate` 的"更深题型"与"错误诊断/薄弱点报告"并入自由模式,然后整体下线 `/calculate`。**

### 范围决策(已确认)

- ✅ 加入:更大整数范围、有余数除法、小数加减乘除、逆运算/等式挖空、**竖式(列为最重要题型)**、**分数(加减乘除全套)**、错误诊断 + 薄弱点报告。
- ❌ 排除:应用题(`step_solve`)、数轴(`number_line`)、技能树 / 关卡 / tier / IRT / 解锁前置 / 间隔复习。
- 分数输入:**混合** — 同分母入门用饼图,异分母 / 结果>1 用分子分母键盘。
- 分数判分:**接受任意等值**(`2/4 == 1/2` 都算对),未约到最简时温和提示「还能再约一约哦」。

## 核心架构决策:答案模型

`calc` 现状是 `answer: number` + 单一 `NumberPad` + 整数 AST(`signatureOf`/`evalAst`)。分数与余数打破了"答案是一个数"。采用 **方案 A**:

- `CalcQuestion.answer` 改为可辨识联合(discriminated union):
  ```ts
  type CalcAnswer =
    | { kind: 'int'; value: number }
    | { kind: 'decimal'; value: number; tolerance?: number }
    | { kind: 'remainder'; quotient: number; remainder: number }
    | { kind: 'fraction'; num: number; den: number }
  ```
- 整数 / 小数题继续走现有 AST 路径(小数只是扩展叶子为非整数,答案仍可由 `evalAst` 求得)。
- 分数题走**独立生成器** `calc-fractions.ts`,有自己的 signature 方案,不污染整数 AST。
- `session` / `report` / `mistakes` 按 `answer.kind` 分派渲染与判分。

被否决的方案:B(两套并行 question 类型 → 造成 session/report/mistakes 重复管线,违反 Schema 对称性原则);C(把有理数塞进整数 AST → 约分/相等边缘逻辑污染所有地方)。

## 分阶段计划(每阶段独立可上线)

### Phase 1 — 更大整数范围 + 逆运算/等式挖空
*无答案模型改动,对现有零风险*

- `calc-blocks.ts` 新增整数积木:1000以内加减、万以内加减、两位数×两位数、多位数÷一位数(答案仍为整数)。
- 逆运算渲染:对已有 signature 做显示变换(`48 + ? = 105`、`? × b = c`),港 `EquationFill` 组件;答案仍是一个数 → 无模型改动。全局「包含逆运算」开关(约 30% 单运算题以挖空形式出现)。
- `/calc/settings` 编排器加入新积木 + 逆运算开关。

**触及文件:** `calc-blocks.ts`、`components/calc/EquationFill.tsx`(新,港自 calculate)、`calc/settings/*`、`calc/session/page.tsx`(挖空渲染分支)、`type.ts`(`CalcSettings` 加 `includeInverse`)。

### Phase 2 — 竖式(vertical)答题模式
*旗舰题型*

- 港 `VerticalCalc` + `DivisionVertical` → `src/components/calc/`。
- 题目加 `answerMode: 'pad' | 'vertical'`;多位加/减/乘、多位除默认竖式;编排器内每块可覆盖(存法同 `timeLimitOverrides` → 新增 `answerModeOverrides`)。
- `/calc/session` 加答题模式分派(结构港自 `calculate/session` 第 506–574 行)。

**触及文件:** `components/calc/VerticalCalc.tsx`、`components/calc/DivisionVertical.tsx`(新)、`calc-blocks.ts`(标注 vertical-capable)、`type.ts`(`CalcSettings.answerModeOverrides`、`CalcQuestion.answerMode`)、`calc/session/page.tsx`、`calc/settings/*`。

### Phase 3 — 答案模型重构 + 有余数除法 + 小数
*启用性重构*

- 引入 `CalcAnswer` 联合;迁移所有读取点(session 判分、mistakes、report)。
- 有余数除法积木 + 小组件 `RemainderPad`(商 + 余数两格)。
- 小数加减乘除积木 + 容差比较(港 `isWithinTolerance`)。

**触及文件:** `type.ts`(`CalcQuestion.answer` → 联合)、`calc-ast.ts`(`makeQuestion`/小数叶子)、`calc-blocks.ts`(余数 / 小数块)、`components/calc/RemainderPad.tsx`(新)、`calc/session/page.tsx`、`useCalcProblemState`/`useCalcMistakes`(读写答案处)。

### Phase 4 — 分数(加减乘除全套)
*最大一块*

- 新 `calc-fractions.ts` 生成器(独立于整数 AST),分数 signature 方案;积木:同/异分母加减、分数×整数/分数、分数÷整数/分数。编排器新增「分数」组。
- 港 `FractionVis`(饼图)+ 新建分子/分母键盘;按 level / 分母混合选择:同分母入门用饼图,异分母 / 结果>1 用键盘。
- 等值判分(`2/4 == 1/2` 对)+ 未约到最简时温和提示「还能再约一约哦」。

**触及文件:** `calc-fractions.ts`(新)、`components/calc/FractionVis.tsx`、`components/calc/FractionPad.tsx`(新)、`calc-blocks.ts` 或 `calc-fractions.ts`(分数块目录)、`calc-helpers.ts`(`buildSession` 纳入分数源)、`type.ts`(`CalcCategory` 加 `'fraction'`)、`calc/settings/*`、`calc/session/page.tsx`。

### Phase 5 — 错误诊断 + 薄弱点报告
*复用 calculate 的 taxonomy,在 calc 的 AST 上重建引擎*

- 新 `calc-diagnose.ts`:确定性、AST 感知 —— carry_miss / place_value(×10)/ order_confusion(严格从左到右重算)/ careless,以及 fraction_concept(分母直加 等,因分数已加入而 live)。
- 扩表:`calc_mistakes`(+`user_answer`、+`error_tag`)、`calc_sessions`(+`error_summary jsonb`)。答错时调用诊断写入。迁移 SQL 放 `docs/sql/`。
- `/calc/report` 加「错误类型分布」节 + 每块 top 错误(港布局 + `ERROR_TAG_LABELS`)。**熟练度/掌握度不动** —— 这是纯附加的正交维度,不引入第二套掌握度系统。

**触及文件:** `calc-diagnose.ts`(新)、`docs/sql/calc-error-collection-migration.sql`(新)、`useCalcMistakes`/`useCalcSession`(写 user_answer/error_tag/error_summary)、`calc/session/page.tsx`(答错调用诊断)、`calc/report/page.tsx`(新报告节)、`type.ts`(`ErrorTag` + `CalcMistake.userAnswer/errorTag`)。

### Phase 6 — 下线 `/calculate`
*在全部 salvage 完成后*

- 删除 `src/app/calculate/**`、`calculate-*.ts` utils、calculate 专用 hooks;彻底移除 IRT/树/tier/onboarding。
- 迁移脚本 drop `calculate_*` 表。更新 `CLAUDE.md`。

**触及文件:** 删 `src/app/calculate/**`、`src/utils/calculate-*.ts`、`src/hooks/useCalculate*.ts`;`docs/sql/calculate-decommission.sql`(新);`CLAUDE.md`。

## 横切关注点

### 组件 salvage(calculate → components/calc)
- **港:** `VerticalCalc`、`DivisionVertical`、`FractionVis`、`EquationFill`。
- **不港:** `NumberLine`、`StepSolve`(范围外)。
- **合并去重:** `FeedbackOverlay`、`SessionSummary`、`NumberPad`、`QuestionDisplay` —— 统一到 calc 版本。

### 错误模式分类法(taxonomy,直接复用)
8 类 `ErrorTag` + 中文标签 `ERROR_TAG_LABELS` 整张搬运。当前范围内可可靠采集的子集:`carry_miss`、`place_value`、`order_confusion`、`careless`、`fraction_concept`;`estimation_off` 勉强;`comprehension`、`formula_misuse` 暂不 live(无应用题/百分数)。

**关键:不照搬 calculate 的分类引擎。** `detectErrorTag(distractorType)` 依赖选择题干扰项 —— calc 是纯输入,无 distractor,作废。`diagnoseBlank` 是启发式且弱。calc 有结构化 AST `signature`,据此写**确定性**诊断器(如逐位模拟加法精确识别漏进位),质量高于 calculate 原版。

### Schema
- 新积木只是目录数据,无 schema 改动。
- 仅 Phase 5 触及 schema(`calc_mistakes`、`calc_sessions` 加列)。
- 新开关进 `calc_settings`(`includeInverse`、`answerModeOverrides`)。

### 流程与约束
- 每阶段 UI 改动**先调 `frontend-design` skill**(目标用户 7 岁,playful 美学;温和/怪兽化错误反馈,与现有 calc `FeedbackOverlay` 一致)。
- 仓库无测试套件 → 每阶段验证 = `pnpm lint` + `pnpm build` + 手动(lint/build 由用户手动跑)。
- 遵循 Schema 对称性原则:错误账本走 calc 自己的表扩展,不另起新表造成不对称。

## 验收标准(整体)

1. `/calc` 自由模式可练:整数(到万以内、两位×两位、多位÷一位)、有余数除法、小数加减乘除、逆运算挖空、竖式、分数加减乘除。
2. 竖式题以竖式 UI 作答;分数题按混合规则用饼图或分子分母键盘作答;分数等值判对并提示约分。
3. 答错时记录用户答案 + 自动错误标签;`/calc/report` 展示错误类型分布与每块 top 错误,且不破坏现有熟练度报告。
4. `/calculate` 整个目录、utils、hooks、表全部移除;`CLAUDE.md` 更新;`pnpm build` 通过。
