# 图表 / 交互题 / 配图

**仅当** `lessons/N.md` 含内联 JSX、SVG 组件、题解配图或方格谜题时阅读。

---

## 数据文件

- 含 JSX 时数据文件改为 `lessonN-data.tsx`
- 在文件顶部 import 图形组件

---

## 目录

在 `packages/math/src/components/lessonN/` 下建子目录，如 `Figure/` 或 `grids/`。

---

## 方格 / 数独类

复制 `packages/math/src/components/lesson47/gong/` 整目录，**重命名**子目录与 CSS 类前缀；`ProblemDetail` 用 `components.md` 模板 B。

---

## 题解配图

使用 `ProblemFigureImage`、`AnalysisImage` 等共享组件；管理后台 `/admin` 可上传题解图。

---

## CSS

模块专属样式放在包内 `.css` 并在组件 import；Tailwind 工具类仍由 `globals.css` `@source` 扫描 `packages/math`。
