├──────────────┼───────────────────────────────┤                                                                                                                        │
│ │ 1            │ max(1, 1) = 1                 │                                                                                                                        │
│ ├──────────────┼───────────────────────────────┤                                                                                                                        │
│ │ 0（休息日）  │ max(1, 2) = 2                 │                                                                                                                        │
│ └──────────────┴───────────────────────────────┘                                                                                                                        │
│                                                                                                                                                                         │
│ 艾宾浩斯复习与旋转复习的关系                                                                                                                                            │
│                                                                                                                                                                         │
│ 当前代码为互斥逻辑（ternary）：                                                                                                                                         │
│ - 有旋转复习数据（lesson 36+）→ 显示旋转复习，不显示艾宾浩斯                                                                                                            │
│ - 无旋转复习数据（lesson 35，无旧讲）→ 显示艾宾浩斯（0～maxCount=5 道）                                                                                                 │
│                                                                                                                                                                         │
│ 各场景每日最多题量                                                                                                                                                      │
│                                                                                                                                                                         │
│ ┌──────────────────────┬──────┬──────────┬─────────────────┬────────────────┬──────┐                                                                                    │
│ │         场景         │ 必做 │ 旋转复习 │    艾宾浩斯     │ 本周旧讲（新） │ 合计 │                                                                                    │
│ ├──────────────────────┼──────┼──────────┼─────────────────┼────────────────┼──────┤                                                                                    │
│ │ 有旧讲的普通天（满） │ 2    │ 1        │ 0（被旋转压制） │ 1              │ 4    │                                                                                    │
│ ├──────────────────────┼──────┼──────────┼─────────────────┼────────────────┼──────┤                                                                                    │
│ │ 有旧讲的休息天       │ 0    │ 2        │ 0               │ 1              │ 3    │                                                                                    │
│ ├──────────────────────┼──────┼──────────┼─────────────────┼────────────────┼──────┤                                                                                    │
│ │ 无旧讲（lesson 35）  │ 2    │ 0        │ 0～5            │ 0（无旧讲）    │ 2～7 │                                                                                    │
│ └──────────────────────┴──────┴──────────┴─────────────────┴────────────────┴──────┘                                                                                    │
│                                                                                                                                                                         │
│ 结论：                                                                                                                                                                  │
│ - 最常见场景（lesson 36+，有旧讲）：4 题/天，非常可控                                                                                                                   │
│ - 最坏情况（lesson 35，艾宾浩斯 full due）：7 题/天，可通过限制 maxCount 缓解                                                                                           │
│ - 若将来改为艾宾浩斯与旋转复习同时显示，需引入每日总复习上限                                                                                                            │
│                                                                                                                                                                         │
│ 建议干预措施                                                                                                                                                            │
│                                                                                                                                                                         │
│ 1. getMathReviewProblemsForDay 中 maxCount 从 5 降到 2（可在 setup 面板配置）                                                                                           │
│ 2. 每日总复习上限（optional 设置，默认不限）：超出上限的题灰显为"已达上限"                                                                                              │
│ 3. 「跳过今日」按钮：每道本周旧讲题可跳过，不计入 reviewCount，下次还会被选到                                                                                           │
│ 4. 「本周暂停」开关：整个「本周旧讲」section 可在 setup 面板关闭                                                                                                        │
│                                                                                                                                                                         │
│ ---                                                                                                                                                                     │
│ 二、本周旧讲选题算法（核心设计）                                                                                                                                        │
│                                                                                                                                                                         │
│ 逻辑                                                                                                                                                                    │
│                                                                                                                                                                         │
│ 每次需要为某天分配题目时，执行以下流程：                                                                                                                                │
│                                                                                                                                                                         │
│ 从当前指针 pointer（初始 = currentLessonId - 1 对应的第一个可用旧讲）开始向前扫：                                                                                       │
│                                                                                                                                                                         │
│ while true:                                                                                                                                                             │
│   lessonId = pointer 指向的讲次                                                                                                                                         │
│   if lessonId 不存在（已超出全部旧讲）:                                                                                                                                 │
│     wrap around → pointer 重置到最近旧讲，进入第二轮                                                                                                                    │
│   if lessonId 没有题目（problemSets 中为空）:                                                                                                                           │
│     pointer--; continue                   // 跳过无题讲次                                                                                                               │
│   候选题 = 该讲所有题按 reviewCounts[key] 升序                                                                                                                          │
│   if 所有题的 reviewCounts 均 >= 当前最小值 + 1:                                                                                                                        │
│     // 该讲已全覆盖一轮，继续往前找 reviewCounts 更低的讲                                                                                                               │
│     pointer--; continue                                                                                                                                                 │
│   pick = 候选题[0]（reviewCounts 最小的那题）                                                                                                                           │
│   break                                                                                                                                                                 │
│                                                                                                                                                                         │
│ 简化版：在所有旧讲中找 reviewCounts 最小的题，旧讲越近（ID 越大）优先                                                                                                   │
│                                                                                                                                                                         │
│ 具体排序：priorLessons.sort by (min reviewCount in lesson asc, lessonId desc) → 取第一个讲次的第一道题                                                                  │
│                                                                                                                                                                         │
│ 这样保证：                                                                                                                                                              │
│ - 先从最近旧讲开始覆盖                                                                                                                                                  │
│ - 一讲所有题都练了一遍后，才轮到更早的讲                                                                                                                                │
│ - 无题讲次直接跳过                                                                                                                                                      │
│                                                                                                                                                                         │
│ 指针状态                                                                                                                                                                │
│                                                                                                                                                                         │
│ 无需维护显式 pointer，每次直接计算即可（纯函数）：                                                                                                                      │
│                                                                                                                                                                         │
│ export function pickWeeklyLessonProblem(                                                                                                                                │
│   priorLessonProbs: Record<string, MathPlanProblem[]>,  // lessonId -> problems                                                                                         │
│   reviewCounts: Record<string, number>,                  // problemKey -> count                                                                                         │
│ ): { lessonId: string; problem: MathPlanProblem } | null                                                                                                                │
│                                                                                                                                                                         │
│ 算法：                                                                                                                                                                  │
│ 1. 遍历所有 lessonId（降序，最近优先）                                                                                                                                  │
│ 2. 对每个 lessonId，找到 min(reviewCounts[p.key] ?? 0) 最小的题                                                                                                         │
│ 3. 选 (minCount, lessonId降序) 字典序最小的 → 即 minCount 最小、同 minCount 时最近讲                                                                                    │
│ 4. 返回该题                                                                                                                                                             │
│                                                                                                                                                                         │
│ ---                                                                                                                                                                     │
│ 三、数据结构                                                                                                                                                            │
│                                                                                                                                                                         │
│ 新增类型（src/utils/type.ts）                                                                                                                                           │
│                                                                                                                                                                         │
│ export interface MathWeeklyLessonReviewState {                                                                                                                          │
│   planLessonId: string                    // 绑定当前讲，换讲时重置                                                                                                     │
│   reviewCounts: Record<string, number>    // problemKey → 被「本周旧讲」选中的次数                                                                                      │
│   dailyAssignments: Record<string, string>  // date → problemKey（每天1题）                                                                                             │
│   dailyDoneKeys: Record<string, string[]>   // date → 已完成 keys                                                                                                       │
│   dailySkipped: Record<string, true>        // date → 已跳过                                                                                                            │
│ }                                                                                                                                                                       │
│                                                                                                                                                                         │
│ 新增常量（src/utils/constant.ts）                                                                                                                                       │
│                                                                                                                                                                         │
│ + MATH_WEEKLY_LESSON_REVIEW: 'rosie-math-weekly-lesson-review',                                                                                                         │
│                                                                                                                                                                         │
│ ---                                                                                                                                                                     │
│ 四、核心函数（src/utils/math-helpers.ts 新增）                                                                                                                          │
│                                                                                                                                                                         │
│ /**                                                                                                                                                                     │
│  * 从所有旧讲中选出 reviewCount 最小的一道题（最近讲优先）                                                                                                              │
│  * 跳过无题讲次；所有题都已覆盖时 wrap around 从 count+1 的题开始                                                                                                       │
│  */                                                                                                                                                                     │
│ export function pickWeeklyLessonProblem(                                                                                                                                │
│   priorLessonProbs: Record<string, MathPlanProblem[]>,                                                                                                                  │
│   reviewCounts: Record<string, number>,                                                                                                                                 │
│ ): { lessonId: string; problem: MathPlanProblem } | null                                                                                                                │
│                                                                                                                                                                         │
│ ---                                                                                                                                                                     │
│ 五、新 Hook（src/hooks/useMathWeeklyLessonReview.ts）                                                                                                                   │
│                                                                                                                                                                         │
│ export function useMathWeeklyLessonReview(                                                                                                                              │
│   user: User | null,                                                                                                                                                    │
│   activeLessonId: string,                                                                                                                                               │
│   selectedDate: string | null,                                                                                                                                          │
│   priorLessonProbs: Record<string, MathPlanProblem[]>,                                                                                                                  │
│   solveCount: Record<string, number>,                                                                                                                                   │
│ ): {                                                                                                                                                                    │
│   todayProblem: MathPlanProblem | null                                                                                                                                  │
│   todayLessonId: string | null                                                                                                                                          │
│   reviewCounts: Record<string, number>     // 用于 UI 显示各题练习次数                                                                                                  │
│   isDone: boolean                                                                                                                                                       │
│   isSkipped: boolean                                                                                                                                                    │
│   markDone: (key: string) => void                                                                                                                                       │
│   markSkipped: () => void                                                                                                                                               │
│ }                                                                                                                                                                       │
│                                                                                                                                                                         │
│ 逻辑：                                                                                                                                                                  │
│ - selectedDate 首次出现且未分配时：调用 pickWeeklyLessonProblem，存入 dailyAssignments                                                                                  │
│ - markDone 时：reviewCounts[key]++（此时才累加，不是选题时）                                                                                                            │
│ - markSkipped 时：dailySkipped[date] = true，不递增 reviewCounts                                                                                                        │
│ - 存储：localStorage + Supabase（math_weekly_lesson_review 表）                                                                                                         │
│ - 换讲（activeLessonId 变化）时重置整个 state                                                                                                                           │
│                                                                                                                                                                         │
│ ---                                                                                                                                                                     │
│ 六、UI 变更（MathWeeklyPractice.tsx）                                                                                                                                   │
│                                                                                                                                                                         │
│ 新 Section（位于旧讲回顾之后）                                                                                                                                          │
│                                                                                                                                                                         │
│ 📅 本周旧讲  ·  第35讲  ·  已覆盖 3/12 题                                                                                                                               │
│ ┌──────────────────────────────────────────────┐                                                                                                                        │
│ │  [📖 课堂 第3题]  练习×1           [跳过]    │                                                                                                                        │
│ └──────────────────────────────────────────────┘                                                                                                                        │
│                                                                                                                                                                         │
│ - 只在 priorLessonProbs 非空时显示                                                                                                                                      │
│ - 已覆盖 N/Total：该讲中 reviewCounts > 0 的题数                                                                                                                        │
│ - 题卡右上角显示 ×N 徽章（当 reviewCount > 0 时）                                                                                                                       │
│ - 「跳过」按钮：触发 markSkipped()                                                                                                                                      │
│                                                                                                                                                                         │
│ setup 面板新增（可选配置）                                                                                                                                              │
│                                                                                                                                                                         │
│ 艾宾浩斯每日上限：[1] [2] [3] [5]   // 对应 getMathReviewProblemsForDay maxCount                                                                                        │
│ 本周旧讲复习：[开启] [关闭]                                                                                                                                             │
│                                                                                                                                                                         │
│ ---                                                                                                                                                                     │
│ 七、文件清单                                                                                                                                                            │
│                                                                                                                                                                         │
│ ┌────────────────────────────────────────────┬──────────────────────────────────────────┐                                                                               │
│ │                    文件                    │                   改动                   │                                                                               │
│ ├────────────────────────────────────────────┼──────────────────────────────────────────┤                                                                               │
│ │ src/utils/type.ts                          │ 新增 MathWeeklyLessonReviewState         │                                                                               │
│ ├────────────────────────────────────────────┼──────────────────────────────────────────┤                                                                               │
│ │ src/utils/constant.ts                      │ 新增 MATH_WEEKLY_LESSON_REVIEW key       │                                                                               │
│ ├────────────────────────────────────────────┼──────────────────────────────────────────┤                                                                               │
│ │ src/utils/math-helpers.ts                  │ 新增 pickWeeklyLessonProblem             │                                                                               │
│ ├────────────────────────────────────────────┼──────────────────────────────────────────┤                                                                               │
│ │ src/hooks/useMathWeeklyLessonReview.ts     │ 新建文件                                 │                                                                               │
│ ├────────────────────────────────────────────┼──────────────────────────────────────────┤                                                                               │
│ │ src/components/math/MathWeeklyPractice.tsx │ 集成 hook、新增 section、新增 setup 选项 │                                                                               │
│ └────────────────────────────────────────────┴──────────────────────────────────────────┘                                                                               │
│                                                                                                                                                                         │
│ ---                                                                                                                                                                     │
│ 八、验证                                                                                                                                                                │
│                                                                                                                                                                         │
│ 1. 打开 /math/ny/daily，选 lesson 36 计划（有旧讲 lesson 35）                                                                                                           │
│ 2. 查看"本周旧讲" section：应显示 lesson 35 中 reviewCount 最少的那道题                                                                                                 │
│ 3. 完成该题后 reviewCount 递增；下一天应选另一道（或同讲 count 仍最小的题）                                                                                             │
│ 4. 点击"跳过"：reviewCount 不变，下次仍有机会被选中                                                                                                                     │
│ 5. 等 lesson 35 所有题 reviewCount ≥ 1 后，再查看下一天：应仍选 lesson 35 但从 count=1 的题开始（no wrap-around to another lesson since it's the only prior lesson）    │
│ 6. 添加 lesson 34 数据后，验证 lesson 35 全覆盖后才轮到 lesson 34                                                                                                       │
│ 7. 确认每日合计 ≤ 4 题（有旧讲的满天：2新+1旋转+1本周旧讲）                                                                                                             │
╰─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯

