'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase, useAuth, probeBaiduMedia, baiduResponseMessage } from '@rosie/core'
import { AppDialog, LinkButton } from '@rosie/ui'
import { ArrowLeft, Download, FileText, Folder, LoaderCircle } from 'lucide-react'
import { materialType } from '../../utils/lesson-material'

interface Material { name: string; id: string; directory: boolean }
interface Listing { files: Material[]; next: number | null }

type BrowserProps = {
  lessonKey: string
  file: Material | null
  setFile: (file: Material | null) => void
}

function PdfPreview({ src, title }: { src: string; title: string }) {
  const [loading, setLoading] = useState(true)
  return <div className="relative h-[58dvh]">
    <iframe title={title} src={src} className="h-full w-full" onLoad={() => setLoading(false)} />
    {loading && <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 bg-surface-dim text-sm text-text-secondary">
      <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />正在加载 PDF…
    </div>}
  </div>
}

function MaterialBrowser({ lessonKey, file, setFile }: BrowserProps) {
  const [path, setPath] = useState<string[]>([])
  const [offset, setOffset] = useState(0)
  const [retry, setRetry] = useState(0)
  const [listing, setListing] = useState<Listing | null>(null)
  const [error, setError] = useState('')
  const [fileCheck, setFileCheck] = useState<{ src: string; error: string } | null>(null)
  const [fileAttempt, setFileAttempt] = useState(0)
  const actionController = useRef<AbortController | null>(null)
  const params = new URLSearchParams({ lesson: lessonKey })
  for (const dir of path) params.append('dir', dir)
  const base = '/api/baidu/video/materials?' + params.toString()
  const src = file ? base + '&' + new URLSearchParams({ id: file.id, name: file.name }) : ''
  const mime = file ? materialType(file.name) : ''
  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal
    setListing(null)
    setError('')
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) throw Error('请重新登录后查看资料。')
      const session = await fetch('/api/baidu/video/session', { method: 'POST', signal,
        headers: { Authorization: 'Bearer ' + data.session.access_token } })
      if (!session.ok) throw Error(await baiduResponseMessage(session, '无法建立网盘会话，请稍后重试。'))
      const response = await fetch(base + '&start=' + offset, { signal, cache: 'no-store' })
      if (!response.ok) throw Error(response.status === 404 ? '本讲尚未绑定资料目录。' : await baiduResponseMessage(response, '资料读取失败，请重试。'))
      const page: Listing = await response.json()
      if (!signal.aborted) setListing(page)
    })().catch(cause => { if (!signal.aborted) setError(cause instanceof Error ? cause.message : '读取失败') })
    return () => controller.abort()
  }, [base, offset, retry])

  useEffect(() => {
    if (!src) return
    const controller = new AbortController()
    setFileCheck(null)
    void probeBaiduMedia(src, controller.signal).then(message => {
      if (!controller.signal.aborted) setFileCheck({ src, error: message ?? '' })
    }).catch(() => {
      if (!controller.signal.aborted) setFileCheck({ src, error: '无法读取资料，请检查网络后重试。' })
    })
    return () => controller.abort()
  }, [src, fileAttempt])

  useEffect(() => () => { actionController.current?.abort() }, [src])

  async function download() {
    if (!file) return
    actionController.current?.abort()
    const controller = new AbortController()
    actionController.current = controller
    try {
      const message = await probeBaiduMedia(src, controller.signal)
      if (controller.signal.aborted) return
      if (message) { setFileCheck({ src, error: message }); return }
      const link = document.createElement('a')
      link.href = src + '&download=1'
      link.download = file.name
      link.click()
    } catch { if (!controller.signal.aborted) setFileCheck({ src, error: '无法下载资料，请检查网络后重试。' }) }
  }
  function previewFailed() {
    actionController.current?.abort()
    const controller = new AbortController()
    actionController.current = controller
    void probeBaiduMedia(src, controller.signal).then(message => {
      if (!controller.signal.aborted) setFileCheck({ src, error: message ?? '资料暂时无法预览，可以尝试下载文件。' })
    }).catch(() => { if (!controller.signal.aborted) setFileCheck({ src, error: '资料读取失败，请检查网络后重试。' }) })
  }

  function navigate(next: string[]) {
    setPath(next)
    setOffset(0)
    setListing(null)
  }

  return <>
    {file ? <>
      <div className="mb-2 flex flex-wrap items-center gap-x-3">
        <p className="min-w-0 max-w-full break-all font-semibold">{file.name}</p>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <LinkButton onClick={() => { void download() }}><Download aria-hidden="true" className="size-4" />下载文件</LinkButton>
          <LinkButton onClick={() => setFile(null)}><ArrowLeft aria-hidden="true" className="size-4" />返回列表</LinkButton>
        </div>
      </div>
      {fileCheck?.src !== src ? <p role="status">正在检查资料…</p> : fileCheck.error
        ? <p role="alert">{fileCheck.error} <LinkButton onClick={() => setFileAttempt(v => v + 1)}>重试</LinkButton></p>
        : <>
          {mime.startsWith('image/') && <img src={src} alt={file.name} onError={previewFailed} className="mx-auto max-h-[58dvh] max-w-full object-contain" />}
          {mime.startsWith('video/') && <video controls playsInline src={src} onError={previewFailed} className="max-h-[58dvh] w-full bg-black" />}
          {mime.startsWith('audio/') && <audio controls src={src} onError={previewFailed} className="w-full" />}
          {mime === 'application/pdf' && <PdfPreview key={src} title={file.name} src={src} />}
        </>}
    </> : <>
      {path.length > 0 && <p className="break-all text-sm text-text-secondary">{['本讲目录', ...path].join(' / ')}</p>}
      {path.length > 0 && <button className="min-h-11 text-app-blue-dark" onClick={() => navigate(path.slice(0, -1))}>← 上一级</button>}
      {error ? <p role="alert">{error} <button className="min-h-11 text-app-blue-dark underline" onClick={() => setRetry(v => v + 1)}>重试</button></p>
        : !listing ? <p role="status" className="flex min-h-11 items-center gap-2 text-sm text-text-secondary"><LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />正在读取资料…</p> : <>
          {!listing.files.length && <p className="py-3">当前页没有文件</p>}
          <ul className="divide-y divide-border-light">{listing.files.map(item => <li key={item.id}>
            <button className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-dim"
              onClick={() => item.directory ? navigate([...path, item.name]) : setFile(item)}>
              {item.directory ? <Folder aria-hidden="true" className="size-4 shrink-0 text-app-blue-dark" /> : <FileText aria-hidden="true" className="size-4 shrink-0 text-text-secondary" />}
              <span className="break-all">{item.name}</span>
            </button>
          </li>)}</ul>
          <div className="flex gap-3">
            {offset > 0 && <button onClick={() => setOffset(offset - 100)}>上一页</button>}
            {listing.next !== null && <button onClick={() => setOffset(listing.next!)}>下一页</button>}
          </div>
        </>}
    </>}
  </>
}

export default function LessonMaterials({ lessonKey }: { lessonKey: string }) {
  const { user } = useAuth()
  const [file, setFile] = useState<Material | null>(null)
  if (!user) return null
  const folder = <Folder aria-hidden="true" className="size-5 text-app-blue-dark" />
  return <AppDialog key={user.id} title="本讲资料" icon={folder} size={file ? 'preview' : 'standard'}
    onOpenChange={open => { if (!open) setFile(null) }}
    trigger={<button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-light bg-surface px-4 text-sm font-semibold text-app-blue-dark hover:bg-surface-dim">
      {folder}本讲资料
    </button>}>
    <MaterialBrowser lessonKey={lessonKey} file={file} setFile={setFile} />
  </AppDialog>
}
