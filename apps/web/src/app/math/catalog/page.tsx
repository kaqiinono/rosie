'use client'

import { Fragment, useMemo, useState } from 'react'
import { BackLink } from '@rosie/ui'
import CatalogTree from '@rosie/math/components/catalog/CatalogTree'
import {
  BOOKS,
  bookOrder,
  crossTopics,
  FAM,
  type FamilyKey,
  isCross,
  LESSONS,
  SERIES_COLOR,
  SERIES_LIST,
  singleTopics,
  stars,
  tcolor,
  TOPIC,
  topicBookCount,
} from '@rosie/math/utils/catalog-data'

type Tab = 'list' | 'graph' | 'advice'

function toggleSet<T>(set: Set<T>, v: T): Set<T> {
  const next = new Set(set)
  if (next.has(v)) next.delete(v)
  else next.add(v)
  return next
}

function highlight(text: string, kw: string) {
  if (!kw) return text
  const parts = text.split(kw)
  return parts.map((p, i) => (
    <Fragment key={i}>
      {p}
      {i < parts.length - 1 && <mark className="rounded-[3px] bg-[#fff3a0] px-0.5">{kw}</mark>}
    </Fragment>
  ))
}

export default function MathCatalogPage() {
  const [kw, setKw] = useState('')
  const [topics, setTopics] = useState<Set<string>>(new Set())
  const [series, setSeries] = useState<Set<string>>(new Set())
  const [diffs, setDiffs] = useState<Set<number>>(new Set())
  const [tab, setTab] = useState<Tab>('list')

  const kwTrim = kw.trim()
  const hasFilter = !!kwTrim || topics.size > 0 || series.size > 0 || diffs.size > 0

  const filtered = useMemo(
    () =>
      LESSONS.filter((l) => {
        if (kwTrim && !l.title.includes(kwTrim) && !l.tags.some((t) => t.includes(kwTrim)))
          return false
        if (topics.size && !l.tags.some((t) => topics.has(t))) return false
        if (series.size && !series.has(BOOKS[l.book].series)) return false
        if (diffs.size && !diffs.has(l.diff)) return false
        return true
      }),
    [kwTrim, topics, series, diffs],
  )

  const clearAll = () => {
    setKw('')
    setTopics(new Set())
    setSeries(new Set())
    setDiffs(new Set())
  }

  // 题型 chips 按家族分组
  const famGroups = useMemo(
    () =>
      (Object.keys(FAM) as FamilyKey[])
        .map((fk) => ({
          fk,
          topics: Object.keys(TOPIC)
            .filter((t) => TOPIC[t][0] === fk)
            .sort((a, b) => topicBookCount(b) - topicBookCount(a)),
        }))
        .filter((g) => g.topics.length > 0),
    [],
  )

  // 列表分组（按书）
  const byBook = useMemo(() => {
    const m: Record<string, typeof filtered> = {}
    filtered.forEach((l) => {
      ;(m[l.book] = m[l.book] || []).push(l)
    })
    return Object.keys(m)
      .sort((a, b) => bookOrder(a) - bookOrder(b))
      .map((bk) => ({ bk, list: m[bk].slice().sort((x, y) => x.no - y.no) }))
  }, [filtered])

  // 学习路径建议
  const adviceKeys = useMemo(() => {
    const keys = topics.size ? [...topics] : crossTopics.slice()
    return keys.sort((a, b) => topicBookCount(b) - topicBookCount(a))
  }, [topics])

  const chipBase =
    'm-[3px] inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-[5px] text-[12.5px] transition hover:-translate-y-px'

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-[#1f2733]">
      <BackLink href="/math" label="返回数学" />

      <header className="bg-gradient-to-r from-[#3a0ca3] via-[#4361ee] to-[#4895ef] px-7 py-[22px] text-white">
        <h1 className="m-0 text-[21px] font-bold">📚 小学数学思维教材 · 细分题型知识图谱</h1>
        <p className="mt-1.5 text-[13px] opacity-90">
          《学而思秘籍 1–7》·《大白本 1–3》·《高斯数学课本 一上–三下》·《高思竞赛数学导引》｜
          从目录提取细分题型（不同书的同类异名已合并），跨 ≥2 本书的为正式题型，仅 1 本的标为「单本专题」
        </p>
        <div className="mt-3 flex flex-wrap gap-3.5">
          {[
            [Object.keys(BOOKS).length, '本教材'],
            [LESSONS.length, '个讲次'],
            [crossTopics.length, '跨书题型'],
            [singleTopics.length, '单本专题'],
          ].map(([n, label]) => (
            <div key={label} className="rounded-[10px] bg-white/15 px-3.5 py-1.5 text-[13px]">
              <b className="mr-1 text-[18px]">{n}</b>
              {label}
            </div>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] p-5">
        {/* 检索条件 */}
        <div className="mb-[18px] rounded-[14px] bg-white p-5 shadow-[0_2px_14px_rgba(30,40,80,.08)]">
          <h3 className="m-0 mb-3 text-[13px] font-semibold tracking-wide text-[#6b7688]">
            检索条件（关键字 / 题型 / 书籍 / 难度，可组合）
          </h3>
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="🔍 搜索目录标题：鸡兔、竖式、植树、数阵、相遇…"
              className="min-w-[220px] flex-1 rounded-[10px] border border-[#e6e9f0] px-3.5 py-[11px] text-[15px] outline-none focus:border-[#4361ee] focus:shadow-[0_0_0_3px_rgba(67,97,238,.12)]"
            />
            <button
              onClick={clearAll}
              className="rounded-[10px] border border-[#4361ee] bg-white px-3 py-[9px] text-sm text-[#4361ee]"
            >
              清空筛选
            </button>
          </div>

          {/* 题型家族分组 */}
          <div className="mt-3">
            <div className="mb-1 text-xs text-[#6b7688]">
              细分题型（按家族分组；带本数；虚线=单本专题）
            </div>
            <div>
              {famGroups.map(({ fk, topics: ts }) => (
                <div
                  key={fk}
                  className="flex items-start gap-2 border-b border-dashed border-[#f0f2f7] py-[3px]"
                >
                  <div
                    className="min-w-[70px] pt-2 text-xs font-semibold"
                    style={{ color: FAM[fk].color }}
                  >
                    {FAM[fk].name}
                  </div>
                  <div className="flex-1">
                    {ts.map((t) => {
                      const on = topics.has(t)
                      const single = !isCross(t)
                      return (
                        <span
                          key={t}
                          onClick={() => setTopics((s) => toggleSet(s, t))}
                          className={`${chipBase} ${single ? 'border-dashed opacity-60' : ''} ${
                            on ? 'border-transparent text-white' : 'border-[#e6e9f0] bg-white'
                          }`}
                          style={on ? { background: tcolor(t) } : undefined}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: tcolor(t) }}
                          />
                          {t}
                          <span className="text-[10px] opacity-60">·{topicBookCount(t)}本</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 书籍系列 */}
          <div className="mt-3">
            <div className="mb-1 text-xs text-[#6b7688]">书籍系列</div>
            <div>
              {SERIES_LIST.map((s) => {
                const on = series.has(s)
                return (
                  <span
                    key={s}
                    onClick={() => setSeries((prev) => toggleSet(prev, s))}
                    className={`${chipBase} ${on ? 'border-transparent text-white' : 'border-[#e6e9f0] bg-white'}`}
                    style={on ? { background: SERIES_COLOR[s] } : undefined}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: SERIES_COLOR[s] }} />
                    {s}
                  </span>
                )
              })}
            </div>
          </div>

          {/* 难度 */}
          <div className="mt-3">
            <div className="mb-1 text-xs text-[#6b7688]">难度</div>
            <div>
              {[1, 2, 3, 4, 5].map((d) => {
                const on = diffs.has(d)
                return (
                  <span
                    key={d}
                    onClick={() => setDiffs((prev) => toggleSet(prev, d))}
                    className={`${chipBase} ${on ? 'border-transparent text-white' : 'border-[#e6e9f0] bg-white'}`}
                    style={on ? { background: '#f5a623' } : undefined}
                  >
                    {'★'.repeat(d)}
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-3.5 flex flex-wrap gap-1.5">
          {(
            [
              ['list', '📋 目录检索'],
              ['graph', '🌳 题—书思维导图'],
              ['advice', '🧭 学习路径建议'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <div
              key={key}
              onClick={() => setTab(key)}
              className={`cursor-pointer rounded-[10px] px-[18px] py-2.5 text-sm font-semibold shadow-[0_2px_14px_rgba(30,40,80,.08)] ${
                tab === key ? 'bg-[#4361ee] text-white' : 'bg-white text-[#6b7688]'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* 目录检索 */}
        {tab === 'list' && (
          <div>
            <div className="px-3.5 pt-1 pb-3 text-[13px] text-[#6b7688]">
              共匹配 <b>{filtered.length}</b> 个讲次{hasFilter ? '（已筛选）' : '（全部）'}
            </div>
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-[#6b7688]">
                没有匹配的目录，换个关键字或清空筛选试试。
              </div>
            ) : (
              byBook.map(({ bk, list }) => {
                const b = BOOKS[bk]
                return (
                  <div
                    key={bk}
                    className="mb-4 overflow-hidden rounded-[14px] bg-white shadow-[0_2px_14px_rgba(30,40,80,.08)]"
                  >
                    <div className="flex flex-wrap items-center gap-2.5 border-b border-[#e6e9f0] px-[18px] py-3">
                      <span
                        className="rounded-md px-2 py-0.5 text-[11px] text-white"
                        style={{ background: SERIES_COLOR[b.series] }}
                      >
                        {b.series}
                      </span>
                      <h4 className="m-0 text-base font-semibold">{b.full}</h4>
                      <span className="ml-auto text-xs text-[#6b7688]">
                        {b.note} · 整体难度 {stars(b.diff)} · 命中 {list.length} 讲
                      </span>
                    </div>
                    {list.map((l) => (
                      <div
                        key={l.no}
                        className="flex items-start gap-3 border-b border-[#f2f4f8] px-[18px] py-[11px] last:border-b-0"
                      >
                        <div className="min-w-[50px] text-[13px] font-bold text-[#4361ee]">
                          第{l.no}讲
                        </div>
                        <div className="flex-1">
                          <div className="text-[15px]">{highlight(l.title, kwTrim)}</div>
                          <div>
                            {l.tags.map((t) => (
                              <span
                                key={t}
                                className="mt-1 mr-1.5 inline-block rounded-md px-2 py-0.5 text-[11px] text-white"
                                style={{ background: tcolor(t) }}
                              >
                                {t}
                                {isCross(t) ? '' : ' ·单本'}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div
                          className="whitespace-nowrap text-[13px] tracking-wide text-[#f5a623]"
                          title={`难度 ${l.diff}/5`}
                        >
                          {stars(l.diff)}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* 思维导图 */}
        {tab === 'graph' && <CatalogTree lessons={filtered} selectedTopics={topics} />}

        {/* 学习路径建议 */}
        {tab === 'advice' && (
          <div>
            <div className="px-3.5 pt-1 pb-3 text-[13px] text-[#6b7688]">
              {topics.size ? (
                <>
                  显示已选 <b>{adviceKeys.length}</b> 个题型的学习路径
                </>
              ) : (
                <>
                  默认显示 <b>{adviceKeys.length}</b> 个跨书题型（点上方题型可单看；单本专题需手动选中）
                </>
              )}
            </div>
            {adviceKeys.map((t) => {
              const col = tcolor(t)
              const lessons = LESSONS.filter((l) => l.tags.includes(t)).sort(
                (a, b) => a.diff - b.diff || bookOrder(a.book) - bookOrder(b.book),
              )
              return (
                <div
                  key={t}
                  className="mb-3.5 overflow-hidden rounded-[14px] bg-white shadow-[0_2px_14px_rgba(30,40,80,.08)]"
                >
                  <div
                    className="flex flex-wrap items-center gap-2.5 px-[18px] py-3 text-white"
                    style={{ background: col }}
                  >
                    <h4 className="m-0 text-base font-semibold">{t}</h4>
                    {!isCross(t) && (
                      <span className="rounded-[5px] bg-[#95a5a6] px-1.5 py-px text-[10px] text-white">
                        单本专题
                      </span>
                    )}
                    <span className="ml-auto rounded-lg bg-white/20 px-2.5 py-[3px] text-[11px] opacity-90">
                      覆盖 {topicBookCount(t)} 本 / {lessons.length} 讲
                    </span>
                  </div>
                  <div className="px-[18px] py-3">
                    <div className="mb-2.5 rounded-lg border-l-4 border-[#4361ee] bg-[#f6f8ff] px-3 py-2 text-[13.5px]">
                      💡 {TOPIC[t][1]}
                    </div>
                    <div className="mb-1.5 text-xs text-[#6b7688]">推荐学习顺序（难度由易到难）：</div>
                    {lessons.map((l, i) => {
                      const b = BOOKS[l.book]
                      return (
                        <div
                          key={`${l.book}-${l.no}`}
                          className="flex items-center gap-2.5 border-b border-dashed border-[#eef0f5] py-1.5 text-[13px] last:border-b-0"
                        >
                          <span
                            className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-[11px] text-white"
                            style={{ background: col }}
                          >
                            {i + 1}
                          </span>
                          <span
                            className="flex-shrink-0 rounded-md px-[7px] py-0.5 text-[11px] text-white"
                            style={{ background: SERIES_COLOR[b.series] }}
                          >
                            {b.name}
                          </span>
                          <span>
                            第{l.no}讲 {l.title}
                          </span>
                          <span className="ml-auto whitespace-nowrap text-[13px] text-[#f5a623]">
                            {stars(l.diff)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
