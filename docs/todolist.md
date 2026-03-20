# 待办事项

## Supabase 建表（手动执行）

在 Supabase SQL 编辑器中执行以下语句：

```sql
-- 数学周计划表
CREATE TABLE math_weekly_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  week_start DATE NOT NULL,
  lesson_id TEXT NOT NULL,
  plan_data JSONB NOT NULL,
  progress_data JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- 题目 Ebbinghaus 掌握度表
CREATE TABLE problem_mastery (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  problem_key TEXT NOT NULL,
  correct INTEGER DEFAULT 0,
  incorrect INTEGER DEFAULT 0,
  last_seen TEXT,
  stage INTEGER,
  next_review_date DATE,
  is_hard BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, problem_key)
);
```

## 代码提交

完成测试后手动 git commit + push。

## 验收测试

- [ ] 选 Lesson 36，生成 7 天计划，Day 1 应有 36-L1/L2/L3
- [ ] 点题目 → 跳转对应做题页 → 返回 → 自动勾选已做
- [ ] 有 Lesson 35 旧计划时，Lesson 36 计划的 Day 1 含 35 的旧题（若 nextReviewDate <= 今天）
- [ ] 做对复习题后 problem_mastery.stage 应 +1
- [ ] `/today` 同时展示今天数学题 + 英语单词进度
- [ ] 首页出现「今日计划」卡片，点击进入 `/today`
