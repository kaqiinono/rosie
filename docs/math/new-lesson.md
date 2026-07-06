# 新讲次题目源（按讲次拆分）

> 这是「待录入讲次」的题目原文目录。**每个讲次一个文件**，放在 `docs/math/lessons/N.md`，
> 这样 `/add-lesson N` 只需读取目标讲次那一个文件，不必读全部，省 token。

## 约定

- 每讲一个文件：`docs/math/lessons/46.md`、`docs/math/lessons/47.md` …（文件名 = **内部讲次 id**，全局唯一）
- 文件内结构遵循 [`new-lesson-template.md`](new-lesson-template.md)：
  `# 第N讲 标题` + **年级说明（可选）** + `## summary` / `## 课前测` / …
- **年级**：在标题下用 blockquote 写明 `年级：1` 或 `年级：2` 等（可选）。**未写时默认 `highestGrade()`（当前最高年级）**；生成时写入 `lesson-grade.ts` 的 `LESSON_GRADE`；
  一年级 `lectureNum` 用真实教材讲次号；二年级起用年级内「第 1 讲」起（见 `registration.md` 第四步）
- 无对应内容的章节：留空、删除，或写「（未找到对应文件）」——生成时该模块设为 `[]` 或不创建
- 题目正文可内联图形/交互组件 tsx（`<ShulianGrid .../>` 等），处理规则见 `docs/add-new-lesson/figures.md`

> 新增一讲：在 `docs/math/lessons/` 下新建 `N.md`，按模板填入题目（建议写明年级），然后跑 `/add-lesson N`。
> **操作说明（准备什么、文字题/图片题怎么交）：** [`how-to-add-lesson.md`](how-to-add-lesson.md)  
> 完整生成流程（技术索引）：[`docs/add-new-lesson.md`](../add-new-lesson.md)。
