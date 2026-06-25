# 🍎 果果的 AI 魔法学习顾问 - Dify Chatflow 终版编排文档

> **核心架构原则**：Python 管状态与业务逻辑，LLM 管语言表达，Vercel 管持久化。三者职责严格解耦，互不越界。
>
> **终版说明**：在 V2 架构基础上，修复了"降级结算复现 v1 bug、#task 伪任务混入 Dify、LLM 直注原始 JSON、speech_text 无兜底"四处遗留问题，并合并了 v2.0 的 `tasks_summary` 优化。

---

## 🗺️ 1. 画布拓扑总览

```
[START] ➔ [状态机控制器 CODE] ➔ [LLM] ➔ [JSON序列化安全阀 CODE] ➔ [ANSWER]
```

**相比原始 V1 的核心升级点**：

- 新增后置「JSON 序列化安全阀」节点，彻底根治 LLM 文本污染 JSON 结构的偶发崩溃
- Python 状态机修复全部 9 处逻辑漏洞
- LLM 注入 `tasks_summary` 自然语言摘要而非原始 JSON，质量更高且节省 token
- `hardware_cmd` 全面枚举化，ANSWER 节点单变量透传

---

## 🛠️ 2. 节点详解与接口契约

### 1️⃣ 节点一：开始 / START

**业务职责**：接收 Vercel 应用端传入的请求，承载果果当前的完整数据库快照。

**输入变量配置**：

| 变量名 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `query` | String | ✅ | 果果或家长说的话 |
| `current_coins` | Number | ✅ | 数据库中果果当前累计总金币数 |
| `current_stage` | String | ✅ | 当前阶段状态：`IDLE` / `READY` / `LEARNING` / `BREAK` |
| `current_tasks` | Object | ✅ | 当前结构化任务列表（见下方 Schema） |

**`current_tasks` JSON Schema**：

```json
{
  "type": "object",
  "required": ["tasks"],
  "properties": {
    "tasks": {
      "type": "array",
      "description": "果果当前在数据库中的结构化任务列表",
      "items": {
        "type": "object",
        "required": ["id", "title", "content", "start_time", "end_time", "status", "reward_coins", "quick_link"],
        "properties": {
          "id": {
            "type": "string",
            "description": "任务唯一标识符，例如：task_001，用于精确匹配，避免依赖顺序"
          },
          "title": {
            "type": "string",
            "description": "任务标题，例如：写口算题卡"
          },
          "content": {
            "type": "string",
            "description": "任务的具体要求或内容描述"
          },
          "start_time": {
            "type": "string",
            "description": "任务建议开始时间，格式 HH:MM"
          },
          "end_time": {
            "type": "string",
            "description": "任务预期结束时间，格式 HH:MM"
          },
          "status": {
            "type": "string",
            "enum": ["READY", "LEARNING", "COMPLETED"],
            "description": "任务生命周期状态"
          },
          "reward_coins": {
            "type": "integer",
            "description": "完成该任务可获得的金币数量"
          },
          "quick_link": {
            "type": "string",
            "description": "前端跳转到该作业打卡页的快捷相对路径"
          }
        }
      }
    }
  }
}
```

> ⚠️ 相比原始 V1，新增了 `id` 字段。Vercel 侧写库时需同步补充，确保每条任务有唯一 ID。

---

### 2️⃣ 节点二：状态机控制器 / CODE - Python 3

**业务职责**：核心无状态控制器。负责意图识别、状态流转、金币计算，同时生成供 LLM 使用的自然语言任务摘要。

**输入变量映射**：

| 节点变量名 | 映射来源 |
|---|---|
| `query` | `{{开始.query}}` |
| `current_coins` | `{{开始.current_coins}}` |
| `current_stage` | `{{开始.current_stage}}` |
| `current_tasks` | `{{开始.current_tasks.tasks}}` |

**输出变量声明**：

| 变量名 | 类型 | 说明 |
|---|---|---|
| `intent` | String | 意图类型，透传至安全阀 |
| `reward_msg` | String | 系统事件提示，注入 LLM Prompt |
| `tasks_summary` | String | 任务列表自然语言摘要，注入 LLM Prompt |
| `reward_coins_delta` | Number | 本次单次金币增量，透传至安全阀 |
| `hardware_cmd` | String | 硬件指令枚举值，透传至安全阀 |
| `new_stage` | String | 流转后新阶段状态，透传至安全阀 |
| `virtual_total_coins` | Number | 虚拟总金币，仅供 LLM 口头播报，不作持久化依据 |
| `tasks` | Object | 更新后任务列表（含根节点包装），透传至安全阀 |

**Python 3 代码（终版）**：

```python
import json
import copy

def main(query: str, current_coins: int, current_stage: str, current_tasks: list) -> dict:

    # ── 0. 数据防御与初始化 ──────────────────────────────────────────
    try:
        current_coins = max(0, int(current_coins))
    except (ValueError, TypeError):
        current_coins = 0

    # 深拷贝，避免引用污染
    updated_tasks = copy.deepcopy(current_tasks) if isinstance(current_tasks, list) else []

    intent = "chat"
    reward_msg = ""
    reward_coins_delta = 0
    hardware_cmd = "NONE"                                    # 显式枚举，硬件端 switch-case 友好
    new_stage = str(current_stage) if current_stage else "IDLE"
    q = query.strip()

    # ── 1. 家长后台指令：#task ────────────────────────────────────────
    # 职责边界：Dify 只负责 stage 流转和播报提示。
    # 任务数据的增删改完全由 Vercel 侧专用 API 写库管理，
    # Dify 在下一轮对话时会自动从 START 节点接收到已更新的最新任务快照。
    # ❌ 终版删除了 V2 中"#task 伪任务生成"逻辑，防止占位数据（00:00/空链接）被 LLM 读到并播报。
    if q.startswith("#task"):
        intent = "setup_tasks"
        new_stage = "READY"
        reward_msg = "【系统提示：魔力关卡已刷新，新的冒险准备好了！】"
        hardware_cmd = "LED_BLUE"

    # ── 2. 果果汇报完成：严格只结算 LEARNING 状态任务 ────────────────
    elif any(kw in q for kw in ["做完", "搞定", "完成", "写完", "通关", "做好"]):
        completed_task = None

        # 只结算 LEARNING 状态，绝不降级结算 READY。
        # ❌ 终版删除了 V2 中"降级结算 READY 任务"的兜底逻辑。
        # 果果说出含"完成"的话但当前无 LEARNING 任务，大概率是误触发，
        # 直接结算 READY 会造成任务跳过和金币错发，复现 V1 的核心 Bug。
        for task in updated_tasks:
            if task.get("status") == "LEARNING":
                task["status"] = "COMPLETED"
                reward_coins_delta += task.get("reward_coins", 10)
                completed_task = task
                break  # 每次只结算一个，防止批量误触发

        if completed_task:
            intent = "task_complete"
            hardware_cmd = "PLAY_WIN_SOUND"
            remaining = [t for t in updated_tasks if t.get("status") in ["READY", "LEARNING"]]
            # 全部完成回 IDLE，否则进 BREAK 等待下一关
            new_stage = "IDLE" if not remaining else "BREAK"
            reward_msg = (
                f"【系统提示：果果完成了「{completed_task.get('title', '任务')}」！"
                f"金币增发 {reward_coins_delta} 枚！"
                + (f"还有 {len(remaining)} 个关卡待挑战。】" if remaining else "所有关卡全部通关！】")
            )
        else:
            # 无 LEARNING 任务时，明确提示，不做任何状态或金币变更
            intent = "no_active_task"
            reward_msg = "【系统提示：当前没有进行中的魔法任务，请先说「开始」启动关卡哦。】"

    # ── 3. 触发专注计时：只在有 READY 任务时才允许流转 ──────────────
    elif any(kw in q for kw in ["开始", "出发", "挑战", "启动", "冲"]):
        started_task = None
        for task in updated_tasks:
            if task.get("status") == "READY":
                task["status"] = "LEARNING"
                started_task = task
                break

        if started_task:
            intent = "task_start"
            new_stage = "LEARNING"
            hardware_cmd = "TIMER_START_1200"
            reward_msg = (
                f"【系统提示：「{started_task.get('title', '任务')}」魔力屏障已开启，"
                f"专注计时启动！预计 {started_task.get('start_time', '')}–{started_task.get('end_time', '')} 完成。】"
            )
        else:
            # 无 READY 任务时，拒绝流转，防止状态机僵死
            intent = "no_ready_task"
            new_stage = "IDLE" if new_stage == "READY" else new_stage
            reward_msg = "【系统提示：城堡里还没有准备好的魔法任务，快让爸爸妈妈帮你布置吧！】"
            hardware_cmd = "NONE"

    # ── 4. 通用对话兜底 ──────────────────────────────────────────────
    else:
        intent = "chat"

    # ── 5. 虚拟金币（仅供 LLM 本轮播报，不写库）─────────────────────
    virtual_total_coins = current_coins + reward_coins_delta

    # ── 6. 生成任务摘要注入 LLM，避免把原始 JSON 扔给大模型 ──────────
    # ❌ 终版替换了 V2 中直接注入 task_list_json 原始对象的做法，
    # 原始 JSON 对 LLM 阅读体验差且浪费 token。
    def _summarize_tasks(tasks: list) -> str:
        if not tasks:
            return "暂无任务。"
        status_label = {
            "READY": "待开始",
            "LEARNING": "进行中🔥",
            "COMPLETED": "已完成✅"
        }
        lines = []
        for t in tasks:
            label = status_label.get(t.get("status", ""), t.get("status", ""))
            lines.append(
                f"- [{label}] {t.get('title', '未命名')}"
                f"（{t.get('start_time', '')}~{t.get('end_time', '')}，"
                f"奖励 {t.get('reward_coins', 0)} 金币）"
            )
        return "\n".join(lines)

    tasks_summary = _summarize_tasks(updated_tasks)

    return {
        "intent": intent,
        "reward_msg": reward_msg,
        "tasks_summary": tasks_summary,
        "reward_coins_delta": reward_coins_delta,
        "hardware_cmd": hardware_cmd,
        "new_stage": new_stage,
        "virtual_total_coins": virtual_total_coins,
        "tasks": {"tasks": updated_tasks}   # 包装回符合 Dify Schema 约束的 Object 根节点
    }
```

---

### 3️⃣ 节点三：大语言模型 / LLM

**模型**：`qwen-plus` 或 `qwen-max`（阿里百炼平台）

**上下文变量绑定**：

| 变量名 | 映射来源 |
|---|---|
| `query` | `{{开始.query}}` |
| `reward_msg` | `{{状态机控制器.reward_msg}}` |
| `stage` | `{{状态机控制器.new_stage}}` |
| `coins` | `{{状态机控制器.virtual_total_coins}}` |
| `tasks_summary` | `{{状态机控制器.tasks_summary}}` |

**系统提示词（System Prompt）**：

```
# 角色
你是嵌入在智能小机器人里的 AI 魔法顾问，温柔地督促、管理 7 岁女孩"果果"的学习。
语气必须极其温柔、生动、充满童趣，像大姐姐或魔法导师。严禁说教、命令或批评。

# 当前实时状态
果果说的话：{{query}}
系统事件通知：{{reward_msg}}
当前魔力关卡状态：{{stage}}
果果的魔法金币总数：{{coins}} 枚
当前任务列表：
{{tasks_summary}}

# 回复规则（严格遵守）

## 规则一：优先播报系统事件
如果「系统事件通知」不为空，必须第一句用极其夸张和富有童趣的语言向果果播报：
- 获得金币 → 用极其兴奋的语气表扬（例："哇！太棒了！大姐姐刚刚放了 10 个魔法金币进城堡！"）
- 关卡开始 → 用充满期待的语气鼓励专注（例："魔法屏障启动！接下来 20 分钟只属于果果的冒险时间！"）
- 全部完成 → 用最高规格的庆祝语气总结今天成就

## 规则二：结合任务列表精准引导
根据「当前任务列表」，找到「待开始」状态的任务，告诉果果下一步具体做什么，
用充满期待的语气把任务翻译成"魔法关卡"。
例："果果，第一关是写口算题卡，准备好了就说「开始第一关」，我们冲！"

## 规则三：同理心处理疲劳与抵触
如果果果表现出疲劳、不想写，绝对不能责备。
例："果果有点累了对不对？那我们先深呼吸三次，休息一会儿再出发～"

## 规则四：精简输出（最重要）
这是语音交互，果果需要听。每次回答严格控制在 3 句话、50 字以内。
多用"哇""冲呀""大冒险""魔法"等童趣语气词。禁止使用任何 Markdown 格式符号。
```

---

### 4️⃣ 节点四：JSON 序列化安全阀 / CODE - Python 3

**业务职责**：【核心防崩溃卡点】承接 LLM 文本与状态机变量，通过标准 `json.dumps()` 强制序列化，彻底封杀手动拼接 JSON 时因特殊符号、换行、中文引号导致的偶发崩溃。

**输入变量映射**：

| 节点变量名 | 映射来源 |
|---|---|
| `speech_text` | `{{LLM.text}}` |
| `intent` | `{{状态机控制器.intent}}` |
| `reward_coins_delta` | `{{状态机控制器.reward_coins_delta}}` |
| `hardware_cmd` | `{{状态机控制器.hardware_cmd}}` |
| `next_stage` | `{{状态机控制器.new_stage}}` |
| `updated_tasks` | `{{状态机控制器.tasks.tasks}}` |

> ⚠️ **联调注意**：`{{状态机控制器.tasks.tasks}}` 利用 Dify 运行时指针解包，传入的应为数组而非对象。建议联调时打印 `type(updated_tasks)` 确认，若收到的是 `dict` 而非 `list`，说明解包失败，需改为在安全阀内手动取 `updated_tasks.get("tasks", [])`。

**输出变量声明**：

| 变量名 | 类型 | 说明 |
|---|---|---|
| `final_json` | String | 完整序列化的响应体，ANSWER 节点直接透传 |

**Python 3 代码（终版）**：

```python
import json

def main(
    speech_text: str,
    intent: str,
    reward_coins_delta: int,
    hardware_cmd: str,
    next_stage: str,
    updated_tasks: list
) -> dict:

    # ── speech_text 空值兜底：防止 LLM 偶发返回空导致 TTS 播放静音 ──
    # ❌ 终版新增，V2 原版无此防御
    if not speech_text or not speech_text.strip():
        speech_text = "大姐姐刚刚走神了一下，果果再说一遍好吗？"

    # ── updated_tasks 类型兜底：防止解包失败时静默返回空数组 ──────────
    if isinstance(updated_tasks, dict):
        # Dify 运行时指针解包失败时的降级处理
        updated_tasks = updated_tasks.get("tasks", [])
    elif not isinstance(updated_tasks, list):
        updated_tasks = []

    response_payload = {
        "speech_text": speech_text,
        "action": {
            "intent": intent,
            "reward_coins_delta": int(reward_coins_delta) if reward_coins_delta else 0,
            "hardware_cmd": hardware_cmd if hardware_cmd else "NONE",
            "next_stage": next_stage,
            "updated_tasks": updated_tasks
        }
    }

    return {
        "final_json": json.dumps(response_payload, ensure_ascii=False)
    }
```

---

### 5️⃣ 节点五：直接回复 / ANSWER

**业务职责**：标准流出口，单变量透传，零拼接风险。

**回复框内容配置**（填入唯一一行）：

```
{{JSON序列化安全阀.final_json}}
```

---

## 💻 3. Vercel 应用端消费逻辑（Node.js 参考实现）

```javascript
import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  const { guoguo_speech } = await req.json();

  // ── 1. 从数据库读取果果当前持久化快照 ──────────────────────────────
  const { total_coins, stage_status, tasks_array } = await db.getGuoguoData();

  // ── 2. 调用 Dify API ────────────────────────────────────────────────
  const difyRes = await fetch(process.env.DIFY_API_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: {
        current_coins: total_coins,
        current_stage: stage_status,
        current_tasks: { tasks: tasks_array },   // 包装为满足 Dify Schema 的根 Object
      },
      query: guoguo_speech,
      response_mode: "blocking",
      user: "guoguo_7yo",
    }),
  });

  const difyRaw = await difyRes.json();

  // ── 3. 解析响应（安全阀节点保证 answer 必然是合法 JSON）────────────
  let payload;
  try {
    payload = JSON.parse(difyRaw.answer);
  } catch (e) {
    console.error("[Dify] answer parse error:", difyRaw.answer);
    return NextResponse.json({ error: "invalid_dify_response" }, { status: 500 });
  }

  const { speech_text, action } = payload;
  const { reward_coins_delta, next_stage, updated_tasks, hardware_cmd } = action;

  // ── 4. 持久化：原子操作更新金币，避免并发双写竞态 ──────────────────
  // 使用 delta 做数据库原子自增，而非"读出 → 加 → 写回"的非原子操作
  // 对应 SQL：UPDATE users SET coins = coins + $1 WHERE id = $2
  if (reward_coins_delta > 0) {
    await db.incrementCoins(reward_coins_delta);
  }
  await db.saveStageAndTasks(next_stage, updated_tasks);

  // ── 5. 下发 TTS 语音文本 + 硬件指令 ────────────────────────────────
  // hardware_cmd 为显式枚举（NONE / LED_BLUE / PLAY_WIN_SOUND / TIMER_START_1200）
  // 硬件端直接 switch-case，NONE 分支 break 即可，无需额外判空
  return NextResponse.json({
    speech_text,
    hardware_cmd,
  });
}
```

---

## 📐 4. 状态机状态转移图

```
                      #task 指令（Vercel写库后触发）
           ┌─────────────────────────────────────┐
           ▼                                     │
         IDLE  ◄──── 无READY任务时拒绝流转 ────── │
           │                                     │
           │  有READY任务 + 说「开始」             │
           ▼                                     │
         READY                                   │
           │                                     │
           │  说「开始」激活第一个READY任务         │
           ▼                                     │
        LEARNING                                 │
           │                                     │
           │  说「完成」结算LEARNING任务            │
           ▼                                     │
     还有剩余任务？                               │
     ┌─── Yes ────┐                              │
     ▼            ▼                              │
   BREAK        IDLE ────────────────────────────┘
     │
     │  说「开始」继续下一关
     └──────► READY
```

---

## 🔑 5. 终版全量改动速查表

| 模块 | 改动内容 | 来源版本 | 解决的问题 |
|---|---|---|---|
| START Schema | 新增 `id` 字段 | v2.0 | 任务精确匹配，不依赖顺序 |
| CODE - 任务结算 | 严格只结算 `LEARNING`，删除降级结算 `READY` 逻辑 | 终版修复 V2 | 修复复现 V1 金币误发 Bug |
| CODE - 场景3 | 无 `READY` 任务时拒绝流转，`new_stage` 保持不变 | v2.0 | 修复状态机僵死 |
| CODE - 阶段判断 | 结算后检查剩余任务，决定进 `BREAK` 或回 `IDLE` | V2 | 修复全完成后状态错误 |
| CODE - `#task` | 删除伪任务生成逻辑，Dify 只做 stage 流转 | 终版修复 V2 | 防止占位数据被 LLM 播报 |
| CODE - 输出 | 新增 `tasks_summary` 自然语言摘要 | v2.0 | LLM 可感知任务进度，节省 token |
| CODE - `hardware_cmd` | 默认值枚举化为 `"NONE"` | V2 | 硬件端无需判空 |
| LLM Prompt | 注入 `tasks_summary` 替换原始 JSON | 终版修复 V2 | 阅读体验好，token 更省 |
| 安全阀节点（新增） | `json.dumps` 强制序列化整体响应体 | V2 架构 | 根治 ANSWER 偶发 JSON 崩溃 |
| 安全阀 - `speech_text` | 新增空值兜底默认播报文本 | 终版修复 V2 | 防止 TTS 播放静音 |
| 安全阀 - `updated_tasks` | 新增 `dict` 类型降级处理 | 终版修复 V2 | 防止解包失败时静默丢失任务数据 |
| ANSWER | 单变量透传 `final_json`，零手拼 | V2 架构 | 根治偶发 JSON 解析崩溃 |
| Vercel | `incrementCoins(delta)` 原子操作 | v2.0 | 修复并发双写竞态 |
