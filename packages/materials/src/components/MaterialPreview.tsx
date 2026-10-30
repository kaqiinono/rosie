'use client'
import { useState } from 'react'
import { supabase } from '@rosie/core'
import type { MaterialAsset } from '../types'
import { buttonClass } from './styles'
export function MaterialPreview({ asset }: { asset: MaterialAsset }) {
  const [content, setContent] = useState<{
    text?: string
    url?: string
    download_url?: string
  } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function download() {
    setBusy(true)
    setError('')
    try {
      const { data } = await supabase.auth.getSession()
      const response = await fetch(`/api/materials/${asset.id}/access?download=1`, {
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      })
      if (!response.ok) throw Error('下载失败，请重试')
      const url = URL.createObjectURL(await response.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `${asset.title}.txt`
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '下载失败')
    } finally {
      setBusy(false)
    }
  }
  async function load() {
    setBusy(true)
    setError('')
    try {
      const { data } = await supabase.auth.getSession()
      const response = await fetch(`/api/materials/${asset.id}/access`, {
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      })
      if (!response.ok) throw Error('暂时无法打开，请重试')
      setContent(await response.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : '打开失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-2">
      <button type="button" className={buttonClass} disabled={busy} onClick={() => void load()}>
        {busy ? '读取中…' : '查看物料'}
      </button>
      {error && <p role="alert">{error}</p>}
      {content && (
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          {asset.kind === 'text' && (
            <button
              type="button"
              className={buttonClass}
              disabled={busy}
              onClick={() => void download()}
            >
              下载文本
            </button>
          )}
          {content.text && <p className="break-words whitespace-pre-wrap">{content.text}</p>}
          {content.url && (
            <a
              className="text-emerald-800 underline"
              href={content.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              打开链接 ↗
            </a>
          )}
          {content.download_url && (
            <a className="ml-3 text-emerald-800 underline" href={content.download_url}>
              下载文本
            </a>
          )}
        </div>
      )}
    </div>
  )
}
