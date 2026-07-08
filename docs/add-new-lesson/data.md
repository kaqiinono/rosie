# 第一步：数据文件

`packages/math/src/utils/g{grade}/lesson{seq}-data.ts(x)`

| lessonKey | 文件 |
|-----------|------|
| `1-12` | `g1/lesson12-data.ts` |
| `2-7` | `g2/lesson7-data.ts` |
| `2-8` | `g2/lesson8-data.ts` |

**骨架：** 复制同年级上一讲数据文件，替换题目内容。

---

## 题目 ID

格式：`{lessonKey}-{后缀}`，如 `2-8-L1`、`2-8-H3`。

- 可用 `problemIdForLesson('2-8', 'L1')`
- 禁止 legacy 前缀（`56-L1`）或裸 `L1`
- 总结 sentinel：`2-8__SUMMARY`

---

## ProblemSet

```ts
export const PROBLEMS: ProblemSet = {
  pretest: [],
  lesson: [...],
  homework: [],
  workbook: [],
  supplement: [...],
}
```

空模块用 `[]`。导出 `PROBLEMS`、`PROBLEM_TYPES`、`TAG_STYLE`。

**答题区自定义组件**（竖式谜、宫格交互）见 [`custom-answer-widget.md`](custom-answer-widget.md)；宫格配图见 [`figures.md`](figures.md)。
