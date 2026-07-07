'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@rosie/core'
import {
  runMathLessonIdAudit,
  previewMigration,
  type MathLessonIdAuditReport,
} from '@rosie/math/admin/math-lesson-id-audit'

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
              查看 legacy ID → lessonKey 迁移将影响的所有 Supabase 数据
            </p>
          </div>
          <Link href="/admin" className="text-sm text-slate-500 hover:underline">
            ← 管理后台
          </Link>
        </div>

        <div className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm">
          <p>
            映射规则：<code className="rounded bg-slate-100 px-1">49-L1</code> →{' '}
            <code className="rounded bg-slate-100 px-1">2-1-L1</code>，路由{' '}
            <code className="rounded bg-slate-100 px-1">/math/ny/49</code> →{' '}
            <code className="rounded bg-slate-100 px-1">/math/ny/2/1</code>。
            本页只读，不修改数据。
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
            <Section title="总览">
              <KV k="受影响讲次数（有数据）" v={affectedLessons.length} />
              <KV k="legacy problem_id 相关行（估算）" v={report.totals.legacyProblemRows} />
              <KV k="legacy lesson_id 相关行（估算）" v={report.totals.legacyLessonIdRows} />
              <KV k="无讲次前缀的 problem_id" v={report.totals.orphanProblemRows} />
              <KV k="主键冲突风险" v={report.conflicts.length} warn={report.conflicts.length > 0} />
              <KV k="JSON 内 legacy 引用" v={report.jsonLegacyHits.length} />
              <KV k="math_problem_images 总行" v={report.totals.imageRows} />
              <KV k="math_weekly_plans" v={report.totals.weeklyPlanRows} />
              <KV k="math_quiz_papers" v={report.totals.quizPaperRows} />
              {(report.totals.quizPaperRows > 0 || report.totals.weeklyPlanRows > 0) && (
                <p className="text-xs text-amber-700">
                  组卷与周计划已确认可删除，迁移前跑 math-lesson-id-delete-disposable.sql，无需改 JSON。
                </p>
              )}
              <p className="mt-3 text-xs text-slate-500">{report.sourceCodeNote}</p>
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

            <Section title={`按讲次影响（${affectedLessons.length} 讲有数据）`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="p-2">legacy</th>
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
                        <td className="p-2 font-mono">{row.entry.lessonKey}</td>
                        <td className="p-2 font-mono">{report.mapping.find((m) => m.lessonKey === row.entry.lessonKey)?.newRoute}</td>
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

            <Section title="ID 映射表（26 讲）">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-left">
                      <th className="p-2">年级</th>
                      <th className="p-2">seq</th>
                      <th className="p-2">legacyId</th>
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

            <Section title={`JSON 字段中的 legacy 引用（${report.jsonLegacyHits.length}）`}>
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
                </li>
                <li>
                  <code className="rounded bg-slate-100 px-1">--storage</code> 复制 Storage 对象
                </li>
                <li>改源码题目 ID + 部署</li>
                <li>本页重新审计，确认 legacy 为 0</li>
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
      <span className={`font-mono ${warn ? 'text-red-600' : ''}`}>{v.toLocaleString()}</span>
    </div>
  )
}
