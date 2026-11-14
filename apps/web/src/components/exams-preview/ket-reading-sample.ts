// 仅用于答题页设计预览，不参与真实考试、计分或学习记录。
// 题面：四套KET青少版官方真题 Test 1，印刷p.8 / PDF p.9。
// 答案及依据：印刷p.93 / PDF p.94。此则告示为独立材料。
export const KET_READING_SAMPLE = {
  source: 'KET 青少版官方真题 · Test 1',
  location: 'Part 1 · 第 1 题',
  instruction: 'For each question, choose the correct answer.',
  notice: {
    title: 'Found: blue sports bag',
    body: 'Collect from school office',
    detail: '(with student ID card)',
  },
  options: [
    { id: 'A', label: 'A student has found the wrong ID card in his sports bag.' },
    { id: 'B', label: 'The person who lost his bag can get it from the school office.' },
    { id: 'C', label: 'If you find a lost sports bag, please take it to the school office.' },
  ],
  correctOptionId: 'B',
  explanation: '这是一则失物招领启事。失主带学生证到学校办公室领包。',
} as const
