'use client'

import React from 'react'
import {
  MathQuizConfig,
  VerticalDigitPuzzle,
} from '@rosie/math/components/shared/VerticalDigitPuzzle'

const MathDemoPage: React.FC = () => {
  // 模拟从后端或文档配置中解析出来的标准数字谜题库
  const mockQuizzes: MathQuizConfig[] = [
    {
      id: 'quiz-1',
      title: '例题 1 - 基础方框谜 (5□□ + 3□3 = 852)',
      rows: [
        {
          cells: [{ isInput: true, answer: '4' }, { value: '5' }, { isInput: true, answer: '9' }],
        },
        {
          operator: '+',
          cells: [{ value: '3' }, { isInput: true, answer: '9' }, { value: '3' }],
        },
        {
          isResultLine: true,
          cells: [{ value: '8' }, { value: '5' }, { value: '2' }],
        },
      ],
    },
    {
      id: 'quiz-2',
      title: '例题 6 - 汉字数字谜 (兴趣×4 = 高兴)',
      rows: [
        {
          cells: [
            { isInput: true, answer: '2', placeholder: '兴' },
            { isInput: true, answer: '5', placeholder: '趣' },
          ],
        },
        {
          cells: [
            { isInput: true, answer: '2', placeholder: '兴' },
            { isInput: true, answer: '5', placeholder: '趣' },
          ],
        },
        {
          cells: [
            { isInput: true, answer: '2', placeholder: '兴' },
            { isInput: true, answer: '5', placeholder: '趣' },
          ],
        },
        {
          operator: '+',
          cells: [
            { isInput: true, answer: '2', placeholder: '兴' },
            { isInput: true, answer: '5', placeholder: '趣' },
          ],
        },
        {
          isResultLine: true,
          cells: [
            { isInput: true, answer: '1', placeholder: '高' },
            { isInput: true, answer: '2', placeholder: '兴' },
          ],
        },
      ],
    },
    {
      id: 'quiz-3',
      title: '例题 15 - 减法图形谜 (☆△ - △☆ = ○4)',
      rows: [
        {
          cells: [
            { isInput: true, answer: '9', placeholder: '☆' },
            { isInput: true, answer: '5', placeholder: '△' },
          ],
        },
        {
          operator: '-',
          cells: [
            { isInput: true, answer: '5', placeholder: '△' },
            { isInput: true, answer: '9', placeholder: '☆' },
          ],
        },
        {
          isResultLine: true,
          cells: [{ isInput: true, answer: '3', placeholder: '○' }, { value: '4' }],
        },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      {/* 页面顶部 Bar */}
      <div className="mx-auto mb-10 max-w-7xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          小学奥数竖式数字谜组件
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-slate-500 sm:mt-4">
          基于 React、TS 和 Tailwind CSS
          构建。完美解决多行混排、动态位宽、自适应右对齐及客户端实时自动判题。
        </p>
      </div>

      {/* 栅格题目列表 */}
      <div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {mockQuizzes.map((quiz) => (
          <VerticalDigitPuzzle key={quiz.id} config={quiz} />
        ))}
      </div>
    </div>
  )
}

export default MathDemoPage
