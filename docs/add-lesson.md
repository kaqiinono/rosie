按照 `docs/add-new-lesson.md` 的完整指引，在 `apps/web/src/app/math/ny/` 下新增一个讲次。

## 第零步：自动读取题目文件

**在做任何事之前**，先读取 `docs/files/` 目录下的所有文件，自动匹配到对应模块：

| 文件名 | 对应模块 |
|--------|----------|
| `课堂讲解.md` | `PROBLEMS.lesson` |
| `课后巩固.md` | `PROBLEMS.homework` |
| `拓展练习.md` | `PROBLEMS.workbook` |
| `课前测.md` | `PROBLEMS.pretest` |
| `supplement.md` 或 `附加题.md` | `PROBLEMS.supplement`（可选） |
| `summary.md` | 首页文案（讲次信息、题型、口诀等） |

读取步骤：
1. `ls docs/files/` 确认当前有哪些文件
2. 逐一读取所有文件全文，**先通读完所有内容，确认每个模块的题目总数**，再开始录入
3. 没有对应文件的模块设为空数组（如 `pretest: []`），不影响页面生成

## 执行步骤

严格按照 `docs/add-new-lesson.md` 中的步骤顺序执行：

1. **第一步：新建数据文件** — `packages/math/src/utils/lessonN-data.ts`（有 figureNode 则用 `.tsx`）
2. **第二步：解析首页内容** — 从 `summary.md` 提取讲次基本信息、核心公式、万能口诀、题型列表、各模块题数
3. **第三步：新建组件目录** — `packages/math/src/components/lessonN/` 下的 7 个组件文件
4. **第三步（路由）：新建路由目录** — `apps/web/src/app/math/ny/N/` 下的全部页面文件
5. **第四步：在数学入口页注册卡片** — `apps/web/src/app/math/page.tsx` 的 `courses` 数组最前面
6. **第五步：在题海中注册新讲次** — `packages/math/src/utils/sea-data.ts`
7. **第六步：在每日计划页注册新讲次** — 两个文件必须同步更新
8. **第七步：在综合组卷页注册新讲次** — 三个文件必须同步更新

## 完成后

对照 `docs/add-new-lesson.md` 末尾的**快速检查清单**，逐项确认所有文件已创建/更新，无遗漏。

## 用户提供的补充信息

$ARGUMENTS
