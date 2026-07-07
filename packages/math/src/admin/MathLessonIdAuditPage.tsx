'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import {
  runMathLessonIdAudit,
  previewMigration,
  type MathLessonIdAuditReport,
} from '@rosie/math/admin/math-lesson-id-audit'

const RISK_STYLES = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  red: 'border-red-200 bg-red-50 text-red-900',
} as const

export default function MathLessonIdAuditPage() {
  const { user } = useAuth()
  const [report, setReport] = useState<MathLessonIdAuditReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      setReport(await runMathLessonIdAudit())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `math-lesson-id-audit-${report.generatedAt.slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">请先登录后访问</p>
      </div>
    )
  }

  const affectedLessons = report?.byLesson.filter((r) => r.total > 0) ?? []

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-800">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">🧮 数学讲次 ID 迁移审计</h1>
            <p className="mt-1 text-sm text-slate-500">
              统计 Supabase 与已打包源码中 legacyId / slug 脏数据，评估收尾改造范围与风险
            </p>
          </div>
          <Link href="/admin" className="text-sm text-slate-500 hover:underline">
            ← 管理后台
          </Link>
        </div>

        <div className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm">
          <p>
            目标身份：<code className="rounded bg-slate-100 px-1">lessonKey</code>（如{' '}
            <code className="rounded bg-slate-100 px-1">2-4</code>）+{' '}
            <code className="rounded bg-slate-100 px-1">grade</code> /{' '}
            <code className="rounded bg-slate-100 px-1">seq</code>，路由{' '}
            <code className="rounded bg-slate-100 px-1">/math/ny/2/4</code>。本页只读，不修改数据。
            完整收尾步骤见{' '}
            <code className="rounded bg-slate-100 px-1">docs/math/lesson-id-cleanup.md</code>。
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="rounded-lg bg-teal-600 px-5 py-2.5 font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? '扫描中…' : '🔍 开始审计'}
          </button>
          {report && (
            <button
              type="button"
              onClick={downloadReport}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              下载 JSON 报告
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">出错：{error}</div>
        )}

        {report && (
          <div className="space-y-5">
            <div className={`rounded-xl border p-5 shadow-sm ${RISK_STYLES[report.risk.level]}`}>
              <h2 className="text-lg font-semibold">风险与可控性</h2>
              <p className="mt-2 font-medium">{report.risk.headline}</p>
              <p className="mt-1 text-sm opacity-90">
                可控性判断：{report.risk.controllable ? '是 — 可按分阶段方案推进' : '需先处理阻塞项'}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <StatCard label="DB 未清理（估算）" value={report.totals.dbUncleanedTotal} />
                <StatCard label="源码未清理（估算）" value={report.totals.sourceUncleanedTotal} />
                <StatCard label="合计" value={report.totals.grandUncleanedTotal} bold />
              </div>
              {report.risk.blockers.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold">阻塞项</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {report.risk.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}
              {report.risk.mitigations.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold">缓解措施</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {report.risk.mitigations.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4">
                <p className="text-sm font-semibold">改造涉及范围</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {report.risk.scopeLines.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            <Section title="未清理数据总览">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Supabase（DB）</h3>
              <KV k="legacy problem_id 相关行" v={report.totals.legacyProblemRows} warn={report.totals.legacyProblemRows > 0} />
              <KV k="legacy lesson_id 列" v={report.totals.legacyLessonIdRows} warn={report.totals.legacyLessonIdRows > 0} />
              <KV k="Storage 路径含 /{legacyId}/" v={report.totals.legacyStoragePathRows} warn={report.totals.legacyStoragePathRows > 0} />
              <KV k="Storage 路径含 slug（lessonNN）" v={report.totals.legacySlugStorageRows} warn={report.totals.legacySlugStorageRows > 0} />
              <KV k="JSON 字段 legacy/slug 引用" v={report.totals.jsonLegacyHitRows} warn={report.totals.jsonLegacyHitRows > 0} />
              <KV k="迁移主键冲突风险" v={report.conflicts.length} warn={report.conflicts.length > 0} />
              <KV k="DB 小计" v={report.totals.dbUncleanedTotal} warn={report.totals.dbUncleanedTotal > 0} />

              <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-700">已打包源码（浏览器内扫描）</h3>
              <KV k="legacyId 类脏点" v={report.totals.sourceLegacyIdHits} warn={report.totals.sourceLegacyIdHits > 0} />
              <KV k="slug 类脏点" v={report.totals.sourceSlugHits} warn={report.totals.sourceSlugHits > 0} />
              <KV k="题目数据 canonical problem_id" v={report.source.totals.bundledProblemIdsCanonical} />
              <KV k="题目数据 legacy problem_id" v={report.source.totals.bundledProblemIdsLegacy} warn={report.source.totals.bundledProblemIdsLegacy > 0} />
              <KV k="源码小计" v={report.totals.sourceUncleanedTotal} warn={report.totals.sourceUncleanedTotal > 0} />

              <div className="mt-3 flex justify-between border-t border-slate-200 pt-2 font-semibold">
                <span>未清理合计（估算）</span>
                <span className={`font-mono ${report.totals.grandUncleanedTotal > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {report.totals.grandUncleanedTotal.toLocaleString()}
                </span>
              </div>

              <p className="mt-3 text-xs text-slate-500">{report.sourceCodeNote}</p>
            </Section>

            <Section title={`源码脏数据明细（${report.source.buckets.length} 类）`}>
              <div className="space-y-3">
                {report.source.buckets.map((b) => (
                  <div
                    key={b.id}
                    className={`rounded-lg border p-3 text-sm ${b.count > 0 ? 'border-amber-200 bg-amber-50/40' : 'border-slate-100'}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{b.label}</span>
                      <span className={`font-mono text-xs ${b.count > 0 ? 'text-amber-800' : 'text-slate-400'}`}>
                        {b.count === 0 ? '✅ 0' : `${b.count} 处`}
                      </span>
                    </div>
                    {b.locations.length > 0 && (
                      <p className="mt-1 font-mono text-xs text-slate-500">{b.locations.join(' · ')}</p>
                    )}
                    {b.samples.length > 0 && b.count > 0 && (
                      <ul className="mt-2 space-y-0.5 font-mono text-xs text-slate-600">
                        {b.samples.map((s) => (
                          <li key={s} className="truncate">
                            {s}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            <Section title={`待改文件清单（${report.source.manualSites.length}，含 apps/web）`}>
              <p className="mb-3 text-xs text-slate-500">
                以下位置无法从浏览器自动验证是否已改完，收尾时需人工对照或跑 rg；与 cleanup 文档 Phase 1 一致。
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="p-2">路径</th>
                      <th className="p-2">内容</th>
                      <th className="p-2">ID 类型</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.source.manualSites.map((site) => (
                      <tr key={site.path} className="border-b border-slate-100">
                        <td className="p-2 font-mono">{site.path}</td>
                        <td className="p-2">{site.what}</td>
                        <td className="p-2 font-mono">{site.idKind}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title={`应删除的静态 legacy 路由（${report.source.legacyRoutes.length} 讲）`}>
              <p className="mb-3 text-xs text-slate-500">
                若仓库中仍存在左侧 legacy 目录，与 canonical 动态路由双轨并存，属未清理范围。
              </p>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="p-2">legacyId</th>
                      <th className="p-2">lessonKey</th>
                      <th className="p-2">旧路由</th>
                      <th className="p-2">canonical</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.source.legacyRoutes.map((r) => (
                      <tr key={r.lessonKey} className="border-b border-slate-100">
                        <td className="p-2 font-mono">{r.legacyId}</td>
                        <td className="p-2 font-mono">{r.lessonKey}</td>
                        <td className="p-2 font-mono text-red-700/80">{r.legacyRoute}</td>
                        <td className="p-2 font-mono text-teal-700">{r.canonicalRoute}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="数据库表状态">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="p-2">表</th>
                      <th className="p-2">存在</th>
                      <th className="p-2 text-right">行数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.tables.map((t) => (
                      <tr key={t.table} className="border-b border-slate-100">
                        <td className="p-2 font-mono text-xs">{t.table}</td>
                        <td className="p-2">{t.exists ? '✅' : '—'}</td>
                        <td className="p-2 text-right font-mono">{t.rowCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title={`按讲次 DB 影响（${affectedLessons.length} 讲有数据）`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="p-2">legacy</th>
                      <th className="p-2">slug</th>
                      <th className="p-2">lessonKey</th>
                      <th className="p-2">新路由</th>
                      <th className="p-2 text-right">solved</th>
                      <th className="p-2 text-right">wrong</th>
                      <th className="p-2 text-right">images</th>
                      <th className="p-2 text-right">周计划</th>
                      <th className="p-2 text-right">合计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byLesson.map((row) => (
                      <tr
                        key={row.entry.lessonKey}
                        className={row.total > 0 ? 'bg-amber-50/50' : 'text-slate-400'}
                      >
                        <td className="p-2 font-mono">{row.entry.legacyId}</td>
                        <td className="p-2 font-mono text-slate-500">{row.entry.slug}</td>
                        <td className="p-2 font-mono">{row.entry.lessonKey}</td>
                        <td className="p-2 font-mono">
                          {report.mapping.find((m) => m.lessonKey === row.entry.lessonKey)?.newRoute}
                        </td>
                        <td className="p-2 text-right">{row.problemIds.solved}</td>
                        <td className="p-2 text-right">{row.problemIds.wrong}</td>
                        <td className="p-2 text-right">{row.problemIds.images}</td>
                        <td className="p-2 text-right">{row.lessonIdRows.weeklyPlans}</td>
                        <td className="p-2 text-right font-semibold">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title="ID 映射表（含 slug）">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="p-2">年级</th>
                      <th className="p-2">seq</th>
                      <th className="p-2">legacyId</th>
                      <th className="p-2">slug</th>
                      <th className="p-2">lessonKey</th>
                      <th className="p-2">示例 problem_id</th>
                      <th className="p-2">新路由</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.mapping.map((m) => (
                      <tr key={m.lessonKey} className="border-b border-slate-100">
                        <td className="p-2">g{m.grade}</td>
                        <td className="p-2">{m.seq}</td>
                        <td className="p-2 font-mono">{m.legacyId}</td>
                        <td className="p-2 font-mono text-slate-500">{m.slug}</td>
                        <td className="p-2 font-mono">{m.lessonKey}</td>
                        <td className="p-2 font-mono text-teal-700">
                          {m.legacyId}-L1 → {previewMigration(`${m.legacyId}-L1`)}
                        </td>
                        <td className="p-2 font-mono">{m.newRoute}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section title={`无讲次前缀的 problem_id（${report.orphans.length}）`}>
              {report.orphans.length === 0 ? (
                <p className="text-green-600">✅ 无</p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-auto font-mono text-xs">
                  {report.orphans.map((o) => (
                    <li key={o.problemId}>
                      <span className="font-semibold">{o.problemId}</span>
                      <span className="ml-2 text-slate-500">
                        solved={o.solved} wrong={o.wrong}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={`迁移主键冲突（${report.conflicts.length}）`}>
              {report.conflicts.length === 0 ? (
                <p className="text-green-600">✅ 未发现同一用户 old/new problem_id 并存</p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-auto font-mono text-xs text-red-700">
                  {report.conflicts.map((c, i) => (
                    <li key={`${c.userId}-${c.oldProblemId}-${i}`}>
                      {c.table}: {c.oldProblemId} → {c.newProblemId}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={`JSON 字段中的 legacy/slug 引用（${report.jsonLegacyHits.length}）`}>
              {report.jsonLegacyHits.length === 0 ? (
                <p className="text-green-600">✅ 未检测到（或表为空）</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-auto text-xs">
                  {report.jsonLegacyHits.map((h, i) => (
                    <li key={`${h.table}-${h.rowKey}-${i}`} className="rounded bg-slate-50 p-2">
                      <div className="font-mono font-semibold">
                        {h.table} · {h.rowKey} · {h.field}
                      </div>
                      <div className="mt-1 break-all text-slate-500">{h.sample}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={`Storage 路径 slug/legacy 样本（${report.slugStorageHits.length}）`}>
              {report.slugStorageHits.length === 0 ? (
                <p className="text-green-600">✅ 未检测到含 lessonNN 或 legacy 目录的样本</p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-auto font-mono text-xs">
                  {report.slugStorageHits.map((h, i) => (
                    <li key={`${h.storagePath}-${i}`}>
                      <span className="text-slate-500">{h.lessonKey}</span> · {h.storagePath}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="推荐迁移顺序">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
                <li>Supabase 备份</li>
                <li>
                  清空可丢弃数据（组卷 + 周计划）：{' '}
                  <code className="rounded bg-slate-100 px-1">docs/sql/math-lesson-id-delete-disposable.sql</code>
                </li>
                <li>
                  运行 <code className="rounded bg-slate-100 px-1">docs/sql/math-lesson-id-migrate.sql</code>
                </li>
                <li>
                  <code className="rounded bg-slate-100 px-1">node scripts/migrate-math-lesson-ids.mjs --apply</code>
                  {' '}
                  <code className="rounded bg-slate-100 px-1">--storage</code>
                </li>
                <li>按 <code className="rounded bg-slate-100 px-1">docs/math/lesson-id-cleanup.md</code> 改源码并部署</li>
                <li>本页重新审计，确认 DB + 源码未清理合计为 0</li>
              </ol>
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  )
}

function KV({ k, v, warn }: { k: string; v: number; warn?: boolean }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1.5">
      <span className="text-slate-600">{k}</span>
      <span className={`font-mono ${warn ? 'text-amber-700' : ''}`}>{v.toLocaleString()}</span>
    </div>
  )
}

function StatCard({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="rounded-lg bg-white/60 px-3 py-2">
      <div className="text-xs opacity-80">{label}</div>
      <div className={`font-mono text-xl ${bold ? 'font-bold' : ''}`}>{value.toLocaleString()}</div>
    </div>
  )
}
