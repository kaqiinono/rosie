# 路由（动态讲次页）

## 现状

所有讲次共用一套 App Router 动态路由：

```
apps/web/src/app/math/ny/
  [grade]/page.tsx              → 年级讲次卡片列表
  [grade]/[seq]/
    layout.tsx                  → DynamicLessonLayout（顶栏/侧栏/底栏壳）
    page.tsx                    → 讲次首页
    lesson/page.tsx             → 课堂列表
    lesson/[id]/page.tsx        → 题目详情
    homework/ … pretest/ … workbook/ … supplement/
    alltest/page.tsx
    mistakes/page.tsx
    notes/page.tsx
    drafts/page.tsx
    magic/page.tsx              → 仅 module 声明 MagicPage 时有效
```

页面体为薄 re-export，例如：

```tsx
export { DynamicLessonHomePage as default } from '@rosie/math/components/shared/dynamic-lesson/DynamicLessonPages'
```

`DynamicLessonLayout` 通过 `lesson-registry` + `lesson-module-registry` 解析 `grade`/`seq` → 加载对应 `lessonN` 组件集。

---

## 新增讲次时

1. 在 `lesson-registry.ts` 登记 `{ grade, seq, lessonKey, legacyId, slug }`
2. 在 `lesson-module-registry.ts` 注册 `slug` 模块
3. **不要**创建 `apps/web/src/app/math/ny/N/` 或 `g2/4` 等静态目录
4. **不要**修改 `[grade]/[seq]/*.tsx`（除非新增全站级子路由类型）

---

## 已废弃路径

| 旧路径 | 现状 |
|--------|------|
| `/math/ny/52` | 已移除，用 `/math/ny/2/4` |
| `/math/ny/g2/4` | 已移除 |
| 每讲 `ny/N/layout.tsx` | 已移除 |

`next.config` 不再配置讲次 legacy 重定向。

---

## 验证 URL

登录后访问：

- `/math/ny/{grade}/{seq}` — 首页
- `/math/ny/{grade}/{seq}/alltest` — 综合题库
- `/math/ny/{grade}/{seq}/lesson/1` — 第一题
