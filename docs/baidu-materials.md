# 共享物料与百度网盘

共享物料入口 `/materials`；旧 `/tasks/materials` 是个人材料/录音，不能因升级自动公开。登录用户共享查看/上传资产，课程关联按用户隔离；删除关联不删除资产或网盘文件，创作者/管理员维护元数据与归档。替换内容创建新版本，旧任务引用保持可读。

服务端使用现有 BAIDU_APP_KEY、BAIDU_SECRET_KEY、BAIDU_REDIRECT_URI、SUPABASE_SERVICE_ROLE_KEY 和管理员主账号 OAuth 凭据；这些均不得 NEXT_PUBLIC。授权管理见 `/admin/sync` 与 `docs/baidu-oauth.md`。物料根目录由服务端路径策略约束；客户端只提交相对目录，拒绝越界与任意远端 URL。

## 扫描与关联

`POST /api/materials/baidu/scan` 创建扫描；`GET /api/materials/baidu/scan/[id]` 恢复/读取有版本的分页结果。状态服务端持久化，界面保留扫描号。每页最多 100 条/120KiB，恢复 envelope 上限128KiB，稳定 account/fs identity；文件名仅作候选，确认前不自动关联课程。确认调用 material_link_course，范围必须来自真实目录稳定 key。分页未完/失败不归档“没看到”的文件；并发移动导致即使完整遍历也不证明缺失。

## 上传与交付

`POST /api/materials/uploads` 初始化 durable 会话，随后 prepare、`parts/[part]` 原始分片、complete；`GET /uploads/[id]` 恢复状态，取消后可重新开始。客户端 Worker 先算完整有序 MD5；原始分片4MiB，最多两路。服务端校验总大小、manifest、块 hash、偏移、身份与账户。未知 prepare/create 只验证，不盲目重发合并；未确认时明确取消重开。只有 provider 文件验证完成才成为 ready asset，可选课程关联。

`POST /api/materials/session` 建立限定 HttpOnly 会话；`GET /api/materials/[id]/access` 给出认证交付入口，`content` 每次验证用户并流式支持 Range。被动安全 MIME 可预览，其余 attachment；不透出 provider token/redirect，不把大文件先读成 blob。响应 no-store，SW 排除物料 session/access/content 与上传 API。不要把私人 task-audio 的授权策略换成共享策略。

物料 selector 是 none/explicit/auto；绑定覆盖在任务创建/显式内容修订时冻结。缺物料保留原预计分钟并显示 pending，不隐藏任务。补充关联可刷新待处理任务并增加版本；不清空完成历史或用后来的绑定覆盖旧任务内容。

## 排错与恢复（上线尚待授权）

账户切换、授权失效显示 account_mismatch/unavailable；管理员重新授权后重新扫描/确认，不能沿用旧账户的 fs identity。扫描继续使用保存的会话/版本；上传恢复前重新验证原文件及 manifest，不可默默上传另一文件。归档资产不破坏旧引用，但不允许新选用。无权限/不存在均不泄漏他人链接。

本地已覆盖扫描分页、恢复、原始分片、验证、流式与 SW 协议的合成 provider/SQL 测试。尚未运行真实网盘目录写入或上传，没有真实 app 权限、部署链路、吞吐与断网大文件证明；上线后须使用获授权测试目录演练并记录文件身份、hash、恢复与取消结果，严禁以本地 fixture 声称已安装或可用。
