export const EXAM_DEMOS = [
  ['notice', '短信息选择', '官方阅读 Part 1'],
  ['reading', '长文选择', '官方阅读 Part 3；听力 Parts 3 / 4'],
  ['picture', '图片选择', '官方听力 Part 1；Trainer 听力训练'],
  ['people', '人物字母点选', 'Trainer · T / A / N'],
  ['binary', '判断与字母分类', 'Trainer · 对错判断 ✓/✗；S/D、P/F、A/D 分类'],
  ['labels', '看图词库手写', 'Trainer · 房间物品'],
  ['matching', '共享选项配对', '官方阅读 Part 2；听力 Part 5'],
  ['replies', '一题多个回应', 'Trainer · 建议与回应'],
  ['cloze', '逐空三选一', '官方阅读 Part 4'],
  ['bank', '词库多空题', 'Trainer · 年龄词库 / 情态词'],
  ['open', '开放式填空', '官方阅读 Part 5；Trainer 句子填空'],
  ['form', '听力信息填写', '官方听力 Part 2'],
  ['writing', '邮件与看图写作', '官方阅读写作 Parts 6 / 7'],
  ['speaking', '问答与看图讨论', '官方口语 Parts 1 / 2'],
  ['handwriting-review', '手写批阅流程', '新增 demo · 待 review 后接正式页'],
  ['illustrated-reading', '图文阅读材料', '三种原题布局 · 待 review 后接正式页'],
  ['heading-number', '标题与题目编号', '栏目、活动、小题分层 · 待 review 后接正式页'],
] as const

export type DemoId = typeof EXAM_DEMOS[number][0]
