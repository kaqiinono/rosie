'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import {
  FLIPBOOK_BUCKET,
  flipbookAudioPath,
  flipbookPageImagePath,
  flipbookPagesPrefix,
  normalizeFlipbookSlug,
  type FlipbookBook,
  type FlipbookSyncManifest,
} from '@/utils/flipbook-types'
import { compressAudioToMp3 } from '@/utils/audio-compress'
import { parseSyncManifest, serializeSyncManifest } from '@/utils/flipbook-sync'
import type {
  FlipbookCreateOutcome,
  FlipbookDuplicateAction,
  FlipbookDuplicatePrompt,
} from '@/utils/flipbook-duplicate'
import {
  dedupePageImageFilesByPage,
  duplicatePageNumbers,
  formatDuplicatePageList,
} from '@/utils/flipbook-duplicate'
import { flipbookPageImageFilesToWebpBlobs } from '@/utils/flipbook-page-images'
import { renderPdfFileToPageBlobs } from '@/utils/flipbook-pdf'

export type FlipbookCreateBookResult = {
  error: string | null
  outcome: FlipbookCreateOutcome
}

export type FlipbookDuplicateResolver = (
  prompt: FlipbookDuplicatePrompt,
  options?: { batch?: boolean },
) => Promise<FlipbookDuplicateAction>

interface RawBookRow {
  id: string
  user_id: string
  slug?: string
  title: string
  description: string | null
  page_count: number | null
  pdf_path: string
  audio_path: string | null
  sync_manifest: unknown
  status: string
  created_at: string
  updated_at: string
}

function rowToBook(row: RawBookRow): FlipbookBook {
  const slug = row.slug ?? normalizeFlipbookSlug(row.title)
  return {
    id: row.id,
    userId: row.user_id,
    slug,
    title: row.title,
    description: row.description,
    pageCount: row.page_count,
    pagesPath: row.pdf_path.includes('/pages') ? row.pdf_path : flipbookPagesPrefix(slug),
    audioPath: row.audio_path,
    syncManifest: parseSyncManifest(row.sync_manifest),
    status: row.status as FlipbookBook['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function useFlipbookBooks(user: User | null) {
  const [books, setBooks] = useState<FlipbookBook[]>([])
  const [isLoading, setIsLoading] = useState(() => user !== null)

  const reload = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('flipbook_books')
      .select('*')
      .order('updated_at', { ascending: false })
    if (!error && data) {
      setBooks((data as RawBookRow[]).map(rowToBook))
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('flipbook_books')
        .select('*')
        .order('updated_at', { ascending: false })
      if (!cancelled) {
        if (!error && data) setBooks((data as RawBookRow[]).map(rowToBook))
        setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const getSignedAudioUrl = useCallback(async (audioPath: string): Promise<string | null> => {
    const { data } = supabase.storage.from(FLIPBOOK_BUCKET).getPublicUrl(audioPath)
    return data.publicUrl ?? null
  }, [])

  const getSignedPageImageUrls = useCallback(
    async (book: FlipbookBook): Promise<string[]> => {
      // Fast path: page_count is recorded at upload time and the file naming
      // convention is fixed (0001.webp ... NNNN.webp). Skip storage.list and
      // build every URL synchronously — zero network for the reader open.
      if (book.pageCount && book.pageCount > 0) {
        const urls: string[] = []
        for (let p = 1; p <= book.pageCount; p++) {
          const path = flipbookPageImagePath(book.slug, p)
          const { data } = supabase.storage.from(FLIPBOOK_BUCKET).getPublicUrl(path)
          if (data?.publicUrl) urls.push(data.publicUrl)
        }
        return urls
      }

      // Fallback for legacy books missing page_count: enumerate the bucket.
      const prefix = flipbookPagesPrefix(book.slug)
      const { data, error } = await supabase.storage
        .from(FLIPBOOK_BUCKET)
        .list(prefix, { limit: 500, sortBy: { column: 'name', order: 'asc' } })
      if (error || !data || data.length === 0) return []

      const paths = data
        .filter((f) => Boolean(f.name) && f.name.endsWith('.webp'))
        .map((f) => `${prefix}/${f.name}`)

      const urls: string[] = []
      for (const path of paths) {
        const { data: pub } = supabase.storage.from(FLIPBOOK_BUCKET).getPublicUrl(path)
        if (pub?.publicUrl) urls.push(pub.publicUrl)
      }
      return urls
    },
    [],
  )

  const removeBookStorageAndRow = useCallback(
    async (book: FlipbookBook): Promise<{ error: string | null }> => {
      if (book.audioPath) {
        await supabase.storage.from(FLIPBOOK_BUCKET).remove([book.audioPath])
      }

      if (book.pagesPath.endsWith('source.pdf')) {
        await supabase.storage.from(FLIPBOOK_BUCKET).remove([book.pagesPath])
      }

      const prefix = flipbookPagesPrefix(book.slug)
      const { data: pages } = await supabase.storage.from(FLIPBOOK_BUCKET).list(prefix, {
        limit: 500,
      })
      if (pages && pages.length > 0) {
        const paths = pages
          .filter((f) => Boolean(f.name))
          .map((f) => `${prefix}/${f.name}`)
        await supabase.storage.from(FLIPBOOK_BUCKET).remove(paths)
      }

      await supabase.from('flipbook_progress').delete().eq('book_id', book.id)

      const { error } = await supabase.from('flipbook_books').delete().eq('id', book.id)
      if (error) return { error: error.message }
      return { error: null }
    },
    [],
  )

  const createBook = useCallback(
    async (input: {
      title: string
      description?: string
      pageCount?: number
      pdfFile?: File
      pageImageFiles?: File[]
      audioFile?: File
      syncManifest?: FlipbookSyncManifest | null
      resolveDuplicate?: FlipbookDuplicateResolver
      batch?: boolean
      onPageRenderProgress?: (rendered: number, total: number) => void
      onPageUploadProgress?: (uploaded: number, total: number) => void
      onAudioUploadPhase?: (phase: 'start' | 'done') => void
    }): Promise<FlipbookCreateBookResult> => {
      if (!user) return { error: '请先登录', outcome: 'aborted' }

      const hasPdf = Boolean(input.pdfFile)
      let pageImageFiles = input.pageImageFiles
      const hasImages = Boolean(pageImageFiles && pageImageFiles.length > 0)
      if (hasPdf === hasImages) {
        return {
          error: hasPdf ? '不能同时上传 PDF 和页图' : '请选择 PDF 或至少一张页图',
          outcome: 'aborted',
        }
      }

      const slug = normalizeFlipbookSlug(input.title)
      const { data: existingRow } = await supabase
        .from('flipbook_books')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

      if (existingRow) {
        if (!input.resolveDuplicate) {
          return { error: '该书已存在，请勿重复上传', outcome: 'aborted' }
        }
        const action = await input.resolveDuplicate(
          {
            kind: 'existing_book',
            title: input.title.trim(),
            slug,
            detail: '书架中已有相同书名的书籍。覆盖将删除旧书及阅读进度后重新上传；跳过则不上传此书；放弃将停止当前上传流程。',
          },
          { batch: input.batch },
        )
        if (action === 'abort') return { error: null, outcome: 'aborted' }
        if (action === 'skip') return { error: null, outcome: 'skipped' }
        const del = await removeBookStorageAndRow(rowToBook(existingRow as RawBookRow))
        if (del.error) return { error: del.error, outcome: 'aborted' }
      }

      if (pageImageFiles && pageImageFiles.length > 0) {
        const dupPages = duplicatePageNumbers(pageImageFiles)
        if (dupPages.length > 0) {
          if (!input.resolveDuplicate) {
            return {
              error: `页码重复：${formatDuplicatePageList(dupPages)}`,
              outcome: 'aborted',
            }
          }
          const action = await input.resolveDuplicate(
            {
              kind: 'duplicate_page',
              title: input.title.trim(),
              slug,
              detail: `以下页码有多张图片：${formatDuplicatePageList(dupPages)}。覆盖保留每个页码的最后一张；跳过保留第一张；放弃将停止当前上传流程。`,
            },
            { batch: input.batch },
          )
          if (action === 'abort') return { error: null, outcome: 'aborted' }
          if (action === 'skip') {
            pageImageFiles = dedupePageImageFilesByPage(pageImageFiles, 'first')
          } else {
            pageImageFiles = dedupePageImageFilesByPage(pageImageFiles, 'last')
          }
        }
      }

      const pagesPath = flipbookPagesPrefix(slug)

      let pageBlobs: Blob[]
      try {
        if (pageImageFiles && pageImageFiles.length > 0) {
          const total = pageImageFiles.length
          input.onPageRenderProgress?.(0, total)
          pageBlobs = await flipbookPageImageFilesToWebpBlobs(pageImageFiles, {
            onConverted: (done, t) => input.onPageRenderProgress?.(done, t),
          })
        } else if (input.pdfFile) {
          const renderTotal = input.pageCount ?? 0
          if (renderTotal <= 0) return { error: 'PDF 页数无效', outcome: 'aborted' }
          input.onPageRenderProgress?.(0, renderTotal)
          pageBlobs = await renderPdfFileToPageBlobs(input.pdfFile, {
            maxPages: renderTotal,
            scale: 1.1,
            onPageRendered: (rendered, total) => {
              input.onPageRenderProgress?.(rendered, total)
            },
          })
        } else {
          return { error: '请选择 PDF 或页图', outcome: 'aborted' }
        }
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : hasImages ? '页图处理失败' : 'PDF 转页图失败',
          outcome: 'aborted',
        }
      }

      if (pageBlobs.length === 0) {
        return {
          error: hasImages ? '未能处理页图' : '未能从 PDF 生成页图',
          outcome: 'aborted',
        }
      }

      input.onPageUploadProgress?.(0, pageBlobs.length)
      for (let i = 0; i < pageBlobs.length; i++) {
        const imgPath = flipbookPageImagePath(slug, i + 1)
        const { error: imgErr } = await supabase.storage
          .from(FLIPBOOK_BUCKET)
          .upload(imgPath, pageBlobs[i], { upsert: true, contentType: 'image/webp' })
        if (imgErr) return { error: imgErr.message, outcome: 'aborted' }
        input.onPageUploadProgress?.(i + 1, pageBlobs.length)
      }

      let audioPath: string | null = null
      if (input.audioFile) {
        input.onAudioUploadPhase?.('start')
        audioPath = flipbookAudioPath(slug)
        const compressed = await compressAudioToMp3(input.audioFile)
        const { error: audioErr } = await supabase.storage
          .from(FLIPBOOK_BUCKET)
          .upload(audioPath, compressed.blob, {
            upsert: true,
            contentType: compressed.contentType,
          })
        if (audioErr) return { error: audioErr.message, outcome: 'aborted' }
        input.onAudioUploadPhase?.('done')
      }

      const bookId = crypto.randomUUID()
      const { error: dbErr } = await supabase.from('flipbook_books').insert({
        id: bookId,
        user_id: user.id,
        slug,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        page_count: pageBlobs.length,
        pdf_path: pagesPath,
        audio_path: audioPath,
        sync_manifest: input.syncManifest ? serializeSyncManifest(input.syncManifest) : null,
        status: 'ready',
        updated_at: new Date().toISOString(),
      })

      if (dbErr) return { error: dbErr.message, outcome: 'aborted' }

      await reload()
      return { error: null, outcome: 'created' }
    },
    [user, reload, removeBookStorageAndRow],
  )

  const deleteBook = useCallback(
    async (book: FlipbookBook): Promise<{ error: string | null }> => {
      if (!user) return { error: '请先登录' }
      const result = await removeBookStorageAndRow(book)
      if (result.error) return result
      await reload()
      return { error: null }
    },
    [user, reload, removeBookStorageAndRow],
  )

  return {
    books,
    isLoading,
    reload,
    getSignedAudioUrl,
    getSignedPageImageUrls,
    createBook,
    deleteBook,
  }
}
