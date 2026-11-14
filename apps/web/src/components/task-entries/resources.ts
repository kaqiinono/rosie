'use client'

import { createUserSessionStore, supabase, baiduResponseMessage, type UserSessionStore } from '@rosie/core'
import { mergeAutoResources, type PracticeEntryRow, type PracticeResource } from '@rosie/tasks'
import { loadProblemVideoCatalog } from '@rosie/math-kit/hooks/useProblemVideoCatalog'
import { readAll } from './catalogData'
import type { CatalogKind } from './catalog'
import { findPassage, findPassageByKey, listeningClipsFor, readingSegments } from '@rosie/english'

async function authorizedFetch(url: string, method = 'GET', userId?: string) {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session || (userId && data.session.user.id !== userId)) throw new Error('请重新登录')
  const response = await fetch(url, { method, cache: 'no-store', credentials: 'same-origin',
    headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: AbortSignal.timeout(45000) })
  if (!response.ok) throw new Error(await baiduResponseMessage(response, '读取关联资源失败，请重试'))
  return response.json() as Promise<unknown>
}
interface AudioCatalog { keys: string[]; warning: string }
const audioStore = createUserSessionStore<AudioCatalog>('task_entry_audio_catalog', {
  empty: { keys: [], warning: '' },
  async fetch(userId) {
    const result = await authorizedFetch('/api/baidu/audio/session?resources=1', 'POST', userId) as { keys?: unknown; catalogComplete?: boolean }
    if (!Array.isArray(result.keys)) throw new Error('音频目录格式无效，请重试')
    return { keys: result.keys.filter((key): key is string => typeof key === 'string'),
      warning: result.catalogComplete ? '' : '部分网盘音频目录读取失败，已找到的资源仍可使用，请重试' }
  },
})
const narrationStore = createUserSessionStore<string[]>('task_entry_storage_narrations', {
  empty: [], fetch: async () => (await readAll<{ passage_key: string }>('reading_passage_media', 'passage_key', 'passage_key')).map((row) => row.passage_key),
})
async function loadAudio(userId: string, refresh: boolean) {
  const [audio, storage] = await Promise.allSettled([
    (async () => {
      if (refresh) await audioStore.refreshInBackground(userId)
      else await audioStore.ensureLoaded(userId)
      const state = audioStore.getSnapshot(userId)
      if (state.status !== 'ready') throw new Error('网盘音频目录读取失败')
      return state.data
    })(),
    readStore(userId, narrationStore, refresh),
  ])
  return {
    keys: new Set(audio.status === 'fulfilled' ? audio.value.keys : []),
    storage: storage.status === 'fulfilled' ? storage.value : new Set<string>(),
    warning: [audio.status === 'fulfilled' ? audio.value.warning : '网盘音频读取失败', storage.status === 'rejected' ? '备用音频读取失败' : ''].filter(Boolean).join('；'),
  }
}
async function readStore(userId: string, store: UserSessionStore<string[]>, refresh: boolean) {
  if (refresh) await store.refreshInBackground(userId)
  else {
    if (store.getSnapshot(userId).status === 'error') throw new Error('资源目录读取失败，请点击刷新重试')
    await store.ensureLoaded(userId)
  }
  const state = store.getSnapshot(userId)
  if (state.status !== 'ready') throw new Error('读取关联资源失败，请重试')
  return new Set(state.data)
}
const auto = (id: string, label: string, type: PracticeResource['type'], url: string): PracticeResource => ({ id, label, type, source: 'auto', url })

/** Discover each source once per batch; failures preserve the previous row resources. */
export async function attachResources(rows: PracticeEntryRow[], refresh = false): Promise<PracticeEntryRow[]> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('请重新登录')
  const userId = data.session.user.id
  const loads = new Map<string, Promise<Set<string>>>()
  function load(key: string): Promise<Set<string>> {
    let promise = loads.get(key)
    if (!promise) {
      promise = loadProblemVideoCatalog(userId, key, refresh).then(keys => new Set(keys))
      loads.set(key, promise)
    }
    return promise
  }
  let audioPromise: ReturnType<typeof loadAudio> | undefined
  const chineseContent = new Map<CatalogKind, Promise<PracticeEntryRow[]>>()
  async function initialContent(row: PracticeEntryRow): Promise<PracticeEntryRow> {
    if (row.content !== undefined) return row
    const v = row.values
    const passage = v.key ? findPassageByKey(v.key) : undefined
    if (passage) return { ...row, content: v.sentenceId
      ? sentenceContent(passage.key, v.sentenceId, (() => {
        const match = /^(\d+)-(\d+)$/.exec(v.sentenceId)
        return match && passage.paragraphs[Number(match[1])] !== undefined ? readingSegments(passage, Number(match[1]))[Number(match[2])] ?? '' : ''
      })())
      : [{ title: passage.title, text: passage.paragraphs.join('\n\n') }] }
    if (!v.bookSlug || (!v.lessonKey && !v.poemId && !v.unit)) return row
    const prefix = row.id.split(':')[0]
    const kind: CatalogKind = prefix === 'poem' ? 'chinesePoems' : prefix.startsWith('accumulation') ? 'chineseAccumulation' :
      ['chineseCourse', 'chineseReading', 'chineseChars', 'chineseRecognize', 'chineseWords'].includes(prefix) ? prefix as CatalogKind : 'chineseChars'
    let pending = chineseContent.get(kind)
    if (!pending) {
      pending = import('./chineseCatalog').then(({ chineseCatalog }) => chineseCatalog(kind)).then((catalog) => catalog.groups.flatMap((group) => group.rows))
      chineseContent.set(kind, pending)
    }
    const found = (await pending).find((item) => item.id === row.id || (item.values.bookSlug === v.bookSlug &&
      (v.poemId ? item.values.poemId === v.poemId : v.lessonKey ? item.values.lessonKey === v.lessonKey : item.values.unit === v.unit)))
    return found ? { ...row, content: found.content } : row
  }
  const lessonKeys = [...new Set(rows.filter((row) => row.values.problemId && row.values.grade && row.values.seq).map((row) => `${row.values.grade}-${row.values.seq}`))]
  for (let i = 0; i < lessonKeys.length; i += 4) await Promise.allSettled(lessonKeys.slice(i, i + 4).map(load))
  const result: PracticeEntryRow[] = []
  for (const originalRow of rows) {
    let row = originalRow
    try {
      row = await initialContent(row)
      const resources: PracticeResource[] = []
      let warning = ''
      const v = row.values
      if (v.problemId && v.grade && v.seq) {
        const keys = await load(`${v.grade}-${v.seq}`)
        if (keys.has(v.problemId)) resources.push(auto(`math:${v.problemId}`, '题目回放', 'video', `/api/baidu/video/${encodeURIComponent(v.problemId)}`))
      }
      const passage = v.key ? findPassageByKey(v.key) : v.stage && v.unit && v.lesson ? findPassage(v.stage, v.unit, v.lesson) : undefined
      if (passage) {
        audioPromise ??= loadAudio(userId, refresh)
        const audio = await audioPromise
        const keys = audio.keys
        warning = audio.warning
        const base = `/api/baidu/audio/${encodeURIComponent(passage.key)}`
        const assetUrl = (slot: string) => `${base}?asset=${encodeURIComponent(slot)}`
        const fallback = audio.storage.has(passage.key) ? supabase.storage.from('reading').getPublicUrl(`passages/${passage.key}/narration.mp3`).data.publicUrl : null
        const narration = keys.has(passage.key + '#narration') ? assetUrl('narration') : keys.has(passage.key) ? base : fallback
        if (v.sentenceId) {
          const slot = 'clip:' + v.sentenceId
          if (keys.has(passage.key + '#' + slot)) resources.push(auto(`audio:${passage.key}:${slot}`, '句子听记', 'audio', assetUrl(slot)))
          const clips = listeningClipsFor(passage)
          const clipIndex = clips.findIndex((clip) => clip.target === v.sentenceId)
          const clipNumber = String(clipIndex + 1).padStart(2, '0')
          if (!keys.has(passage.key + '#' + slot) && clipIndex >= 0 && keys.has(`${passage.key}#legacy-clip:${clipNumber}`)) {
            const url = `${base}?clip=${clipNumber}`
            resources.push(auto(`legacy:${passage.key}:${clipNumber}`, '句子听记', 'audio', url))
            const [startSeconds, endSeconds] = clips[clipIndex].singleRead
            if (Number.isFinite(startSeconds) && Number.isFinite(endSeconds) && endSeconds > startSeconds)
              resources.push({ ...auto(`legacy-single:${passage.key}:${clipNumber}`, '单遍朗读', 'audio', url), startSeconds, endSeconds })
          }
          const match = /^(\d+)-(\d+)$/.exec(v.sentenceId)
          if (match && narration) {
            const paragraph = Number(match[1]); const sentence = Number(match[2])
            const cues = passage.narrationCues?.[paragraph]
            const cue = cues?.[sentence]
            if (cue && readingSegments(passage, paragraph).length === cues?.length && cue[1] > cue[0])
              resources.push({ ...auto(`sentence:${passage.key}:${v.sentenceId}`, '原文单句', 'audio', narration), startSeconds: cue[0], endSeconds: cue[1] })
          }
        } else {
          if (narration) resources.push(auto(`audio:${passage.key}:narration`, '课文朗读', 'audio', narration))
          for (const [slot, label] of [['words', '单词音频'], ['recitation', '背诵音频']])
            if (keys.has(passage.key + '#' + slot)) resources.push(auto(`audio:${passage.key}:${slot}`, label, 'audio', assetUrl(slot)))
        }
      }
      const discovered = warning ? [...(row.resources ?? []).filter((item) => item.source === 'auto' && !resources.some((resource) => resource.id === item.id)), ...resources] : resources
      result.push({ ...row, resources: mergeAutoResources(row, discovered), resourceStatus: warning ? 'error' : 'ready', resourceError: warning || undefined })
    } catch (error) {
      result.push({ ...row, resourceStatus: 'error', resourceError: error instanceof Error ? error.message : '读取资源失败，请重试' })
    }
  }
  return result
}

export function sentenceContent(key: string, target: string, text: string) {
  const passage = findPassageByKey(key)
  const clip = listeningClipsFor(passage).find((item) => item.target === target)
  return [{ title: '句子', text, translation: clip?.chinese }]
}
