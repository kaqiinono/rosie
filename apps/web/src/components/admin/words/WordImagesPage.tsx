'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { supabase, useAuth } from '@rosie/core'
import type { WordEntry } from '@rosie/core'
import {
  getAllStages,
  getWordImagePublicUrl,
  useWordData,
  wordEntriesStore,
} from '@rosie/english'

type SortMode = 'score-asc' | 'score-desc' | 'word'

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('未登录')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function postWordImage(body: Record<string, unknown>) {
  const headers = await authHeaders()
  const res = await fetch('/api/word-image', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : `HTTP ${res.status}`)
  return json
}

function scoreColor(score: number | undefined): string {
  if (score == null) return 'bg-slate-200'
  if (score < 50) return 'bg-red-400'
  if (score < 75) return 'bg-amber-400'
  return 'bg-emerald-400'
}

export default function WordImagesPage() {
  const { user } = useAuth()
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        请先登录
      </div>
    )
  }
  return <WordImagesPageInner user={user} />
}

function WordImagesPageInner({ user }: { user: User }) {
  const { vocab, isLoading } = useWordData(user)
  const stages = useMemo(() => getAllStages(vocab), [vocab])

  const [stage, setStage] = useState('5A')
  const [unit, setUnit] = useState('Unit 1')
  const [lesson, setLesson] = useState('')
  const [sort, setSort] = useState<SortMode>('score-asc')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageTone, setMessageTone] = useState<'ok' | 'err'>('ok')
  const [queryEdits, setQueryEdits] = useState<Record<string, string>>({})
  /** Bust browser/CDN cache when Storage path is reused (upsert). */
  const [imageBust, setImageBust] = useState<Record<string, number>>({})
  const [preview, setPreview] = useState<{ src: string; word: string } | null>(null)
  const [batchProgress, setBatchProgress] = useState<{
    done: number
    total: number
    word: string
  } | null>(null)

  const units = useMemo(() => {
    const set = new Set(
      vocab.filter((w) => (stage ? w.stage === stage : true)).map((w) => w.unit),
    )
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [vocab, stage])

  const lessons = useMemo(() => {
    const set = new Set(
      vocab
        .filter((w) => (!stage || w.stage === stage) && (!unit || w.unit === unit))
        .map((w) => w.lesson),
    )
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [vocab, stage, unit])

  const rows = useMemo(() => {
    let list = vocab.filter((w) => {
      if (stage && w.stage !== stage) return false
      if (unit && w.unit !== unit) return false
      if (lesson && w.lesson !== lesson) return false
      return true
    })
    list = [...list].sort((a, b) => {
      if (sort === 'word') return a.word.localeCompare(b.word)
      const sa = a.imageMatchScore ?? (a.imagePath ? 50 : -1)
      const sb = b.imageMatchScore ?? (b.imagePath ? 50 : -1)
      return sort === 'score-asc' ? sa - sb : sb - sa
    })
    return list
  }, [vocab, stage, unit, lesson, sort])

  const entryKey = (w: WordEntry) => `${w.stage ?? ''}::${w.unit}::${w.lesson}::${w.word}`

  const showOk = (text: string) => {
    setMessageTone('ok')
    setMessage(text)
  }
  const showErr = (text: string) => {
    setMessageTone('err')
    setMessage(text)
  }

  /** API already wrote DB — only sync local store (avoid a second client update). */
  const patchStore = (original: WordEntry, patch: Partial<WordEntry>) => {
    const updated = { ...original, ...patch }
    wordEntriesStore.patchSessionData(user.id, (prev) =>
      prev.map((x) =>
        x.unit === original.unit &&
        x.lesson === original.lesson &&
        x.word === original.word &&
        (x.stage ?? '') === (original.stage ?? '')
          ? updated
          : x,
      ),
    )
  }

  const bustImage = (w: WordEntry) => {
    const k = entryKey(w)
    setImageBust((prev) => ({ ...prev, [k]: Date.now() }))
  }

  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(null)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [preview])

  const runBatch = async () => {
    // Same skip rule as /api/word-image batch: keep uploads & existing paths.
    const targets = rows.filter((w) => !(w.imageSource === 'upload' || w.imagePath))
    if (targets.length === 0) {
      showOk('当前列表均已有配图，无需处理')
      return
    }

    setBusy(true)
    setMessage(null)
    setBatchProgress({ done: 0, total: targets.length, word: targets[0]!.word })
    showOk(`配图中：0/${targets.length}`)

    let ok = 0
    let fail = 0
    try {
      for (let i = 0; i < targets.length; i++) {
        const w = targets[i]!
        setBatchProgress({ done: i, total: targets.length, word: w.word })
        showOk(`配图中：${i}/${targets.length} · ${w.word}`)
        try {
          const json = await postWordImage({
            action: 'match',
            stage: w.stage ?? '',
            unit: w.unit,
            lesson: w.lesson,
            word: w.word,
            explanation: w.explanation,
          })
          patchStore(w, {
            imagePath: json.imagePath as string,
            imageMatchScore: json.imageMatchScore as number,
            imageMatchQuery: json.imageMatchQuery as string,
            imagePexelsId: json.imagePexelsId as string,
            imageSource: 'pexels',
          })
          bustImage(w)
          ok++
        } catch {
          fail++
        }
        setBatchProgress({ done: i + 1, total: targets.length, word: w.word })
        showOk(`配图中：${i + 1}/${targets.length} · ${w.word}`)
      }
      const skipped = rows.length - targets.length
      showOk(
        `批量完成：成功 ${ok}，失败 ${fail}` +
          (skipped > 0 ? `，跳过 ${skipped}` : '') +
          `（共 ${targets.length} 需配图）`,
      )
    } catch (e) {
      showErr(`批量失败：${(e as Error).message}`)
    } finally {
      setBatchProgress(null)
      setBusy(false)
    }
  }

  const rematch = async (w: WordEntry, opts?: { query?: string; next?: boolean }) => {
    setBusy(true)
    setMessage(null)
    try {
      const json = await postWordImage({
        action: 'match',
        stage: w.stage ?? '',
        unit: w.unit,
        lesson: w.lesson,
        word: w.word,
        explanation: w.explanation,
        query: opts?.query,
        excludePexelsIds: opts?.next && w.imagePexelsId ? [w.imagePexelsId] : undefined,
      })
      patchStore(w, {
        imagePath: json.imagePath as string,
        imageMatchScore: json.imageMatchScore as number,
        imageMatchQuery: json.imageMatchQuery as string,
        imagePexelsId: json.imagePexelsId as string,
        imageSource: 'pexels',
      })
      bustImage(w)
      showOk(`已更新：${w.word}`)
    } catch (e) {
      showErr(`${w.word} 失败：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const clearImage = async (w: WordEntry) => {
    setBusy(true)
    setMessage(null)
    try {
      await postWordImage({
        action: 'clear',
        stage: w.stage ?? '',
        unit: w.unit,
        lesson: w.lesson,
        word: w.word,
        imagePath: w.imagePath,
      })
      patchStore(w, {
        imagePath: undefined,
        imageMatchScore: undefined,
        imageMatchQuery: undefined,
        imagePexelsId: undefined,
        imageSource: undefined,
      })
      showOk(`已清除：${w.word}`)
    } catch (e) {
      showErr(`清除失败：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const uploadImage = async (w: WordEntry, file: File) => {
    setBusy(true)
    setMessage(null)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = String(reader.result ?? '')
          const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1]! : dataUrl
          resolve(b64)
        }
        reader.onerror = () => reject(new Error('读取文件失败'))
        reader.readAsDataURL(file)
      })
      const json = await postWordImage({
        action: 'upload',
        stage: w.stage ?? '',
        unit: w.unit,
        lesson: w.lesson,
        word: w.word,
        contentType: file.type || 'image/jpeg',
        base64,
      })
      // Show feedback immediately — Storage path is stable, so bust cache or <img> stays stale.
      patchStore(w, {
        imagePath: json.imagePath as string,
        imageMatchScore: undefined,
        imageMatchQuery: undefined,
        imagePexelsId: undefined,
        imageSource: 'upload',
      })
      bustImage(w)
      showOk(`已上传：${w.word}`)
    } catch (e) {
      showErr(`上传失败：${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/admin" className="text-sm text-slate-500 hover:underline">
            ← Admin
          </Link>
          <h1 className="text-lg font-extrabold">单词配图</h1>
          <span className="text-xs text-slate-400">{isLoading ? '加载中…' : `${rows.length} 词`}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold"
              value={stage}
              onChange={(e) => {
                setStage(e.target.value)
                setUnit('Unit 1')
                setLesson('')
              }}
            >
              {(stages.includes('5A') ? stages : ['5A', ...stages]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold"
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value)
                setLesson('')
              }}
            >
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
            >
              <option value="">全部 Lesson</option>
              {lessons.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="score-asc">分数 ↑（先看差的）</option>
              <option value="score-desc">分数 ↓</option>
              <option value="word">单词 A–Z</option>
            </select>
            <button
              type="button"
              disabled={busy || !unit}
              onClick={() => void runBatch()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-extrabold text-white shadow disabled:opacity-50"
            >
              {batchProgress
                ? `配图中 ${batchProgress.done}/${batchProgress.total}`
                : busy
                  ? '处理中…'
                  : '为当前列表自动配图'}
            </button>
          </div>
        </div>
        {message && (
          <div
            className={`border-t px-4 py-2 text-center text-sm font-bold ${
              messageTone === 'ok'
                ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                : 'border-red-100 bg-red-50 text-red-700'
            }`}
          >
            {message}
          </div>
        )}
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((w) => {
          const k = entryKey(w)
          const q = queryEdits[k] ?? w.imageMatchQuery ?? ''
          const bust = imageBust[k]
          const base = w.imagePath ? getWordImagePublicUrl(w.imagePath) : ''
          const src = base ? (bust ? `${base}?v=${bust}` : base) : ''
          return (
            <article
              key={k}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="relative aspect-[4/3] w-full shrink-0 bg-slate-100">
                {src ? (
                  <button
                    type="button"
                    onClick={() => setPreview({ src, word: w.word })}
                    className="group absolute inset-0 cursor-zoom-in"
                    aria-label={`放大预览 ${w.word}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      key={src}
                      src={src}
                      alt={w.word}
                      className="h-full w-full object-contain"
                    />
                    <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      点击放大
                    </span>
                  </button>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                    无配图
                  </span>
                )}
                <div className="pointer-events-none absolute top-2 right-2 z-10 rounded-md bg-black/70 px-2 py-1 text-[12px] font-black text-white tabular-nums shadow">
                  {w.imageMatchScore != null ? `${w.imageMatchScore}` : '—'}
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100">
                <div
                  className={`h-full ${scoreColor(w.imageMatchScore)}`}
                  style={{ width: `${Math.max(0, Math.min(100, w.imageMatchScore ?? 0))}%` }}
                />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-[15px] font-black">{w.word}</h2>
                  <span className="text-[12px] font-extrabold tabular-nums text-slate-600">
                    匹配度 {w.imageMatchScore != null ? w.imageMatchScore : '—'}
                  </span>
                  {w.vocabType && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-slate-500 uppercase">
                      {w.vocabType}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">
                    {w.lesson}
                    {w.imageSource ? ` · ${w.imageSource}` : ''}
                  </span>
                </div>
                <p className="line-clamp-2 text-[12px] leading-relaxed text-slate-600">{w.explanation}</p>
                {w.chineseDef && (
                  <p className="line-clamp-1 text-[12px] text-slate-400">{w.chineseDef}</p>
                )}
                <label className="block text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                  搜索词
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[13px] font-normal text-slate-700 normal-case"
                    value={q}
                    onChange={(e) => setQueryEdits((prev) => ({ ...prev, [k]: e.target.value }))}
                    placeholder="改词后点重搜"
                  />
                </label>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void rematch(w, { next: true })}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[12px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    换一张
                  </button>
                  <button
                    type="button"
                    disabled={busy || !q.trim()}
                    onClick={() => void rematch(w, { query: q.trim() })}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[12px] font-bold text-indigo-700 disabled:opacity-50"
                  >
                    改词重搜
                  </button>
                  <label className="cursor-pointer rounded-lg border border-slate-200 px-2 py-1 text-[12px] font-bold text-slate-600 hover:bg-slate-50">
                    上传
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void uploadImage(w, f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || !w.imagePath}
                    onClick={() => void clearImage(w)}
                    className="rounded-lg border border-red-200 px-2 py-1 text-[12px] font-bold text-red-600 disabled:opacity-50"
                  >
                    清除
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </main>

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${preview.word} 配图预览`}
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-[9999] flex cursor-zoom-out items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.src}
            alt={preview.word}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] max-w-[96vw] cursor-default rounded-lg bg-white object-contain shadow-2xl"
          />
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 right-4 flex items-center gap-2"
          >
            <span className="rounded-full bg-white/95 px-3 py-2 text-sm font-bold text-slate-700 shadow-lg">
              {preview.word}
            </span>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/95 text-xl font-bold text-gray-700 shadow-lg transition hover:bg-white"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
