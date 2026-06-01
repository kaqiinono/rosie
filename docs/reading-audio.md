# 阅读课文音频（Supabase）

课文朗读存放在 **Supabase Storage**（bucket `reading`），元数据在表 `reading_passage_media`。应用内不经过 `public/`。

## 一次性配置

在 Supabase SQL Editor 执行：

```
docs/reading-audio-tables.sql
```

## 为某篇课文添加音频

**推荐：应用内上传**

1. 打开 **阅读课文** 列表页
2. 点该篇标题旁的 **🎙️**（仅在没有音频时显示）
3. 选择 mp3 / m4a 等文件 → 自动上传到 Supabase（同路径覆盖）

上传成功后会出现 🔊 播放按钮。

`passage_key` 与 `reading-data.ts` 中的 `key` 一致（如 `u5l2`），Storage 路径为 `passages/u5l2/narration.mp3`。

**备选：Supabase 控制台**

1. Storage → bucket `reading` → `passages/u5l2/narration.mp3`
2. 表 `reading_passage_media` 插入对应行（见 `reading-audio-tables.sql`）

## 应用内行为

| 页面 | 按钮 |
|------|------|
| 课文列表 | 🔊 循环播放；再点暂停；同时只会有一篇在播 |
| 课文详情 | 🔊 播放一遍，结束自动停；再点从头播 |

无 `reading_passage_media` 记录的课文不显示按钮。
