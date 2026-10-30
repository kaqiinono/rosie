import { hashSlices } from './hashSlices'
const scope = globalThis as unknown as {
  onmessage: (e: MessageEvent<Blob>) => void
  postMessage: (d: unknown) => void
}
scope.onmessage = async (e) => {
  try {
    const hashes = await hashSlices(e.data, (done) => scope.postMessage({ done }))
    scope.postMessage({ done: e.data.size, hashes })
  } catch {
    scope.postMessage({ error: '文件校验失败', done: 0 })
  }
}
