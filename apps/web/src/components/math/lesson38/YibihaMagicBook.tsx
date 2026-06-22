import { useState } from 'react'

// ─────────────────────────────────────────────
// FAQ data
// ─────────────────────────────────────────────
const faqQuestions = [
  {
    id: 1,
    q: '什么叫一笔画？',
    options: [
      '从任意一个点出发，笔不离纸，不重复走完所有线',
      '从一个端点出发，笔不离纸，不重复走完所有线',
      '从奇点出发，把每条线重复走两遍',
    ],
    answer: 1,
    hint: '记住！出发的地方叫「端点」，不是随便一个点哦！',
  },
  {
    id: 2,
    q: '下面哪个不是「端点」？',
    options: [
      '线与线交叉的点',
      '开始画的点（起点）',
      '结束的点（终点）',
      '图形中间随便一个不连线的空白',
    ],
    answer: 3,
    hint: '端点有三种：交叉点、起点、终点。空白的地方当然不算！',
  },
  {
    id: 3,
    q: '奇点的总数量可能是……？',
    options: ['1个（奇数）', '3个（奇数）', '4个（偶数）', '5个（奇数）'],
    answer: 2,
    hint: '奇点一定是成对出现的，所以总数永远是偶数！1、3、5 这种奇数绝对不可能！',
  },
  {
    id: 4,
    q: '一个图形有 2 个奇点，能一笔画吗？怎么画？',
    options: [
      '不能画，奇点太多了',
      '能！从任意点出发，回到原点',
      '能！从一个奇点（端点）出发，到另一个奇点结束',
      '能！从偶点出发，到奇点结束',
    ],
    answer: 2,
    hint: '2个奇点可以一笔画，要从一个奇点进、另一个奇点出！',
  },
  {
    id: 5,
    q: '一个图形有 0 个奇点，从哪里出发？',
    options: [
      '只能从最左边的点出发',
      '必须从奇点出发',
      '可以从任意一个端点出发，最后回到原点',
      '不能一笔画',
    ],
    answer: 2,
    hint: '0个奇点，从任意端点出发，最后会自动回到起点，就像画圈圈！',
  },
  {
    id: 6,
    q: '图形有 6 个奇点，最少要几笔画完？',
    options: ['2笔', '3笔', '6笔', '1笔'],
    answer: 1,
    hint: '最少笔数 = 奇点数量 ÷ 2 = 6 ÷ 2 = 3笔！',
  },
  {
    id: 7,
    q: '不能一笔画时，可以怎么改造图形？',
    options: [
      '只能添加线，不能去掉线',
      '只能去掉线，不能添加线',
      '可以添加线或去掉线，让奇点变成0或2个',
      '把所有奇点连成一条线',
    ],
    answer: 2,
    hint: '加线或减线都行！目标是让奇点数量变成 0 或 2 个。',
  },
  {
    id: 8,
    q: '添加一条线，最多可以消灭几个奇点？',
    options: ['1个', '2个', '4个', '0个，只会增加奇点'],
    answer: 1,
    hint: '在两个奇点之间连一条线，这两个奇点都变成偶点，一次消灭2个！',
  },
  {
    id: 9,
    q: '改造图形时，添加或去掉的线有什么要求？',
    options: [
      '可以让图形断成两半',
      '连接的两个点必须都是奇点',
      '不能让图形断开，要保持连续',
      '必须是最长的那条线',
    ],
    answer: 2,
    hint: '最重要的一点：改造后图形必须还是连在一起的，不能断开！',
  },
  {
    id: 10,
    q: '下面哪种说法是错误的？',
    options: [
      '奇点总数一定是偶数个',
      '0个奇点时，起点=终点',
      '2个奇点时，从奇点（端点）出发',
      '一个图形可以有3个奇点',
    ],
    answer: 3,
    hint: '奇点永远是成对出现的，不可能有奇数个奇点，所以「3个奇点」这种情况根本不存在！',
  },
  {
    id: 11,
    q: '怎么「破坏」一个奇点让它变成偶点？',
    options: [
      '在这个点上添加一条线（让线数从奇数变偶数）',
      '把这个点画得更大',
      '用橡皮把这个点擦掉',
      '重新数一遍',
    ],
    answer: 0,
    hint: '给奇点添加一条线，线的数量从奇数变偶数，它就变成偶点啦！',
  },
]

// ─────────────────────────────────────────────
// Chapter definitions
// ─────────────────────────────────────────────
const chapters = [
  {
    id: 1,
    emoji: '✏️',
    title: '什么是一笔画？',
    color: 'from-violet-400 to-purple-500',
    bg: 'bg-violet-50',
    border: 'border-violet-300',
    accent: 'text-violet-700',
    isFaq: false,
    content: (
      <div className="space-y-4">
        <div className="rounded-2xl border-2 border-violet-200 bg-white p-4 text-center">
          <div className="mb-2 text-5xl">🖊️</div>
          <p className="text-lg font-bold text-violet-800">笔不离纸，不重复！</p>
          <p className="mt-2 text-sm text-violet-600">
            从一个<span className="font-black text-violet-900 underline decoration-wavy">端点</span>
            出发， 一笔走完所有的线，每条线只能走一次哦！
          </p>
        </div>

        <div className="rounded-2xl border-2 border-violet-300 bg-violet-100 p-3">
          <p className="mb-3 text-center text-sm font-black text-violet-800">
            📌 什么是「端点」？记住这三种！
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl bg-purple-200 px-3 py-2 text-purple-900">
              <svg viewBox="0 0 40 40" className="h-8 w-8 flex-shrink-0">
                <line
                  x1="5"
                  y1="20"
                  x2="35"
                  y2="20"
                  stroke="#7c3aed"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <line
                  x1="20"
                  y1="5"
                  x2="20"
                  y2="35"
                  stroke="#7c3aed"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="20" cy="20" r="4" fill="#f59e0b" />
              </svg>
              <span className="text-xs font-bold">
                ① 线与线<span className="underline">交叉</span>的点
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-green-200 px-3 py-2 text-green-900">
              <svg viewBox="0 0 40 40" className="h-8 w-8 flex-shrink-0">
                <line
                  x1="8"
                  y1="20"
                  x2="35"
                  y2="20"
                  stroke="#16a34a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="8" cy="20" r="4" fill="#16a34a" />
                <text x="8" y="36" fontSize="7" fill="#15803d" textAnchor="middle">
                  起
                </text>
              </svg>
              <span className="text-xs font-bold">
                ② <span className="underline">开始</span>的点（起点）
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-red-200 px-3 py-2 text-red-900">
              <svg viewBox="0 0 40 40" className="h-8 w-8 flex-shrink-0">
                <line
                  x1="5"
                  y1="20"
                  x2="32"
                  y2="20"
                  stroke="#dc2626"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <circle cx="32" cy="20" r="4" fill="#dc2626" />
                <text x="32" y="36" fontSize="7" fill="#b91c1c" textAnchor="middle">
                  终
                </text>
              </svg>
              <span className="text-xs font-bold">
                ③ <span className="underline">结束</span>的点（终点）
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border-2 border-green-200 bg-green-50 p-3 text-center">
            <div className="mb-1 text-2xl">✅</div>
            <p className="text-xs font-bold text-green-700">可以一笔画</p>
            <svg viewBox="0 0 80 60" className="mt-1 w-full">
              <rect
                x="10"
                y="10"
                width="60"
                height="40"
                fill="none"
                stroke="#16a34a"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="10"
                y1="10"
                x2="70"
                y2="50"
                stroke="#16a34a"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-center">
            <div className="mb-1 text-2xl">❌</div>
            <p className="text-xs font-bold text-red-700">不能一笔画</p>
            <svg viewBox="0 0 80 60" className="mt-1 w-full">
              <line
                x1="10"
                y1="30"
                x2="70"
                y2="30"
                stroke="#dc2626"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="40"
                y1="10"
                x2="40"
                y2="50"
                stroke="#dc2626"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="10"
                y1="10"
                x2="70"
                y2="50"
                stroke="#dc2626"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="70"
                y1="10"
                x2="10"
                y2="50"
                stroke="#dc2626"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 2,
    emoji: '⭐',
    title: '奇点是什么？',
    color: 'from-amber-400 to-orange-500',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    accent: 'text-amber-700',
    isFaq: false,
    content: (
      <div className="space-y-4">
        <div className="rounded-2xl border-2 border-amber-200 bg-white p-4">
          <p className="mb-3 text-center text-sm font-bold text-amber-800">
            数一数这个点连了几条线 👇
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <svg viewBox="0 0 80 80" className="mx-auto w-20">
                <circle cx="40" cy="40" r="6" fill="#f59e0b" />
                <line
                  x1="40"
                  y1="40"
                  x2="10"
                  y2="15"
                  stroke="#d97706"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <line
                  x1="40"
                  y1="40"
                  x2="70"
                  y2="15"
                  stroke="#d97706"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <line
                  x1="40"
                  y1="40"
                  x2="40"
                  y2="70"
                  stroke="#d97706"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <text x="40" y="10" textAnchor="middle" fontSize="10" fill="#92400e">
                  3条线
                </text>
              </svg>
              <div className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                奇点 ⭐
              </div>
              <p className="mt-1 text-xs text-gray-500">3是奇数</p>
            </div>
            <div className="text-center">
              <svg viewBox="0 0 80 80" className="mx-auto w-20">
                <circle cx="40" cy="40" r="6" fill="#6d28d9" />
                <line
                  x1="40"
                  y1="40"
                  x2="10"
                  y2="10"
                  stroke="#7c3aed"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <line
                  x1="40"
                  y1="40"
                  x2="70"
                  y2="10"
                  stroke="#7c3aed"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <line
                  x1="40"
                  y1="40"
                  x2="10"
                  y2="70"
                  stroke="#7c3aed"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <line
                  x1="40"
                  y1="40"
                  x2="70"
                  y2="70"
                  stroke="#7c3aed"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <text x="40" y="10" textAnchor="middle" fontSize="10" fill="#4c1d95">
                  4条线
                </text>
              </svg>
              <div className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">
                偶点 ✨
              </div>
              <p className="mt-1 text-xs text-gray-500">4是偶数</p>
            </div>
          </div>
        </div>

        {/* 超级重点：奇点总数一定是偶数 */}
        <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-4">
          <p className="mb-2 text-center text-sm font-black text-red-800">
            🚨 超级重要！必须记住！
          </p>
          <div className="rounded-xl border-2 border-red-300 bg-white p-3 text-center">
            <p className="text-base font-black text-red-700">奇点的总数量</p>
            <p className="my-1 text-2xl font-black text-red-600">永远是偶数！</p>
            <p className="text-xs text-red-500">（0个、2个、4个、6个……）</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-green-300 bg-green-100 p-2 text-center">
              <p className="text-xs font-bold text-green-700">✅ 可能出现</p>
              <p className="text-sm font-black text-green-800">0、2、4、6个</p>
            </div>
            <div className="rounded-xl border border-red-300 bg-red-100 p-2 text-center">
              <p className="text-xs font-bold text-red-700">❌ 绝对不可能</p>
              <p className="text-sm font-black text-red-800">1、3、5、7个</p>
            </div>
          </div>
          <p className="mt-2 text-center text-xs font-bold text-red-600">奇点一定是成对出现的！</p>
        </div>
      </div>
    ),
  },
  {
    id: 3,
    emoji: '🗝️',
    title: '一笔画的秘诀',
    color: 'from-emerald-400 to-teal-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    accent: 'text-emerald-700',
    isFaq: false,
    content: (
      <div className="space-y-3">
        <div className="mb-2 rounded-2xl border-2 border-emerald-200 bg-white p-3 text-center">
          <p className="text-sm font-bold text-emerald-800">先数奇点的数量！</p>
        </div>
        <div className="rounded-xl border-2 border-green-300 bg-green-50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl">🟢</span>
            <span className="text-sm font-bold text-green-800">0个奇点</span>
          </div>
          <p className="ml-8 text-xs text-green-700">
            从任意一个<strong>端点</strong>出发，最后回到起点！像画圆圈一样
          </p>
          <svg viewBox="0 0 120 50" className="mt-2 w-full">
            <rect
              x="20"
              y="8"
              width="80"
              height="30"
              rx="5"
              fill="none"
              stroke="#16a34a"
              strokeWidth="2.5"
            />
            <circle cx="20" cy="23" r="4" fill="#16a34a" />
            <text x="60" y="47" textAnchor="middle" fontSize="9" fill="#15803d">
              起点=终点
            </text>
          </svg>
        </div>
        <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl">🔵</span>
            <span className="text-sm font-bold text-blue-800">2个奇点</span>
          </div>
          <p className="ml-8 text-xs text-blue-700">从一个奇点（端点）出发，从另一个奇点结束！</p>
          <svg viewBox="0 0 120 55" className="mt-2 w-full">
            <line
              x1="20"
              y1="25"
              x2="100"
              y2="25"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1="20"
              y1="25"
              x2="60"
              y2="10"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1="60"
              y1="10"
              x2="100"
              y2="25"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="20" cy="25" r="5" fill="#f59e0b" />
            <circle cx="100" cy="25" r="5" fill="#f59e0b" />
            <text x="20" y="42" textAnchor="middle" fontSize="8" fill="#92400e">
              起点⭐
            </text>
            <text x="100" y="42" textAnchor="middle" fontSize="8" fill="#92400e">
              终点⭐
            </text>
          </svg>
        </div>
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔴</span>
            <div>
              <p className="text-sm font-bold text-red-800">4个或更多奇点（一定是偶数）</p>
              <p className="text-xs text-red-700">不能一笔画完！需要多笔</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 4,
    emoji: '✂️',
    title: '改造图形',
    color: 'from-pink-400 to-rose-500',
    bg: 'bg-pink-50',
    border: 'border-pink-300',
    accent: 'text-pink-700',
    isFaq: false,
    content: (
      <div className="space-y-3">
        <div className="rounded-2xl border-2 border-pink-200 bg-white p-3 text-center">
          <p className="text-sm font-bold text-pink-800">改造魔法 🪄</p>
          <p className="mt-1 text-xs text-pink-600">图形不能一笔画？用加线或减线来改造！</p>
        </div>
        <div className="rounded-xl border-2 border-pink-200 bg-pink-50 p-3">
          <p className="mb-2 text-xs font-bold text-pink-800">➕ 添加一条线</p>
          <div className="space-y-1 rounded-lg bg-white p-2 text-xs text-pink-700">
            <p>• 连接两个奇点 → 这两个奇点变成偶点</p>
            <p>• 一次可以消灭2个奇点！</p>
          </div>
        </div>
        <div className="rounded-xl border-2 border-pink-200 bg-pink-50 p-3">
          <p className="mb-2 text-xs font-bold text-pink-800">➖ 去掉一条线</p>
          <div className="space-y-1 rounded-lg bg-white p-2 text-xs text-pink-700">
            <p>• 去掉连接两个奇点之间的线 → 这两个奇点消失</p>
            <p>• 也可以消灭2个奇点！</p>
          </div>
        </div>
        <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 p-3">
          <p className="text-xs font-bold text-yellow-800">⚠️ 重要规则！</p>
          <p className="mt-1 text-xs text-yellow-700">
            添加或去掉的线不能让图形断开！要保持图形是连续的整体
          </p>
        </div>
        <div className="rounded-xl border-2 border-orange-300 bg-orange-50 p-3">
          <p className="text-xs font-bold text-orange-800">🧠 怎么破坏一个奇点？</p>
          <p className="mt-1 text-xs text-orange-700">
            在奇点上添加一条线，让它的连线数从奇数变成偶数，它就变成偶点啦！
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 5,
    emoji: '🧮',
    title: '最少几笔？',
    color: 'from-cyan-400 to-blue-500',
    bg: 'bg-cyan-50',
    border: 'border-cyan-300',
    accent: 'text-cyan-700',
    isFaq: false,
    content: (
      <div className="space-y-4">
        <div className="rounded-2xl border-2 border-cyan-200 bg-white p-4 text-center">
          <p className="text-3xl font-black text-cyan-700">奇点数量 ÷ 2</p>
          <p className="mt-1 text-sm text-cyan-600">= 最少需要几笔！</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { odd: 0, strokes: 1, color: 'bg-green-100 border-green-300 text-green-800' },
            { odd: 2, strokes: 1, color: 'bg-blue-100 border-blue-300 text-blue-800' },
            { odd: 4, strokes: 2, color: 'bg-amber-100 border-amber-300 text-amber-800' },
            { odd: 6, strokes: 3, color: 'bg-orange-100 border-orange-300 text-orange-800' },
            { odd: 8, strokes: 4, color: 'bg-red-100 border-red-300 text-red-800' },
            { odd: 10, strokes: 5, color: 'bg-purple-100 border-purple-300 text-purple-800' },
          ].map((item) => (
            <div key={item.odd} className={`rounded-xl border-2 ${item.color} p-2 text-center`}>
              <p className="text-xs font-bold">{item.odd}个奇点</p>
              <p className="text-lg font-black">{item.strokes}笔</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border-2 border-cyan-300 bg-cyan-100 p-3 text-center">
          <p className="text-xs font-bold text-cyan-800">✨ 每2个奇点需要多画1笔！</p>
        </div>
      </div>
    ),
  },
  {
    id: 6,
    emoji: '🎯',
    title: '解题步骤',
    color: 'from-indigo-400 to-violet-500',
    bg: 'bg-indigo-50',
    border: 'border-indigo-300',
    accent: 'text-indigo-700',
    isFaq: false,
    content: (
      <div className="space-y-3">
        <p className="text-center text-xs font-bold text-indigo-600">照这4步来，一笔画秒变简单！</p>
        {[
          {
            step: 1,
            icon: '🔍',
            title: '数奇点',
            desc: '找出所有端点，数每个端点连了几条线，标出奇点',
          },
          {
            step: 2,
            icon: '🤔',
            title: '判断',
            desc: '0或2个奇点 → 可以一笔画！4个以上 → 需要改造',
          },
          {
            step: 3,
            icon: '🪄',
            title: '改造',
            desc: '加线或减线，让奇点变成0或2个（注意不能断开图形）',
          },
          {
            step: 4,
            icon: '✏️',
            title: '出发！',
            desc: '0个奇点：从任意端点出发；2个奇点：从奇点（端点）出发',
          },
        ].map((s) => (
          <div
            key={s.step}
            className="flex items-start gap-3 rounded-xl border-2 border-indigo-100 bg-white p-3"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 text-sm font-black text-white">
              {s.step}
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-800">
                {s.icon} {s.title}
              </p>
              <p className="mt-0.5 text-xs text-indigo-600">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 7,
    emoji: '🏆',
    title: '闯关大挑战！',
    color: 'from-yellow-400 to-orange-500',
    bg: 'bg-yellow-50',
    border: 'border-yellow-400',
    accent: 'text-yellow-700',
    isFaq: true,
    content: null,
  },
]

// ─────────────────────────────────────────────
// FAQ Component
// ─────────────────────────────────────────────
function FaqSection() {
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [finished, setFinished] = useState(false)

  const q = faqQuestions[current]
  const isRight = selected === q.answer

  const handleSelect = (i: number) => {
    if (confirmed) return
    setSelected(i)
  }

  const handleConfirm = () => {
    if (selected === null) return
    setConfirmed(true)
    if (selected === q.answer) setCorrect((c) => c + 1)
  }

  const handleNext = () => {
    if (current + 1 >= faqQuestions.length) {
      setFinished(true)
    } else {
      setCurrent((c) => c + 1)
      setSelected(null)
      setConfirmed(false)
    }
  }

  const handleReset = () => {
    setCurrent(0)
    setSelected(null)
    setConfirmed(false)
    setCorrect(0)
    setFinished(false)
  }

  if (finished) {
    const pct = Math.round((correct / faqQuestions.length) * 100)
    const starStr = pct >= 90 ? '🌟🌟🌟' : pct >= 70 ? '⭐⭐' : '⭐'
    return (
      <div className="space-y-4 text-center">
        <div className="text-6xl">{pct >= 90 ? '🏆' : pct >= 70 ? '🎉' : '💪'}</div>
        <p className="text-xl font-black text-yellow-800">挑战完成！</p>
        <div className="rounded-2xl border-2 border-yellow-300 bg-white p-4">
          <p className="text-3xl font-black text-orange-600">
            {correct} / {faqQuestions.length}
          </p>
          <p className="mt-1 text-sm text-yellow-700">答对了 {pct}%</p>
          <p className="mt-2 text-2xl">{starStr}</p>
        </div>
        {pct === 100 && (
          <p className="text-sm font-black text-green-600">🎊 全对！你是一笔画大师！</p>
        )}
        <button
          onClick={handleReset}
          className="w-full rounded-xl bg-gradient-to-r from-yellow-400 to-orange-400 py-3 text-sm font-black text-white"
        >
          🔄 再挑战一次！
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Progress */}
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-bold text-yellow-700">
          第 {current + 1} / {faqQuestions.length} 题
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-yellow-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-300"
            style={{ width: `${(current / faqQuestions.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-bold text-green-700">✓ {correct}</span>
      </div>

      {/* Question */}
      <div className="rounded-2xl border-2 border-yellow-200 bg-white p-4">
        <p className="text-sm leading-relaxed font-black text-yellow-900">{q.q}</p>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {q.options.map((opt, i) => {
          let cls = 'border-yellow-200 bg-white text-gray-700'
          if (selected === i && !confirmed)
            cls = 'border-yellow-400 bg-yellow-50 text-yellow-900 font-bold'
          if (confirmed) {
            if (i === q.answer) cls = 'border-green-400 bg-green-50 text-green-800 font-bold'
            else if (selected === i) cls = 'border-red-400 bg-red-50 text-red-700'
          }
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className={`w-full rounded-xl border-2 px-3 py-2.5 text-left text-xs transition-all ${cls}`}
            >
              <span className="mr-2 font-black">{['A', 'B', 'C', 'D'][i]}.</span>
              {opt}
            </button>
          )
        })}
      </div>

      {/* Hint after confirm */}
      {confirmed && (
        <div
          className={`rounded-xl border-2 p-3 text-xs font-bold ${isRight ? 'border-green-300 bg-green-50 text-green-800' : 'border-orange-300 bg-orange-50 text-orange-800'}`}
        >
          {isRight ? '🎉 答对啦！' : '💡 提示：'} {q.hint}
        </div>
      )}

      {/* Buttons */}
      {!confirmed ? (
        <button
          onClick={handleConfirm}
          disabled={selected === null}
          className={`w-full rounded-xl py-3 text-sm font-black transition-all ${selected !== null ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white' : 'bg-yellow-100 text-yellow-400'}`}
        >
          确认答案 ✔
        </button>
      ) : (
        <button
          onClick={handleNext}
          className="w-full rounded-xl bg-gradient-to-r from-orange-400 to-rose-400 py-3 text-sm font-black text-white"
        >
          {current + 1 >= faqQuestions.length ? '查看结果 🏆' : '下一题 →'}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export default function YibihaMagicBook() {
  const [activeChapter, setActiveChapter] = useState<number | null>(null)
  const [stars, setStars] = useState<number[]>([])

  const handleOpen = (id: number) => {
    setActiveChapter(id)
    if (!stars.includes(id)) {
      setStars((prev) => [...prev, id])
    }
  }

  const active = chapters.find((c) => c.id === activeChapter)
  const totalChapters = chapters.length

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-violet-50 to-pink-50 p-4 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&display=swap');
        .magic-font { font-family: 'Noto Sans SC', sans-serif; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes pop { 0%{transform:scale(0.8);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes slide-up { 0%{transform:translateY(30px);opacity:0} 100%{transform:translateY(0);opacity:1} }
        .float { animation: float 3s ease-in-out infinite; }
        .pop { animation: pop 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
        .slide-up { animation: slide-up 0.35s ease-out both; }
        .chapter-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .chapter-card:active { transform: scale(0.96); }
      `}</style>

      <div className="magic-font mx-auto">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="float mb-2 inline-block text-5xl">📖</div>
          <h1 className="text-2xl leading-tight font-black text-violet-800">一笔画</h1>
          <h2 className="text-lg font-black text-pink-600">魔法大书</h2>
          <p className="mt-1 text-xs text-violet-500">学会6招 + 闯关大挑战！</p>
          <div className="mt-2 flex justify-center gap-1">
            {chapters.map((c) => (
              <span key={c.id} className="text-base">
                {stars.includes(c.id) ? (c.isFaq ? '🏆' : '⭐') : '☆'}
              </span>
            ))}
          </div>
        </div>

        {/* Chapters Grid */}
        {activeChapter === null && (
          <div className="grid grid-cols-2 gap-3">
            {chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleOpen(ch.id)}
                className={`chapter-card relative rounded-2xl border-2 ${ch.border} ${ch.bg} p-4 text-left shadow-sm active:shadow-none ${ch.isFaq ? 'col-span-2' : ''}`}
              >
                {stars.includes(ch.id) && (
                  <span className="absolute top-2 right-2 text-sm">{ch.isFaq ? '🏆' : '⭐'}</span>
                )}
                <div
                  className={`h-10 w-10 rounded-xl bg-gradient-to-br ${ch.color} mb-2 flex items-center justify-center text-xl`}
                >
                  {ch.emoji}
                </div>
                <div className={`text-xs font-black ${ch.accent}`}>
                  {ch.isFaq ? '挑战关卡' : `第${ch.id}招`}
                </div>
                <div className="mt-0.5 text-sm leading-tight font-bold text-gray-800">
                  {ch.title}
                </div>
                {ch.isFaq && (
                  <p className="mt-1 text-xs text-yellow-600">11道题，看看你学会了多少！</p>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Chapter Detail */}
        {activeChapter !== null && active && (
          <div className="slide-up">
            <button
              onClick={() => setActiveChapter(null)}
              className="mb-4 flex items-center gap-1 text-sm font-bold text-violet-600"
            >
              ← 返回目录
            </button>

            <div className={`rounded-2xl border-2 ${active.border} ${active.bg} mb-4 p-4`}>
              <div className="mb-4 flex items-center gap-3">
                <div
                  className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${active.color} flex items-center justify-center text-2xl shadow-sm`}
                >
                  {active.emoji}
                </div>
                <div>
                  <div className={`text-xs font-black ${active.accent}`}>
                    {active.isFaq ? '闯关挑战' : `第${active.id}招`}
                  </div>
                  <div className="text-lg font-black text-gray-800">{active.title}</div>
                </div>
              </div>

              {active.isFaq ? <FaqSection /> : active.content}
            </div>

            {/* Navigation (non-FAQ chapters only) */}
            {!active.isFaq && (
              <div className="flex gap-3">
                {activeChapter > 1 && (
                  <button
                    onClick={() => handleOpen(activeChapter - 1)}
                    className="flex-1 rounded-xl border-2 border-violet-200 bg-white py-3 text-sm font-bold text-violet-700"
                  >
                    ← 上一招
                  </button>
                )}
                {activeChapter < totalChapters - 1 && (
                  <button
                    onClick={() => handleOpen(activeChapter + 1)}
                    className={`flex-1 rounded-xl bg-gradient-to-r py-3 ${active.color} text-sm font-bold text-white shadow-sm`}
                  >
                    下一招 →
                  </button>
                )}
                {activeChapter === totalChapters - 1 && (
                  <button
                    onClick={() => handleOpen(totalChapters)}
                    className="flex-1 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 py-3 text-sm font-bold text-white"
                  >
                    🏆 去闯关！
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        {activeChapter === null && (
          <div className="mt-6">
            <div className="mb-1 flex justify-between text-xs text-violet-500">
              <span>学习进度</span>
              <span>
                {stars.length}/{totalChapters} 章
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full border border-violet-200 bg-violet-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-pink-400 transition-all duration-500"
                style={{ width: `${(stars.length / totalChapters) * 100}%` }}
              />
            </div>
            {stars.length === totalChapters && (
              <p className="pop mt-3 text-center text-sm font-black text-yellow-600">
                🎉 全部解锁！你是一笔画大师！
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
