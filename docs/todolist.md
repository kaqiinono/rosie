# Todo List

## 待办事项

### 1. 在 Supabase 创建 `weekly_plans` 表

在 Supabase Dashboard → SQL Editor 中执行以下 SQL：

```sql
CREATE TABLE weekly_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  week_start DATE NOT NULL,
  unit TEXT NOT NULL,
  lesson TEXT NOT NULL,
  plan_data JSONB NOT NULL,
  progress_data JSONB DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);
```
