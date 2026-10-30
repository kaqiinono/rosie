import 'server-only'
import type { ScanPage, ScanState } from './baidu-material-catalog'
/** Browser transport is bounded independently of the provider page and durable inventory. */
export const MATERIAL_RESULT_PAGE_SIZE = 100
export const MATERIAL_RESPONSE_BYTE_LIMIT = 128 * 1024
const pageByteLimit = 120 * 1024 // leave8KiB for bounded recovery/config metadata
export function materialScanPage(
  sessionId: string,
  state: ScanState,
  revision: number,
  offset = 0,
): ScanPage {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > state.entries.length)
    throw Error('invalid_result_offset')
  const page: ScanPage = {
    sessionId,
    files: [],
    folders: [],
    cursor: state.complete ? null : String(revision),
    complete: state.complete,
    revision,
    resultOffset: offset,
    nextResultOffset: null,
    fileCount: 0,
    folderCount: 0,
  }
  for (const entry of state.entries)
    if (entry.isdir) page.folderCount++
    else page.fileCount++
  let end = offset
  while (end < state.entries.length && end - offset < MATERIAL_RESULT_PAGE_SIZE) {
    const entry = state.entries[end],
      target = entry.isdir ? page.folders : page.files
    target.push(entry)
    if (Buffer.byteLength(JSON.stringify(page), 'utf8') > pageByteLimit) {
      target.pop()
      if (end === offset) throw Error('scan_entry_too_large')
      break
    }
    end++
  }
  page.nextResultOffset = end < state.entries.length ? end : null
  return page
}
