'use client'

import Link from 'next/link'
import { useAuth } from '@rosie/core'
import { useCalcSettings } from '../hooks/useCalcSettings'
import { useCalcWallet } from '@rosie/rewards'
import CalcAppHeader from '../components/CalcAppHeader'

type FaqBlock = {
  title: string
  body: string[]
}

const SECTIONS: { heading: string; blocks: FaqBlock[] }[] = [
  {
    heading: '一句话',
    blocks: [
      {
        title: '口算在帮孩子做什么？',
        body: [
          '多练还不熟、算得慢的题；已经又快又对的题会少出现，偶尔再抽查一下。',
          '目标不只是「算对」，还要「算得顺」。',
        ],
      },
    ],
  },
  {
    heading: '开始前',
    blocks: [
      {
        title: '先选练什么',
        body: [
          '打开「设置」：勾选题型（如 20 以内进位、×6×7、加减混合）。',
          '题量可选「自动分配」（往弱的题型多给几道）或「精准设置」（每种题型自己填题数）。',
          '「限时答题」可开可关：开了会显示倒计时；关掉倒计时后，系统仍会按建议速度判断快慢。',
        ],
      },
    ],
  },
  {
    heading: '一场练习里',
    blocks: [
      {
        title: '出题 → 答题 → 结束',
        body: [
          '按你选的题型出题；弱的、没见过的会多一点。',
          '对了得星星；错了通常可再试一次，还不对会进错题，本场末尾还会补练。',
          '上一场还没练会的错题，可能混在本场里再出现。',
          '结束后可看正确率与用时；星星可去换奖券。',
        ],
      },
    ],
  },
  {
    heading: '题目怎么挑',
    blocks: [
      {
        title: '1. 新题优先（九九表一类）',
        body: [
          '对 2～9 的乘除，会尽量先出还没练过的算式，少反复刷已经见过的。',
          '万以内加减、很多混合题没法一张表列完，会先多练、多记，再按强弱分配。',
        ],
      },
      {
        title: '2. 算对但太慢 = 还没真正会',
        body: [
          '在建议时间内算对 → 熟练度往上加。',
          '算对了但超时（卡顿）→ 当作还差一点，之后更容易再出这道题。',
          '算错 → 降得更多，并走错题流程。',
        ],
      },
      {
        title: '3. 又快又对几次 → 少练',
        body: [
          '同一道算式连续多次在时限内做对，日常会很少再出。',
          '隔一段时间会少量抽查，尤其是当初勉强才过关的题，防止忘光。',
        ],
      },
    ],
  },
  {
    heading: '错题本',
    blocks: [
      {
        title: '错题本是干什么的？',
        body: [
          '做错的题会进来；连续做对够次数（一般 3 次）后，会从「待掌握」里拿掉。',
          '拿掉后，日常练习也不会再当弱项狂推。',
          '若又做错了，会重新回来练。',
        ],
      },
    ],
  },
  {
    heading: '常见问题',
    blocks: [
      {
        title: '必须开「限时答题」吗？',
        body: [
          '不必。关掉只是不显示倒计时，系统仍会按建议速度判断快慢。',
          '想练「又对又快」，建议打开，并按题型设合理秒数。',
        ],
      },
      {
        title: '为什么老出同一类题？',
        body: [
          '多半是这类正确率低，或经常超时。系统在往弱处倾斜。',
          '已经很熟的类型，可在设置里少勾。',
        ],
      },
      {
        title: '为什么有的题好久不出了？',
        body: [
          '可能已经掌握（又快又对够次数）。偶尔还会抽查；又慢或又错会重新多练。',
        ],
      },
      {
        title: '刚开始练新题型，感觉很随机？',
        body: [
          '正常。系统要先多记一些做过的题，之后才会更明显地专攻弱点。',
        ],
      },
      {
        title: '沉浸模式？',
        body: [
          '提交后少打断、直接下一题；错题仍会记，本场末尾仍会补练。',
        ],
      },
    ],
  },
  {
    heading: '给家长的小建议',
    blocks: [
      {
        title: '怎么安排',
        body: [
          '入门：少勾几种题型，题量约 20；先求正确，再开限时。',
          '巩固九九表：勾 2～9 乘除相关，让系统帮着先练没见过的。',
          '提速：打开限时，关注「对但慢」是否变少。',
          '查漏：看错题本和练习报告，再调整设置里勾选的题型。',
        ],
      },
      {
        title: '和数学课练习有什么不同？',
        body: [
          '口算：按运算类型练反应，追求又对又快。',
          '数学课 / 题海：课本讲次里的题目，练理解和题型。',
          '可以一起用：口算练反应，数学练思路。',
        ],
      },
    ],
  },
]

export default function CalcFaqPage() {
  const { user } = useAuth()
  const { settings, update } = useCalcSettings(user)
  const wallet = useCalcWallet(user)

  return (
    <>
      <CalcAppHeader
        balance={wallet.balance}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() => update({ soundEnabled: !settings.soundEnabled })}
        title="口算说明"
        backHref="/calc"
        backLabel="口算"
      />

      <main className="mx-auto max-w-[640px] px-4 pt-5 pb-14 space-y-6">
        <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(196,181,253,0.65)' }}>
          用大白话说明口算怎么运作。设置可随时改，练几场再看报告会更清楚。
        </p>

        {SECTIONS.map((sec) => (
          <section key={sec.heading} className="space-y-3">
            <h2
              className="text-[11px] font-extrabold tracking-widest uppercase"
              style={{ color: 'rgba(196,181,253,0.45)' }}
            >
              {sec.heading}
            </h2>
            {sec.blocks.map((b) => (
              <div
                key={b.title}
                className="rounded-2xl px-4 py-3.5 space-y-2"
                style={{
                  background: 'rgba(139,92,246,0.08)',
                  border: '1px solid rgba(139,92,246,0.2)',
                }}
              >
                <h3 className="text-[14px] font-extrabold" style={{ color: '#e9d5ff' }}>
                  {b.title}
                </h3>
                <ul className="space-y-1.5">
                  {b.body.map((line) => (
                    <li
                      key={line}
                      className="text-[13px] leading-relaxed pl-3 relative"
                      style={{ color: 'rgba(245,243,255,0.72)' }}
                    >
                      <span
                        className="absolute left-0 top-[0.55em] h-1 w-1 rounded-full"
                        style={{ background: 'rgba(167,139,250,0.7)' }}
                      />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}

        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            href="/calc/settings"
            className="rounded-full px-4 py-2 text-[12px] font-extrabold no-underline"
            style={{
              background: 'rgba(139,92,246,0.2)',
              border: '1px solid rgba(139,92,246,0.4)',
              color: '#c4b5fd',
            }}
          >
            去设置
          </Link>
          <Link
            href="/calc"
            className="rounded-full px-4 py-2 text-[12px] font-extrabold no-underline"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(245,243,255,0.7)',
            }}
          >
            回口算首页
          </Link>
        </div>
      </main>
    </>
  )
}
