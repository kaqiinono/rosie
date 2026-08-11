import fs from 'node:fs'
import path from 'node:path'
import { upsertKnowledgeDocument, stripHtml, updateKnowledgeSyncState } from '@rosie/ai'
import type { LinkManifestEntry } from '@rosie/ai'
import { readingPassages } from '@rosie/english/utils/reading-data'
import {
  getBookLessonPassages,
  getBookPoems,
  getBookAccumulation,
  getBookPinyinWriteWords,
} from '../../../../packages/chinese/src/utils/chinese-book-content'
import type { ChineseBookSlug } from '../../../../packages/chinese/src/utils/chinese-books'
import { UNITS as G1B_UNITS } from '../../../../packages/chinese/src/utils/g1b/units'
import { UNITS as G2A_UNITS } from '../../../../packages/chinese/src/utils/g2a/units'
import { UNITS as G2B_UNITS } from '../../../../packages/chinese/src/utils/g2b/units'
import type { ChineseUnitEntry } from '../../../../packages/chinese/src/utils/g1b/types'

export type CatalogSubject = 'english' | 'math' | 'chinese'

export interface CatalogSyncResult {
  subject: CatalogSubject
  documents: number
  chunks: number
  skipped: number
  manifestEntries: number
}

export interface CatalogSyncSummary {
  results: CatalogSyncResult[]
  errors: Array<{ subject: CatalogSubject; message: string }>
  manifestPath: string
  manifestCount: number
  math?: { total: number; offset: number; limit: number; done: boolean }
}

const BOOK_SLUGS: ChineseBookSlug[] = ['g1b', 'g2a', 'g2b']
const UNITS_BY_BOOK: Record<ChineseBookSlug, ChineseUnitEntry[]> = {
  g1b: G1B_UNITS,
  g2a: G2A_UNITS,
  g2b: G2B_UNITS,
}

function buildLessonTitleMap(units: ChineseUnitEntry[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      let key: string
      if (lesson.kind === 'garden') key = `u${unit.unit}-garden`
      else if (lesson.kind === 'happy_reading') key = `u${unit.unit}-happy-reading`
      else key = `u${unit.unit}-l${lesson.lesson}`
      map.set(key, lesson.title)
    }
  }
  return map
}

function manifestPath(): string {
  // Next.js API cwd = apps/web
  return path.join(process.cwd(), '../../packages/ai/src/data/link-manifest.json')
}

function readExistingManifest(): LinkManifestEntry[] {
  const outPath = manifestPath()
  if (!fs.existsSync(outPath)) return []
  try {
    const raw = JSON.parse(fs.readFileSync(outPath, 'utf8')) as unknown
    return Array.isArray(raw) ? (raw as LinkManifestEntry[]) : []
  } catch {
    return []
  }
}

function entrySubject(entry: LinkManifestEntry): CatalogSubject | null {
  if (entry.subject === 'english' || entry.subject === 'math' || entry.subject === 'chinese') {
    return entry.subject
  }
  const prefix = entry.sourceRef.split(':')[0]
  if (prefix === 'english' || prefix === 'math' || prefix === 'chinese') return prefix
  if (entry.sourceRef.startsWith('word_entries:')) return 'english'
  return null
}

async function ingestOne(
  payload: Parameters<typeof upsertKnowledgeDocument>[0],
  stats: { documents: number; chunks: number; skipped: number },
) {
  const result = await upsertKnowledgeDocument(payload)
  stats.documents++
  stats.chunks += result.chunkCount
  if (result.skipped) stats.skipped++
}

type CatalogProgressCallback = (completed: number, total: number) => Promise<void>

function chineseCatalogTotal(): number {
  let total = 0
  for (const bookSlug of BOOK_SLUGS) {
    total += getBookLessonPassages(bookSlug).length
    total += getBookPoems(bookSlug).length
    total += getBookAccumulation(bookSlug).length
    total += new Set(getBookPinyinWriteWords(bookSlug).map((word) => word.lessonKey)).size
    total += UNITS_BY_BOOK[bookSlug].reduce((sum, unit) => sum + unit.lessons.length, 0)
  }
  return total
}

export async function syncChineseCatalog(onProgress?: CatalogProgressCallback): Promise<{
  result: CatalogSyncResult
  manifest: LinkManifestEntry[]
}> {
  const stats = { documents: 0, chunks: 0, skipped: 0 }
  const manifest: LinkManifestEntry[] = []
  const total = chineseCatalogTotal()

  for (const bookSlug of BOOK_SLUGS) {
    const titleMap = buildLessonTitleMap(UNITS_BY_BOOK[bookSlug])
    const passages = getBookLessonPassages(bookSlug)

    for (const passage of passages) {
      const title = titleMap.get(passage.lessonKey) ?? passage.lessonKey
      const sourceRef = `chinese:passage:${bookSlug}:${passage.lessonKey}`
      const href = `/chinese/${bookSlug}/reading/${passage.lessonKey}`
      const content = passage.paragraphs.join('\n\n')

      await ingestOne(
        {
          subject: 'chinese',
          sourceType: 'catalog_sync',
          sourceRef,
          title,
          content,
          metadata: {
            sourceRef,
            title,
            bookSlug,
            lessonKey: passage.lessonKey,
            href,
          },
        },
        stats,
      )
      await onProgress?.(stats.documents, total)

      manifest.push({
        sourceRef,
        href,
        title,
        subject: 'chinese',
      })
    }

    const poems = getBookPoems(bookSlug)
    for (const poem of poems) {
      const sourceRef = `chinese:poem:${bookSlug}:${poem.id}`
      const content = [
        `${poem.title}`,
        poem.author ? `${poem.dynasty}·${poem.author}` : '',
        ...poem.lines,
      ]
        .filter(Boolean)
        .join('\n')

      await ingestOne(
        {
          subject: 'chinese',
          sourceType: 'catalog_sync',
          sourceRef,
          title: poem.title,
          content,
          metadata: {
            sourceRef,
            title: poem.title,
            bookSlug,
            poemId: poem.id,
            href: `/chinese/${bookSlug}/poems`,
          },
        },
        stats,
      )
      await onProgress?.(stats.documents, total)

      manifest.push({
        sourceRef,
        href: `/chinese/${bookSlug}/poems`,
        title: poem.title,
        subject: 'chinese',
      })
    }

    // 日积月累
    const accumulation = getBookAccumulation(bookSlug)
    for (const unit of accumulation) {
      const sourceRef = `chinese:accumulation:${bookSlug}:u${unit.unit}:${unit.kind}`
      const kindLabel =
        unit.kind === 'idiom_4'
          ? '成语'
          : unit.kind === 'xiehouyu'
            ? '歇后语'
            : unit.kind === 'proverb'
              ? '谚语'
              : unit.kind === 'quote'
                ? '名言'
                : unit.kind === 'poem'
                  ? '古诗'
                  : unit.kind
      const title = `${bookSlug.toUpperCase()} 第${unit.unit}单元·日积月累·${kindLabel}`
      const lines = unit.items.map((item) => {
        const answer = item.answer ? `（${item.answer}）` : ''
        const source = item.source ? ` —— ${item.source}` : ''
        return `${item.text}${answer}${source}`
      })
      const content = [`类型: ${kindLabel}`, ...lines].join('\n')

      await ingestOne(
        {
          subject: 'chinese',
          sourceType: 'catalog_sync',
          sourceRef,
          title,
          content,
          metadata: {
            sourceRef,
            title,
            bookSlug,
            unit: unit.unit,
            kind: unit.kind,
            href: `/chinese/${bookSlug}/accumulation`,
          },
        },
        stats,
      )
      await onProgress?.(stats.documents, total)

      manifest.push({
        sourceRef,
        href: `/chinese/${bookSlug}/accumulation`,
        title,
        subject: 'chinese',
      })
    }

    // 看拼音写词语（按课聚合）
    const pinyinWords = getBookPinyinWriteWords(bookSlug)
    const byLesson = new Map<string, typeof pinyinWords>()
    for (const w of pinyinWords) {
      const list = byLesson.get(w.lessonKey) ?? []
      list.push(w)
      byLesson.set(w.lessonKey, list)
    }
    for (const [lessonKey, words] of byLesson) {
      const lessonTitle = words[0]?.lessonTitle ?? titleMap.get(lessonKey) ?? lessonKey
      const sourceRef = `chinese:pinyin-write:${bookSlug}:${lessonKey}`
      const title = `看拼音写词语·${lessonTitle}`
      const content = [`课文: ${lessonTitle}`, ...words.map((w) => `${w.pinyin} → ${w.word}`)].join(
        '\n',
      )

      await ingestOne(
        {
          subject: 'chinese',
          sourceType: 'catalog_sync',
          sourceRef,
          title,
          content,
          metadata: {
            sourceRef,
            title,
            bookSlug,
            lessonKey,
            href: `/chinese/${bookSlug}/chars/print`,
          },
        },
        stats,
      )
      await onProgress?.(stats.documents, total)

      manifest.push({
        sourceRef,
        href: `/chinese/${bookSlug}/chars/print`,
        title,
        subject: 'chinese',
      })
    }

    // 单元 / 课文目录（标题索引，便于「第几课」类提问）
    for (const unit of UNITS_BY_BOOK[bookSlug]) {
      for (const lesson of unit.lessons) {
        let lessonKey: string
        if (lesson.kind === 'garden') lessonKey = `u${unit.unit}-garden`
        else if (lesson.kind === 'happy_reading') lessonKey = `u${unit.unit}-happy-reading`
        else lessonKey = `u${unit.unit}-l${lesson.lesson}`

        const sourceRef = `chinese:lesson:${bookSlug}:${lessonKey}`
        const kind =
          lesson.kind === 'garden'
            ? '语文园地'
            : lesson.kind === 'happy_reading'
              ? '快乐读书吧'
              : lesson.isPoem
                ? '古诗课'
                : '课文'
        const title = lesson.title
        const content = [
          `册别: ${bookSlug}`,
          `单元: ${unit.unit} ${unit.title}`,
          `课型: ${kind}`,
          `课题: ${lesson.title}`,
          lesson.requiresRecite ? '要求背诵: 是' : '',
        ]
          .filter(Boolean)
          .join('\n')

        const href =
          lesson.kind === 'garden' || lesson.kind === 'happy_reading'
            ? `/chinese/${bookSlug}/units/${unit.unit}`
            : `/chinese/${bookSlug}/reading/${lessonKey}`

        await ingestOne(
          {
            subject: 'chinese',
            sourceType: 'catalog_sync',
            sourceRef,
            title,
            content,
            metadata: {
              sourceRef,
              title,
              bookSlug,
              lessonKey,
              unit: unit.unit,
              href,
            },
          },
          stats,
        )
        await onProgress?.(stats.documents, total)

        manifest.push({
          sourceRef,
          href,
          title,
          subject: 'chinese',
        })
      }
    }
  }

  return {
    result: {
      subject: 'chinese',
      ...stats,
      manifestEntries: manifest.length,
    },
    manifest,
  }
}

export async function syncEnglishCatalog(onProgress?: CatalogProgressCallback): Promise<{
  result: CatalogSyncResult
  manifest: LinkManifestEntry[]
}> {
  const stats = { documents: 0, chunks: 0, skipped: 0 }
  const manifest: LinkManifestEntry[] = []

  for (const passage of readingPassages) {
    const sourceRef = `english:reading:${passage.stage}:${passage.unit}:${passage.lesson}`
    const href = `/english/words/reading/${passage.key}`
    const content = [`标题: ${passage.title}`, ...passage.paragraphs].join('\n\n')

    await ingestOne(
      {
        subject: 'english',
        sourceType: 'catalog_sync',
        sourceRef,
        title: passage.title,
        content,
        metadata: {
          sourceRef,
          title: passage.title,
          stage: passage.stage,
          unit: passage.unit,
          lesson: passage.lesson,
          passageKey: passage.key,
          href,
        },
      },
      stats,
    )
    await onProgress?.(stats.documents, readingPassages.length)

    manifest.push({
      sourceRef,
      href,
      title: passage.title,
      subject: 'english',
    })
  }

  return {
    result: {
      subject: 'english',
      ...stats,
      manifestEntries: manifest.length,
    },
    manifest,
  }
}

export async function syncMathCatalog(options?: {
  offset?: number
  limit?: number
  onProgress?: CatalogProgressCallback
}): Promise<{
  result: CatalogSyncResult
  manifest: LinkManifestEntry[]
  total: number
  done: boolean
}> {
  const { SEA_POOL } = await import('@rosie/math/utils/sea-data')
  const offset = Math.max(0, options?.offset ?? 0)
  const limit = options?.limit && options.limit > 0 ? options.limit : SEA_POOL.length
  const slice = SEA_POOL.slice(offset, offset + limit)

  const stats = { documents: 0, chunks: 0, skipped: 0 }
  const manifest: LinkManifestEntry[] = []

  for (const entry of slice) {
    const { problem, lessonId, section, href } = entry
    const sourceRef = `math:problem:${problem.id}`
    const text = stripHtml(problem.text)
    const analysis = (problem.analysis ?? []).map((step) => stripHtml(step))
    const content = [
      `题目: ${problem.title}`,
      `标签: ${problem.tagLabel}`,
      text,
      ...analysis.map((step, i) => `步骤${i + 1}: ${step}`),
      problem.finalQ ? `结论: ${problem.finalQ}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    await ingestOne(
      {
        subject: 'math',
        sourceType: 'catalog_sync',
        sourceRef,
        title: problem.title,
        content,
        metadata: {
          sourceRef,
          title: problem.title,
          problemId: problem.id,
          lessonId,
          section,
          href,
          analysis,
          analysisImg: problem.analysisImg,
          finalAnswer: problem.finalQ
            ? `${problem.finalQ}${problem.finalAns}${problem.finalUnit}`
            : undefined,
        },
      },
      stats,
    )
    await options?.onProgress?.(offset + stats.documents, SEA_POOL.length)

    manifest.push({
      sourceRef,
      href,
      title: problem.title,
      subject: 'math',
      problemId: problem.id,
    })
  }

  const nextOffset = offset + slice.length
  return {
    result: {
      subject: 'math',
      ...stats,
      manifestEntries: manifest.length,
    },
    manifest,
    total: SEA_POOL.length,
    done: nextOffset >= SEA_POOL.length,
  }
}

function writeManifest(
  syncedSubjects: CatalogSubject[],
  newEntries: LinkManifestEntry[],
): { path: string; count: number } {
  const outPath = manifestPath()
  const existing = readExistingManifest()
  const synced = new Set(syncedSubjects)
  const kept = existing.filter((e) => {
    const s = entrySubject(e)
    return s == null || !synced.has(s)
  })
  const deduped = Array.from(
    new Map([...kept, ...newEntries].map((entry) => [entry.sourceRef, entry])).values(),
  ).sort((a, b) => a.sourceRef.localeCompare(b.sourceRef))

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, `${JSON.stringify(deduped, null, 2)}\n`, 'utf8')
  return { path: outPath, count: deduped.length }
}

export async function runCatalogSync(
  subjects: CatalogSubject[],
  options?: { mathOffset?: number; mathLimit?: number },
): Promise<CatalogSyncSummary> {
  const results: CatalogSyncResult[] = []
  const errors: Array<{ subject: CatalogSubject; message: string }> = []
  const manifest: LinkManifestEntry[] = []
  const succeededSubjects: CatalogSubject[] = []
  let mathMeta: CatalogSyncSummary['math']

  async function reportProgress(
    sourceKey: string,
    subject: CatalogSubject,
    completed: number,
    total: number,
    batchSize?: number,
  ): Promise<void> {
    if (completed % 5 !== 0 && completed !== total) return
    try {
      await updateKnowledgeSyncState({
        sourceKey,
        status: 'running',
        recordsSynced: completed,
        cursorPosition: completed,
        totalRecords: total,
        metadata: {
          subject,
          sourceType: 'catalog_sync',
          ...(batchSize ? { batchSize } : {}),
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[ai-catalog-sync] progress update failed for ${subject}: ${message}`)
    }
  }

  for (const subject of subjects) {
    const sourceKey = `${subject}_catalog`
    const requestedOffset = subject === 'math' ? (options?.mathOffset ?? 0) : 0
    try {
      await updateKnowledgeSyncState({
        sourceKey,
        status: 'running',
        cursorPosition: requestedOffset,
        metadata: { subject, sourceType: 'catalog_sync' },
      })
      if (subject === 'chinese') {
        const total = chineseCatalogTotal()
        await updateKnowledgeSyncState({
          sourceKey,
          status: 'running',
          cursorPosition: 0,
          totalRecords: total,
          metadata: { subject, sourceType: 'catalog_sync' },
        })
        const { result, manifest: chineseManifest } = await syncChineseCatalog(
          async (completed, progressTotal) => {
            await reportProgress(sourceKey, subject, completed, progressTotal)
          },
        )
        results.push(result)
        manifest.push(...chineseManifest)
        succeededSubjects.push('chinese')
        await updateKnowledgeSyncState({
          sourceKey,
          status: 'completed',
          recordsSynced: result.documents,
          chunksCreated: result.chunks,
          cursorPosition: result.documents,
          totalRecords: result.documents,
          metadata: { subject, sourceType: 'catalog_sync' },
        })
      } else if (subject === 'english') {
        const total = readingPassages.length
        await updateKnowledgeSyncState({
          sourceKey,
          status: 'running',
          cursorPosition: 0,
          totalRecords: total,
          metadata: { subject, sourceType: 'catalog_sync' },
        })
        const { result, manifest: englishManifest } = await syncEnglishCatalog(
          async (completed, progressTotal) => {
            await reportProgress(sourceKey, subject, completed, progressTotal)
          },
        )
        results.push(result)
        manifest.push(...englishManifest)
        succeededSubjects.push('english')
        await updateKnowledgeSyncState({
          sourceKey,
          status: 'completed',
          recordsSynced: result.documents,
          chunksCreated: result.chunks,
          cursorPosition: result.documents,
          totalRecords: result.documents,
          metadata: { subject, sourceType: 'catalog_sync' },
        })
      } else if (subject === 'math') {
        const offset = options?.mathOffset ?? 0
        const limit = options?.mathLimit ?? 80
        const {
          result,
          manifest: mathManifest,
          total,
          done,
        } = await syncMathCatalog({
          offset,
          limit,
          onProgress: async (completed, progressTotal) => {
            await reportProgress(sourceKey, subject, completed, progressTotal, limit)
          },
        })
        results.push(result)
        // For batched math: merge into existing math entries instead of wiping all math
        const existing = readExistingManifest().filter((e) => entrySubject(e) === 'math')
        const beforeBatch = existing.filter((e) => {
          // keep entries not in this batch's sourceRefs
          const refs = new Set(mathManifest.map((m) => m.sourceRef))
          return !refs.has(e.sourceRef)
        })
        // When offset===0, replace all math; otherwise append/update this batch
        if (offset === 0) {
          manifest.push(...mathManifest)
        } else {
          manifest.push(...beforeBatch, ...mathManifest)
        }
        succeededSubjects.push('math')
        mathMeta = { total, offset, limit, done }
        const cursorPosition = offset + result.documents
        await updateKnowledgeSyncState({
          sourceKey,
          status: done ? 'completed' : 'partial',
          recordsSynced: cursorPosition,
          chunksCreated: result.chunks,
          cursorPosition,
          totalRecords: total,
          metadata: { subject, sourceType: 'catalog_sync', batchSize: limit },
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push({ subject, message })
      console.error(`[ai-catalog-sync] ${subject} failed:`, message)
      try {
        await updateKnowledgeSyncState({
          sourceKey,
          status: 'failed',
          cursorPosition: requestedOffset,
          errorMessage: message,
          metadata: { subject, sourceType: 'catalog_sync' },
        })
      } catch (stateError) {
        console.error('[ai-catalog-sync] failed to persist sync error:', stateError)
      }
    }
  }

  const written = writeManifest(succeededSubjects, manifest)

  return {
    results,
    errors,
    manifestPath: written.path,
    manifestCount: written.count,
    math: mathMeta,
  }
}
