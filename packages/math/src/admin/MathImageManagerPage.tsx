'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import type { Problem } from '@rosie/core'
import {
  GRADE_LABEL,
  gradesInOrder,
  lessonDisplayLabel,
  lessonsForGrade,
} from '@rosie/math/utils/lesson-grade'
import { SEA_LESSONS } from '@rosie/math/utils/sea-data'
import { flattenProblemSet, problemSectionLabel } from '@rosie/math/utils/problem-set-helpers'
import {
  MATH_IMAGE_KIND_LABEL,
  type MathImageKind,
} from '@rosie/math/constants'
import { useMathProblemImagesAdmin } from '@rosie/math/hooks/useMathProblemImagesAdmin'

type Props = { user: User | null }

const MAX_FILE_MB = 20
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

function imageStatus(
  problemId: string,
  findImage: (problemId: string, kind: MathImageKind) => { storagePath: string } | undefined,
): { analysis: boolean; figure: boolean } {
  return {
    analysis: !!findImage(problemId, 'analysis'),
    figure: !!findImage(problemId, 'figure'),
  }
}

export default function MathImageManagerPage({ user }: Props) {
  const grades = gradesInOrder()
  const defaultLesson = lessonsForGrade(grades[grades.length - 1] ?? 2)[0] ?? '55'

  const [selectedLesson, setSelectedLesson] = useState(defaultLesson)
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null)
  const [imageKind, setImageKind] = useState<MathImageKind>('analysis')
  const [flash, setFlash] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const admin = useMathProblemImagesAdmin(user, selectedLesson)

  const lessonMeta = useMemo(
    () => SEA_LESSONS.find((l) => l.id === selectedLesson),
    [selectedLesson],
  )

  const problems = useMemo(() => {
    if (!lessonMeta) return []
    const all = flattenProblemSet(lessonMeta.problems)
    const q = filter.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        problemSectionLabel(p.id).includes(q),
    )
  }, [lessonMeta, filter])

  function showFlash(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(null), 2200)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !selectedProblem) return

    if (file.size > MAX_FILE_BYTES) {
      showFlash(`文件过大（最大 ${MAX_FILE_MB} MB）`)
      return
    }

    const { error } = await admin.uploadImage(selectedProblem.id, imageKind, file)
    if (error) showFlash(`上传失败：${error}`)
    else showFlash('上传成功')
  }

  async function handleDelete() {
    if (!selectedProblem) return
    const row = admin.findImage(selectedProblem.id, imageKind)
    if (!row) return
    if (!window.confirm(`确定删除 ${selectedProblem.id} 的${MATH_IMAGE_KIND_LABEL[imageKind]}？`)) return

    const { error } = await admin.removeImage(row)
    if (error) showFlash(`删除失败：${error}`)
    else showFlash('已删除')
  }

  const currentImage = selectedProblem ? admin.findImage(selectedProblem.id, imageKind) : undefined
  const currentUrl = currentImage ? admin.getImageUrl(currentImage.storagePath) : null
  const staticAnalysis = selectedProblem?.analysisImg ?? null

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <div className="text-4xl opacity-30">🔐</div>
        <div className="text-sm text-slate-500">请先登录</div>
        <Link
          href="/auth"
          className="rounded-full px-4 py-2 text-[13px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#0d9488,#0f766e)' }}
        >
          去登录
        </Link>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen pb-16"
      style={{ background: 'linear-gradient(160deg,#ecfdf5 0%,#f0fdfa 40%,#eff6ff 100%)' }}
    >
      <header
        className="sticky top-0 z-30 backdrop-blur"
        style={{
          background: 'rgba(255,255,255,0.9)',
          borderBottom: '1px solid rgba(13,148,136,0.15)',
          boxShadow: '0 1px 12px rgba(0,0,0,0.04)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-3 px-4">
          <Link
            href="/admin"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-teal-700 transition hover:scale-110"
            style={{ background: 'rgba(13,148,136,0.10)', border: '1.5px solid rgba(13,148,136,0.25)' }}
            aria-label="返回管理后台"
          >
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-extrabold text-teal-900">📐 数学题图</div>
            <div className="truncate text-[11px] text-slate-500">上传题解图 / 题面图，线上即时生效</div>
          </div>
        </div>
      </header>

      {flash && (
        <div className="pointer-events-none fixed top-16 left-1/2 z-50 -translate-x-1/2 rounded-full bg-teal-800 px-4 py-2 text-[13px] font-semibold text-white shadow-lg">
          {flash}
        </div>
      )}

      <main className="mx-auto grid max-w-[1100px] gap-4 px-4 py-5 lg:grid-cols-[240px_1fr_320px]">
        {/* Lesson picker */}
        <aside className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
          <div className="mb-2 text-[12px] font-bold text-slate-500">选择讲次</div>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto">
            {grades.map((grade) => (
              <div key={grade}>
                <div className="mb-1 px-1 text-[11px] font-bold text-teal-700">{GRADE_LABEL[grade]}</div>
                <div className="flex flex-wrap gap-1.5">
                  {lessonsForGrade(grade).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setSelectedLesson(id)
                        setSelectedProblem(null)
                      }}
                      className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${
                        selectedLesson === id
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                      }`}
                    >
                      {lessonDisplayLabel(id, true)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Problem list */}
        <section className="rounded-2xl border border-teal-100 bg-white/90 p-3 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-extrabold text-slate-800">
              {lessonMeta?.title ?? `第 ${selectedLesson} 讲`}
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
              {problems.length} 题
            </span>
          </div>

          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="搜索题号或标题…"
            className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-teal-400"
          />

          {admin.isLoading ? (
            <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">加载中…</div>
          ) : (
            <ul className="max-h-[65vh] space-y-1 overflow-y-auto">
              {problems.map((p) => {
                const status = imageStatus(p.id, admin.findImage)
                const active = selectedProblem?.id === p.id
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedProblem(p)}
                      className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition ${
                        active ? 'bg-teal-50 ring-1 ring-teal-300' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] font-bold text-teal-700">{p.id}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            {problemSectionLabel(p.id)}
                          </span>
                        </div>
                        <div className="truncate text-[12px] text-slate-700">{p.title}</div>
                      </div>
                      <div className="flex shrink-0 gap-1 pt-0.5">
                        <span
                          title="题解图"
                          className={`rounded px-1 text-[10px] font-bold ${
                            status.analysis || p.analysisImg
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          解
                        </span>
                        <span
                          title="题面图"
                          className={`rounded px-1 text-[10px] font-bold ${
                            status.figure || p.figureNode
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          面
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Upload panel */}
        <aside className="rounded-2xl border border-teal-100 bg-white/90 p-4 shadow-sm">
          {!selectedProblem ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="text-3xl opacity-40">👈</div>
              <div className="text-[13px] text-slate-500">从左侧列表选择一道题</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="font-mono text-[12px] font-bold text-teal-700">{selectedProblem.id}</div>
                <div className="text-[13px] font-semibold text-slate-800">{selectedProblem.title}</div>
              </div>

              <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                {(['analysis', 'figure'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setImageKind(kind)}
                    className={`flex-1 rounded-lg py-2 text-[12px] font-bold transition ${
                      imageKind === kind ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    {MATH_IMAGE_KIND_LABEL[kind]}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-dashed border-teal-200 bg-teal-50/50 p-3">
                {currentUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUrl}
                    alt={selectedProblem.title}
                    className="mx-auto max-h-48 w-full rounded-lg object-contain"
                  />
                ) : imageKind === 'analysis' && staticAnalysis ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={staticAnalysis}
                    alt={selectedProblem.title}
                    className="mx-auto max-h-48 w-full rounded-lg object-contain opacity-80"
                  />
                ) : (
                  <div className="py-10 text-center text-[12px] text-slate-400">暂无图片</div>
                )}

                {imageKind === 'analysis' && !currentUrl && staticAnalysis && (
                  <p className="mt-2 text-center text-[10px] text-amber-600">
                    当前使用代码内置路径（上传后将覆盖）
                  </p>
                )}
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleFile}
              />

              <button
                type="button"
                disabled={admin.isUploading}
                onClick={() => inputRef.current?.click()}
                className="w-full rounded-xl bg-teal-600 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
              >
                {admin.isUploading ? '上传中…' : currentUrl ? '替换图片' : '上传图片'}
              </button>

              {currentUrl && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  className="w-full rounded-xl border border-red-200 py-2 text-[12px] font-semibold text-red-600 transition hover:bg-red-50"
                >
                  删除云端图片
                </button>
              )}

              <p className="text-[10px] leading-relaxed text-slate-400">
                题解图显示在「查看题解」面板内；题面图显示在题目文字下方。支持 PNG / JPG / WEBP，最大 {MAX_FILE_MB} MB。
              </p>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}
