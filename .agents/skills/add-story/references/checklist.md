# 导入与验收清单

## 来源完整性

- [ ] 已区分用户指令、版权/出版页、目录、广告与故事正文。
- [ ] 已记录 PDF 总页数、正文起止页，并核对正文前一页和后一页，未悄悄丢失前后页。
- [ ] Series 名、Volume 名/编号、作者、章节数均来自材料；章节标题、编号和顺序逐页核对。
- [ ] 每章开头、结尾及跨页句子均与渲染页一致；未把目录中的重复标题当正文。
- [ ] 已列出 OCR 修正（原文片段 → 修正后片段 → 页码/理由）；不确定文字未自行编造。

## 内容与词汇审计

- [ ] 只包含故事正文；没有教材 Unit/Lesson、教材词表、练习、语法、写作、周计划、前测或段落回想。
- [ ] slug、volume number、chapter key/number 均唯一稳定，段落边界自然。
- [ ] 已报告每章段落数、英文词数和全书合计；章节数与来源一致。
- [ ] 已用完整运行时 `word_entries` 语义审计匹配；每章仅传实际命中的去重词条。
- [ ] 已报告每章/全书词库命中词条数，抽检词形与多词短语匹配。
- [ ] 已输出未命中候选审计；只将确需解释的词加入对应章节 glossary，并记录排除普通词的取舍。
- [ ] 词库卡显示 `(stage, unit, lesson)` 与 `(volume, chapter)`；glossary 点击卡可用。

## 阅读交互

- [ ] sticky「本章难点词」在章节和整辑模式均识别视口当前章。
- [ ] 难点词以 fixed/modal 展示，滚至底部仍可用，含上一张/下一张/发音/中英文释义。
- [ ] 阅读正文没有合成分页；句子 ID 稳定且唯一。
- [ ] 用户主动保存的是视口第一句和最后一句完整句；恢复首句对齐 sticky header 下方。
- [ ] 整辑模式跨章节保存/恢复正确，末句使用自己的章节局部 index。

## 录音与数据安全

- [ ] 录音按钮位于每章标题最右侧；无整辑录音入口。
- [ ] 每章可追加多个片段且不覆盖；显示数量，每条可播放、下载、删除。
- [ ] 压缩调用 `@rosie/player`，目标为 mono 32 kHz / 64 kbps MP3；失败时保存真实原 MIME/扩展名。
- [ ] 下载扩展名由数据库保存的 MIME 决定，不由显示名硬编码。
- [ ] 录音 bucket 非 public；对象路径以用户 ID 隔离；播放/下载用 signed URL。
- [ ] 数据库仅通过迁移修改；表启用 RLS，SELECT/INSERT/UPDATE/DELETE 都校验 owner，UPDATE 同时有 `USING` 与 `WITH CHECK`。
- [ ] Storage policies 覆盖实际操作（upsert 需要 SELECT/INSERT/UPDATE），并限制 bucket 与首级用户目录。

## 集成与验证

- [ ] Story 数据已注册并从 English barrel 可达；reading 首页 story shelf 能进入 Series → Volume → Chapter/full。
- [ ] 新路由 breadcrumb 已补齐；AI catalog 按当前架构包含每章且 href/sourceRef 唯一。
- [ ] 架构/流程变化已更新 `packages/english/AGENTS.md`；纯数据新增未制造无关文档变更。
- [ ] 新增分辑的专项 Vitest 覆盖层级、章节数量/顺序/标题、正文排除、稳定锚点及必要录音键规则。
- [ ] `pnpm --filter @rosie/english typecheck` 通过。
- [ ] `pnpm exec eslint <新增或修改的 Story 文件>` 通过。
- [ ] `pnpm exec vitest run apps/web/tests/english-story-reading.test.ts` 通过。
- [ ] `git diff --check` 通过；已复核状态和目标 diff，没有覆盖用户修改。
- [ ] 未经用户明确授权未运行生产 build，且最终报告明确说明。
