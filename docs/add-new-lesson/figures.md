# 图表 / 交互题 / 配图

**仅当**讲次含宫格组件、题解配图或竖式数字谜时阅读。

> **竖式数字谜、答题区自定义组件的完整约定**（数据字段、ProblemDetail、草稿纸）见 **[`custom-answer-widget.md`](custom-answer-widget.md)**。本文档侧重宫格目录与配图。

---

## 数据文件

- 含 JSX 时数据文件改为 `lessonN-data.tsx`
- 在文件顶部 import 图形组件

---

## 目录

在 `packages/math/src/components/lesson/g{grade}/lesson{seq}/` 下建子目录，如 `gong/`、`Figure/`。

---

## 方格 / 数独类（custom-widget · 模板 A）

复制 `packages/math/src/components/lesson/g1/lesson47/gong/` 整目录，**重命名**子目录与 CSS 类前缀。

数据层用 `create-gong-problem.tsx` 生成 `figureNode` + `checkAnswer`。

`ProblemDetail` 用 [`components.md`](components.md) 模板 A（`1-47`）。

宫格组件须支持 `injectFigureGridCallbacks` 注入的 `onSubmit` / `onStateChange` / `initialState`。

---

## 竖式数字谜（custom-widget · 模板 B）

**不要**建独立 Figure 目录；用 `verticalPuzzle` + `makeVerticalPuzzleChecker`。

`ProblemDetail` 用 [`components.md`](components.md) 模板 B（`2-7`）。

详见 [`custom-answer-widget.md`](custom-answer-widget.md)。

---

## 题解配图

使用 `ProblemFigureImage`、`AnalysisImage` 等共享组件；管理后台 `/admin` 可上传题解图。

题面配图与答题区宫格不同：配图可走「加入画布」；答题区组件走 `ScratchPadCustomAnswerWidget`。

---

## CSS

模块专属样式放在包内 `.css` 并在组件 import；Tailwind 工具类仍由 `globals.css` `@source` 扫描 `packages/math`。
