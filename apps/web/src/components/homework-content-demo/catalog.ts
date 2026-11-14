import { EXAM_DEMOS, type DemoId } from '../exams-preview/exam-demos'

export const SUBJECTS = ['数学', '口算', '语文', '英语', '考一考', '绘本', '通用'] as const
export type Subject = typeof SUBJECTS[number]
export type Example = { id: string; subject: Subject; kind: string; title: string; description: string; detailHref?: string; exam?: DemoId }
const example = (subject: Subject, kind: string, title: string, description: string): Example => ({ id: kind, subject, kind, title, description })
export const EXAMPLES: Example[] = [
  example('数学', 'math-text', '文字题与子问题', '题干、作答、反馈和解析；自拟练习。'),
  example('数学', 'math-figure', '图形与公式', '保留题图比例，分开呈现题目与解析。'),
  example('数学', 'math-video', '讲解视频', '题目下方展开视频；演示媒体不是真实课程。'),
  example('口算', 'calc-int', '整数口算', '复用正式口算题面和数字键盘。'),
  example('口算', 'calc-decimal', '小数口算', '小数输入与反馈。'),
  example('口算', 'calc-fraction', '分数', '复用分数作答面板。'),
  example('口算', 'calc-remainder', '有余数除法', '复用商和余数输入面板。'),
  example('口算', 'calc-vertical', '竖式', '复用正式竖式作答面板。'),
  example('语文', 'char', '会认字与会写字', '原有翻字卡：拼音、部首、笔画与组词。'),
  example('语文', 'strokes', '笔顺与书写', '原有笔顺演示与描写；仅本页反馈。'),
  example('语文', 'words', '词语与看拼写词', '词语卡、拼音与手写输入。'),
  example('语文', 'chinese-reading', '课文与朗读背诵', '自拟短文，支持朗读、隐藏正文与回忆填写。'),
  { ...example('语文', 'poem', '古诗与背诵', '复用古诗挖空背诵组件。'), detailHref: '/chinese/g1b/poems/jing-ye-si' },
  example('语文', 'accumulation', '日积月累', '名句、出处与填空练习。'),
  example('英语', 'word', '单词卡', '复用翻卡：音标、释义、例句与发音。'),
  example('英语', 'word-choice', '识词', '图片与选项，使用共享选择题控件。'),
  example('英语', 'spelling', '拼写', '听词、输入、检查与重试。'),
  example('英语', 'reading', '课文与译文', '复用阅读正文与词汇弹层，自拟阅读样例。'),
  example('英语', 'sentence', '逐句听读', '原文、译文、逐句朗读。'),
  example('英语', 'dictation', '听记与背诵', '先听后写，主动查看原句。'),
  example('英语', 'story', '故事章节', '自拟章节、段落、词汇与朗读。'),
  example('英语', 'grammar-lesson', '语法讲解', '复用例句、规则和表格渲染。'),
  example('英语', 'grammar-exercise', '语法练习', '复用六种原有题型，不保存掌握度。'),
  example('英语', 'grammar-page', '原书页图', '自拟教材页，展示页图与正文的对应关系。'),
  ...EXAM_DEMOS.map(([id, title, description]): Example => ({ id: `exam-${id}`, kind: 'exam', subject: '考一考', title, description, exam: id, detailHref: `/dev-preview/exams?type=${id}` })),
  example('绘本', 'pdf', 'PDF 单页与双页', '本地四页 PDF，复用 PDF 渲染与绘本页组件。'),
  example('通用', 'text', '手动文字与长内容', '长段落与长英文单词的换行效果。'),
  example('通用', 'image', '图片', '图片与说明文字。'),
  example('通用', 'audio', '音频', '本地生成提示音，复用共享播放器。'),
  example('通用', 'video', '视频', '浏览器生成短动画样片，复用共享播放器。'),
  example('通用', 'mixed', '混合内容与链接', '正文、图片、音频和明确的页面入口。'),
  example('通用', 'states', '加载、失败与空态', '点击切换状态，检查反馈与重试。'),
]
