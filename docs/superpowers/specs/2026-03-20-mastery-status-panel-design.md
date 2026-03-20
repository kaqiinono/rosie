# 词汇学习状态面板 — 设计文档

## 概述

在"每日一练"页面底部嵌入一个可折叠的词汇学习状态面板，让用户（家长）能直观地看到每个词的艾宾浩斯复习进度：阶段、下次复习日期、是否为难词、是否已毕业。

---

## 用户需求

- 当前复习系统对用户来说是黑盒，无法知道每个词处于哪个复习阶段
- 需要一个地方能查看：练习过的词的 stage / nextReviewDate / isHard 状态
- 不需要新页面，嵌在现有的每日一练页面里即可

---

## 范围

**包含：**
- 可折叠面板，嵌在 `WeeklyPractice` 组件底部
- 表格显示所有有 mastery 记录的词
- 列：单词、课程（Unit/Lesson）、阶段、下次复习、状态（难词/毕业）

**不包含：**
- 筛选/搜索功能
- 手动修改 stage 的编辑功能
- 单独页面或新路由

---

## 组件设计

### 位置

`WeeklyPractice.tsx` 底部，在所有练习内容之后渲染 `<MasteryStatusPanel>`。

### `MasteryStatusPanel` 组件

文件：`src/components/english/words/MasteryStatusPanel.tsx`

Props：
```typescript
interface MasteryStatusPanelProps {
  vocab: WordEntry[]
  masteryMap: WordMasteryMap
}
```

内部逻辑：
1. 过滤 vocab，只保留 `masteryMap[wordKey(w)]` 存在的词
2. 对每个词调用 `ensureStageInit(m, today)` 确保有 stage 数据
3. 按 `nextReviewDate` 升序排列（无日期的毕业词排最后）
4. 用 `useState` 控制折叠状态，默认 `false`（折叠）

### 表格列

| 列 | 内容 | 排序依据 |
|----|------|---------|
| 单词 | `entry.word` | — |
| 课程 | `U{unit} L{lesson}` | — |
| 阶段 | `MASTERY_ICON[level]` + stage 数字 | — |
| 下次复习 | 相对天数（今天/明天/N天后/—） | 升序主排序 |
| 状态 | 🔥 难 / ✓ 毕业 / — | — |

### 标题栏（折叠时可见）

- 左侧：`📊 词汇学习状态` + 总词数徽章
- 右侧：难词数徽章（红）+ 毕业数徽章（绿）+ 展开/收起箭头

### 视觉样式

- 下次复习"今天"：红色徽章 (`#ef4444`)
- 下次复习"明天"：橙色徽章 (`#f97316`)
- 下次复习更远：灰色文字
- 已毕业行：整体 `opacity: 0.6`，文字绿色
- 整体延续 `WeeklyPractice` 的暗色主题（`var(--wm-*)` CSS 变量）

---

## 数据流

```
WeeklyPractice
  └─ useWordMastery(user)  →  masteryMap
  └─ <MasteryStatusPanel vocab={vocab} masteryMap={masteryMap} />
       └─ ensureStageInit() per word
       └─ isGraduated() per word
       └─ 渲染表格
```

`MasteryStatusPanel` 纯展示组件，不写入任何状态。

---

## 实现步骤

1. 新建 `src/components/english/words/MasteryStatusPanel.tsx`
2. 在 `WeeklyPractice.tsx` 中引入并渲染，传入 `vocab` 和 `masteryMap`

---

## 验证

- 完成一次练习后，打开面板能看到对应词的 stage 和 nextReviewDate
- 难词显示 🔥，毕业词显示 ✓ 且降透明度
- 折叠/展开切换正常
- 未练习过的词不出现在表格中
