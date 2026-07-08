# 路由（动态讲次页）

## 现状

```
apps/web/src/app/math/ny/[grade]/[seq]/**
```

`DynamicLessonLayout`：`lesson-registry`（grade+seq → lessonKey）→ `lesson-module-registry`（lessonKey → 组件）→ `components/lesson/g{grade}/lesson{seq}/`。

---

## 新增讲次

1. `lesson-registry.ts` — `{ lessonKey, grade, seq }`
2. `lesson-module-registry.ts` — `'2-8': { … }`
3. 数据 + `lesson/g2/lesson8/` 组件
4. **不要**建 `apps/web/src/app/math/ny/N/` 或 `ny/56/`

---

## 已废弃

- `/math/ny/52` → 用 `/math/ny/2/4`
- 根目录 `components/lesson52/`（已迁至 `lesson/g2/lesson4/` 等）

---

## 验证

`/math/ny/2/8`、`/math/ny/2/8/alltest`、`/math/ny/2/8/lesson/1`

**连续练习：** `/math/ny/2/8/pretest` 等分模块页顶栏「开始练习」；`/math/ny/2/8/alltest` 筛选后「开始练习」。`PracticeQueueProvider` 已在 `apps/web/src/app/math/layout.tsx` 挂载。详见 [`practice-queue.md`](practice-queue.md)。
