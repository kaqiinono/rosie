# 第一步：数据文件

生成 `packages/math/src/utils/lessonN-data.ts`（有内联 JSX 则用 `.tsx`）。

**骨架：** 只读并复制 `lesson35-data.ts`，替换题目内容；不要抄 lesson35 的具体题目。

---

## 题目 ID 规则（重构后）

格式：`{lessonKey}-{后缀}`

| 模块 | 后缀示例 | 完整 ID 示例 |
|------|----------|--------------|
| 课前测 | P1, P2… | `2-4-P1` |
| 课堂 | L1, L2… | `2-4-L1` |
| 课后 | H1, H2… | `2-4-H1` |
| 拓展/练习册 | W1… | `2-4-W1` |
| 附加 | S1… | `2-4-S1` |

- `lessonKey` 来自 `lesson-registry`（如二年级第 4 讲 → `2-4`）
- **禁止** `52-L1`（legacy 前缀）或裸 `L1`
- 可用 `problemIdForLesson('2-4', 'L1')` 生成（`lesson-registry.ts`）

讲次总结 sentinel：`2-4__SUMMARY`（`lessonSummaryProblemId(lessonKey)`）

---

## ProblemSet 结构

```ts
export const PROBLEMS: ProblemSet = {
  pretest: [...],
  lesson: [...],
  homework: [...],
  workbook: [...],   // 无题则 []
  supplement: [...], // 可选，无则省略或 []
}
```

空模块用 `[]`，页面仍可正常生成。

**仅课堂+附加题** 时常见结构：

```ts
export const PROBLEMS: ProblemSet = {
  pretest: [],
  lesson: LESSON,      // 课堂讲解
  homework: [],
  workbook: [],
  supplement: SUPPLEMENT,
}
```

多小题（例题 1 的（1）（2）（3））拆成 `L1`、`L2`、`L3`，不要合并成一题。

### 竖式 / 数字谜（纯文本）

```ts
const V = (body: string) =>
  `<pre class="my-3 overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 font-mono text-[13px] leading-relaxed whitespace-pre">${body}</pre>`

// text 字段示例：
text: `在方框内填数使竖式成立。${V('  □ 5 □\n+ 3 □ 3\n──────\n  8 5 2')}`,
```

字母/汉字谜若无唯一数值答案，`finalQ` 问其中一个关键量（如「○代表」），`analysis` 写推理步骤。

---

## 导出

与现有讲次一致，至少导出：

- `PROBLEMS`
- `PROBLEM_TYPES`（题型筛选）
- `TAG_STYLE`（标签颜色）
- `TYPE_TIP` / `LESSON_TIP`（按需）
