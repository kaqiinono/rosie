'use client'

import Link from 'next/link'
import { useCallback } from 'react'
import { useAuth } from '@rosie/core'
import { FlipbookBatchUploader } from '@rosie/flipbook'
import type { FlipbookCreateBookInput } from '@rosie/flipbook'
import { FlipbookUploadGuide } from '@rosie/flipbook'
import { FlipbookUploader } from '@rosie/flipbook'
import { useFlipbookBooks } from '@rosie/flipbook'
import { useFlipbookDuplicatePrompt } from '@rosie/flipbook'
import { useWordData } from '@rosie/english'

export default function FlipbookAdminPage() {
  const { user, loading: authLoading } = useAuth()
  const { vocab } = useWordData(user)
  const { createBook } = useFlipbookBooks(user)
  const { ask, resetPolicy, dialog } = useFlipbookDuplicatePrompt()

  const submitBook = useCallback(
    (input: FlipbookCreateBookInput) =>
      createBook({
        ...input,
        resolveDuplicate: ask,
        batch: input.batch,
      }),
    [createBook, ask],
  )

  if (authLoading) {
    return <Shell>加载中…</Shell>
  }

  if (!user) {
    return (
      <Shell>
        <p className="text-center text-white/60">请先登录</p>
        <Link href="/auth" className="mt-4 block text-center text-orange-400">
          去登录 →
        </Link>
      </Shell>
    )
  }

  return (
    <Shell>
      <header className="mb-6">
        <Link href="/flipbook" className="text-sm text-white/60 hover:text-white">
          ◀ 返回书架
        </Link>
        <h1 className="mt-2 text-lg font-bold text-white">上传 / 管理书籍</h1>
        <p className="mt-2 text-xs text-white/45">
          每本书可上传 <strong className="text-white/60">PDF</strong> 或{' '}
          <strong className="text-white/60">整组页图</strong>（二选一）；页图与 PDF 均在本地转为 WebP
          后上传，不会把 PDF 原文件存入 Storage。在 Supabase SQL Editor 执行{' '}
          <code className="text-orange-300/80">docs/flipbook-tables.sql</code>
          （若上传报 403 RLS，再执行{' '}
          <code className="text-orange-300/80">docs/flipbook-rls-fix.sql</code>）。需先登录 Rosie。
        </p>
      </header>

      <FlipbookUploadGuide />

      <div className="mt-6 flex flex-col gap-8">
        <FlipbookUploader vocab={vocab} onSubmit={submitBook} onSessionStart={resetPolicy} />
        <FlipbookBatchUploader vocab={vocab} onSubmit={submitBook} onSessionStart={resetPolicy} />
      </div>

      {dialog}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-lg px-4 pb-16 pt-6">{children}</div>
}
