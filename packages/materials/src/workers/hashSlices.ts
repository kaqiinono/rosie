import SparkMD5 from 'spark-md5'
export async function hashSlices(file: Blob, progress: (done: number) => void = () => {}) {
  const hashes: string[] = []
  for (let start = 0; start < file.size; start += 4194304) {
    const buffer = await file.slice(start, start + 4194304).arrayBuffer()
    hashes.push(SparkMD5.ArrayBuffer.hash(buffer))
    progress(Math.min(file.size, start + 4194304))
  }
  return hashes
}
