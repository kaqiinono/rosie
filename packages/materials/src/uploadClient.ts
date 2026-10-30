import type { MaterialSubject } from './types'
export const UPLOAD_PART_SIZE = 4194304
export type UploadProgress = {
  phase: 'hashing' | 'uploading' | 'verifying'
  done: number
  total: number
}
export type UploadStatus = {
  id: string
  name: string
  size: number
  subject: MaterialSubject
  mime: string
  hashes: string[]
  state: string
  asset_id: string | null
  partSize: number
  missingParts: number[]
  error?: string
}
export async function hashFile(
  file: Blob,
  progress: (done: number) => void = () => {},
  signal?: AbortSignal,
) {
  // Worker sees a File handle; only one 4MiB slice is read at a time.
  const worker = new Worker(new URL('./workers/uploadHash.worker.ts', import.meta.url))
  let abort: () => void = () => {}
  try {
    return await new Promise<string[]>((resolve, reject) => {
      abort = () => reject(signal?.reason ?? Error('取消'))
      if (signal?.aborted) {
        abort()
        return
      }
      signal?.addEventListener('abort', abort, { once: true })
      worker.onmessage = (e: MessageEvent<{ hashes?: string[]; done: number; error?: string }>) => {
        progress(e.data.done)
        if (e.data.error) reject(Error(e.data.error))
        if (e.data.hashes) resolve(e.data.hashes)
      }
      worker.onerror = () => reject(Error('文件校验失败'))
      worker.postMessage(file)
    })
  } finally {
    signal?.removeEventListener('abort', abort)
    worker.terminate()
  }
}
export async function uploadFile(
  file: File,
  subject: MaterialSubject,
  token: string,
  options: {
    sessionId?: string
    signal?: AbortSignal
    hash?: (file: Blob, progress: (done: number) => void, signal?: AbortSignal) => Promise<string[]>
    progress?: (p: UploadProgress) => void
    session?: (s: UploadStatus) => void
  } = {},
) {
  if (!subject || file.size < 1 || file.size > 2147483648)
    throw Error('请选择科目及 1 字节至 2 GiB 的文件')
  const operation = new AbortController()
  const forwardAbort = () => operation.abort(options.signal?.reason)
  if (options.signal?.aborted) forwardAbort()
  else options.signal?.addEventListener('abort', forwardAbort, { once: true })
  const signal = operation.signal,
    progress = options.progress ?? (() => {})
  try {
    const hashes = await (options.hash ?? hashFile)(
      file,
      (done) => progress({ phase: 'hashing', done, total: file.size }),
      signal,
    )
    signal?.throwIfAborted()
    async function request(path: string, init: RequestInit = {}) {
      const r = await fetch('/api/materials/uploads' + path, {
        ...init,
        signal,
        headers: { Authorization: `Bearer ${token}`, ...init.headers },
      })
      const d = await r.json()
      if (!r.ok) throw Error(d.error ?? '上传失败')
      return d as UploadStatus
    }
    let s = options.sessionId
      ? await request('/' + encodeURIComponent(options.sessionId))
      : await request('', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            mime: file.type || 'application/octet-stream',
            subject,
            hashes,
          }),
        })
    if (
      s.name !== file.name ||
      s.size !== file.size ||
      s.subject !== subject ||
      JSON.stringify(s.hashes) !== JSON.stringify(hashes)
    )
      throw Error('续传文件不匹配，请重新选择原文件及科目')
    options.session?.(s)
    if (s.state === 'cancelled') throw Error('会话已取消')
    if (s.state === 'initializing') {
      s = await request(`/${s.id}/prepare`, { method: 'POST' })
      options.session?.(s)
    }
    if (s.error) throw Error('预上传结果未确认；保留会话编号可核验结果，或取消后重新开始')
    const queue = [...s.missingParts]
    let failed = false
    let done =
      file.size -
      queue.reduce((n, i) => n + Math.min(UPLOAD_PART_SIZE, file.size - i * UPLOAD_PART_SIZE), 0)
    async function lane() {
      while (queue.length && !failed) {
        signal?.throwIfAborted()
        const part = queue.shift()!
        let succeeded = false
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await request(`/${s.id}/parts/${part}`, {
              method: 'PUT',
              body: file.slice(
                part * UPLOAD_PART_SIZE,
                Math.min(file.size, (part + 1) * UPLOAD_PART_SIZE),
              ),
            })
            succeeded = true
            break
          } catch (e) {
            if (signal?.aborted || attempt === 2) {
              throw e
            }
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(
                () => {
                  signal?.removeEventListener('abort', abort)
                  resolve()
                },
                500 * 2 ** attempt,
              )
              const abort = () => {
                clearTimeout(timer)
                signal.removeEventListener('abort', abort)
                reject(signal?.reason ?? Error('取消'))
              }
              signal?.addEventListener('abort', abort, { once: true })
            })
          }
        }
        if (succeeded) {
          done += Math.min(UPLOAD_PART_SIZE, file.size - part * UPLOAD_PART_SIZE)
          progress({ phase: 'uploading', done, total: file.size })
        }
      }
    }
    if (s.state === 'uploading') {
      let failure: unknown
      const runLane = async () => {
        try {
          await lane()
        } catch (error) {
          if (!failed) {
            failed = true
            failure = error
            operation.abort(error)
          }
          throw error
        }
      }
      // Aborting fetch is asynchronous. Retain operation ownership until BOTH lanes settle,
      // so an immediate retry cannot overlap a leftover PUT from this operation.
      await Promise.allSettled([runLane(), runLane()])
      if (failed) throw failure
    }
    progress({ phase: 'verifying', done: file.size, total: file.size })
    s = await request(`/${s.id}/complete`, { method: 'POST' })
    options.session?.(s)
    if (s.state !== 'ready' || !s.asset_id)
      throw Error('合并结果待核验，请使用同一会话重试；不会重复创建文件')
    return s
  } finally {
    options.signal?.removeEventListener('abort', forwardAbort)
  }
}
