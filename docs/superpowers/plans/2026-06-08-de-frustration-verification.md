# 去挫败感交互 — Task 19 端到端验证清单

> 对应 plan `2026-06-08-de-frustration.md` 的 **Task 19**。实现（Task 0–18）已全部提交。
> 本清单逐项手动验证；**全部勾选通过**后再走 `finishing-a-development-branch`（merge/PR/cleanup）。
>
> 验证环境：`pnpm dev`（localStorage / Service Worker 行为见 CLAUDE.md；如需测离线再切 `pnpm start`）。
> 入口：登录 → 英语 → 周计划 session（`/english/words/weekly/...`）。

---

## 0. 构建健康（先跑，红的就别往下测了）

- [ ] `pnpm lint` 无类型错误
- [ ] `pnpm build` 无 TypeScript 错误

---

## 1. 基本三阶段（spec §2 / §9.3）

- [x] 主轮答错一次 → 弹出**蓝色** retry 文案条（`💡 差一点点…` 类），错选项淡出置灰、不可再点
- [ ] retry 后答对 → 该词以**蓝标**加入「拯救清单」横条（待巩固/半对）
  * 没有看到拯救清单横条
- [ ] retry 也答错（连错两次）→ 播放**怪兽吃单词**弹层，完整时长约 **2.4s**，飞字进嘴 + 嘴开合 + 文案 + OK 按钮
  - 单选题选错两次，没有看到怪兽吃单词，应该将本题的单词吃到怪兽嘴里吧？
- [ ] 怪兽弹层「⚔️ 知道啦，继续闯关！」按钮关闭后，该词以**橙标**加入清单
  - 没有这个
- [ ] 同一 session **第二次**被吃 → 怪兽弹层缩短到约 **1.2s**（abbreviated）
  - 没有这个

## 2. 阶梯补练（spec §3 / §7）

没有出现阶梯补练

- [ ] 主轮结束后进入补练：先出**闪现卡**，约 **1.5s** 自动过，且**有英文语音**播报
- [ ] 闪现卡之后 → **A 类**（识别桥）补考
- [ ] A 类对 → **原题型**再考
- [ ] 阶梯全对 → 清单该 chip 变**绿 💚**，完成页「拯救成果」列为**救回**
- [ ] 阶梯中途答错 → **跳过剩余阶梯**，清单 chip 变**灰 🌙**，完成页列为**未救回**
- [ ] 点闪现卡可提前跳过（≈0.5s），且**不会**触发重复 advance / 跳两题

## 3. SpellTiles retry + revealedHalf（spec §9 / Task 13）

- [ ] 故意拼错 → **放错位置**的字母软抖 + 黄色(`#FBBF24`)闪 → **飞回备选区**
- [ ] **放对位置**的字母变**绿色**并固定不可拖
- [ ] retry 态显示黄色文案「💡 差几个字母~…」，**不再**出现「✗ 错误，正确答案：word」
- [ ] 第二次拼对 → 显示「✓ 正确！🎉」，该词按**半对（蓝标）**入队
- [ ] C 类补练题 `revealedHalf` 生效：前一半字母**预填且不可拖**

## 4. 阅读模块（spec §12 / Task 17–18）

- [ ] **RecallQuizStack**：错一次显示「🔮 这个不对，看看别的？」；错两次显示「🌟 这个是 X！记一下~」
- [ ] **ParagraphRecallQuiz**：同上两段文案行为一致
- [ ] 错选项淡出灰禁（与主 quiz 风格一致）
- [ ] 阅读模块**无**怪兽弹层、**无**拯救清单条（轻量 retry，不接队列）

## 5. localStorage（spec §11 / Task 14）

- [ ] 主轮中段**刷新页面** → 拯救清单条恢复显示（`rescue_queue_v1` 复原）
- [ ] 完成页点「返回」离开 → DevTools 中 `localStorage['rescue_queue_v1']` **已清除**
- [ ] 切换 `selectedDate`（换一天）→ 队列清空，不串味
- [ ] 控制台核对：`localStorage.getItem('rescue_queue_v1')`（session 中）含正确 `planId` / `dateKey` / `items`

## 6. 去红化 + mastery 写入（spec §8 / §10）

- [ ] 整个 session **无 ❌、无 ✗、无红色边框、无刺耳错误音**
- [ ] mastery 写入与 spec §8 表格一致（查 Supabase `word_mastery`）：
  - [ ] 半对救回（consolidated/saved）→ 1 correct + 1 wrong
  - [ ] still_half → 1 wrong
  - [ ] lost → 2 wrong
  - [ ] 未进队列的主轮原题 → 按 finalCorrect 写 1 条
  - [ ] 补练题 / 闪现卡 → **不**单独写 mastery（已并入对应词）

## 7. prefers-reduced-motion（spec §9）

- [ ] 系统开启「减少动效」→ 怪兽弹层缩到约 **0.6s** 简化版，无大幅飞字/缩放

---

## 收尾

- [ ] 以上全部通过
- [ ] 有问题已逐条修复并重测
- [ ] 在 plan 文件 Task 19 勾选完成
- [ ] 执行 `finishing-a-development-branch` 决定 merge / PR / cleanup

> 发现问题就记在这里（行号/复现步骤/期望 vs 实际），我来逐条修：
>
> -
