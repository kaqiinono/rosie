# @rosie/robot

机器人模块：果果的 AI 魔法学习顾问。Dify 编排的对话机器人（见 `docs/robot/dify.md`），
本仓库负责持久化与管理界面。

## DAG 位置
`robot → core, ui`（后续 sub-project D 再加 `→ rewards`）。robot 是叶子学科模块，
只被 `apps/web` 的 route shell 引用，绝不被 core/ui/rewards 反向依赖。

## 当前范围（Sub-project A）
- `robot_tasks` 表（`docs/robot/robot-tasks.sql`），按用户隔离，复合主键 `(user_id, id)`。
- `useRobotTasks(user)`：Supabase 直连的 per-row CRUD（add/update/delete/reorder/complete/refresh）。
- `/admin/robot` 管理页（`RobotTaskManager`）：增删改查，状态只读派生。

## 状态模型（关键）
状态**不入库**，由 `deriveStatus(task, now)` 派生：
`completed_at` → 已完成；`now < start` → 未开始；`start ≤ now ≤ end` → 进行中；否则已过期。
完成（写 `completed_at`）只由打卡页触发（sub-project D）。这是对 Dify 文档中
命令驱动状态机（READY/LEARNING/COMPLETED）的有意改造。

## 待办（后续 sub-project）
- B：`/api/robot` 调 Dify + stage 状态机；快照边界把派生状态映射回 Dify 枚举。
- C：果果端语音/对话 UI（`/robot`）。
- D：打卡页完成 → `completeTask` + 金币入账 `star_sessions`（`source:'robot'`）。
