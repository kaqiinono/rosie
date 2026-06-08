# 英文词库关键字提取规则 (Optimized Version)

## 一、 核心清洗原则（去噪）

### 1. 去掉外壳（无语义，直接删除）
*   **动作/状态引导词**：开头的前缀如 `to` / `making you` / `is the act of` / `used to describe` / `(of a person)`
*   **形容词特征词**：开头的 `feeling...` / `being...` / `having...` / `the quality of...`
*   **冠词**：名词开头的 `a` / `an` / `the`

### 2. 去掉占位词与次要从句
*   **模糊代词**：`something` / `someone` / `things` / `a person` / `somewhere`
*   **次要从句**：`when...` / `if...` / `especially...` / `because...` 引导的修饰性从句（若从句包含核心逻辑，则去掉引导词，仅保留从句中的核心动宾或特征）。

### 3. 并列义项精简
*   **近义词并列**：由 `or` / `and` / `;` 连接的近义词，只保留第一个最核心的词。
*   **多场景并列**：若 `or` 连接的是不同适用对象（如 a place or person），保留核心动作，合并或简化宾语（如变更为 `place/person`）。

---

## 二、 核心提取与词性对齐（留真）

提取的关键字必须与原词的**词性逻辑对齐**，确保记忆时不混淆词性：

1.  **动词 (Verb)**
  *   提取目标：**[核心动词] + [副词/介词]** 或 **[核心动词] + [核心名词]**
  *   示例：*collapse* -> `fall down suddenly` / *obtain* -> `get by effort`
2.  **形容词 (Adjective)**
  *   提取目标：**[副词] + [形容词]** 或 **单一核心[形容词]**
  *   示例：*furious* -> `extremely angry` / *ancient* -> `very old`
3.  **名词 (Noun)**
  *   提取目标：**[核心特征/修饰词] + [核心名词]**
  *   示例：*famine* -> `food shortage` / *drought* -> `no rain`

---

## 三、 特殊逻辑处理规则

### 1. 否定与反义规则（不可遗漏）
*   定义中包含 `not`、`without`、`unable to`、`fail to` 等否定词时，**必须保留否定逻辑**，或直接转化为反义词。
*   示例：*innocent* (not guilty) -> `not guilty` / *barren* (unable to produce plants) -> `cannot produce plants`

### 2. 万能学术词/高频结构替换
*   `make / cause to become + [形容词]` -> 直接提取 `become + [形容词]` 或 `[形容词]`
*   `a large amount of...` / `a lot of...` -> 替换为 `many / much / a lot`

---

## 四、 综合示例集 (Benchmark)


| Word | Part of Speech | Full English Definition | Extracted Keyword | Rule Applied |
| :--- | :--- | :--- | :--- | :--- |
| **frightening** | adj. | making you feel afraid | `feel afraid` | 去掉动作外壳 |
| **waste** | v. | to use too much of something or use something badly | `use too much` | 并列精简 + 去掉占位词 |
| **admire** | v. | to respect and approve of someone | `respect` | 近义词并列精简 |
| **abandon** | v. | to leave a place or person, usually forever | `leave place/person forever` | 场景合并 + 保留核心副词 |
| **exhausted** | adj. | feeling very tired | `very tired` | 去掉状态外壳(feeling) |
| **prohibit** | v. | to officially refuse to allow something | `not allow` | 核心否定保留 + 词义精炼 |
| **famine** | n. | a lack of food during a long period of time | `food shortage` | 名词词性对齐 + 概念提炼 |
| **blush** | v. | to become red in the face because you are embarrassed | `red face from embarrassed` | 从句去引导词 + 保留核心逻辑 |
