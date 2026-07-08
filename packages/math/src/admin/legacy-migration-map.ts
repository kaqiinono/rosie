/**
 * 历史迁移映射 — 仅用于审计页检测 Supabase 中残留的 legacy ID。
 * 运行时注册表（lesson-registry）不再包含这些字段。
 */
export const LEGACY_TO_LESSON_KEY: Record<string, string> = {
  '12': '1-12',
  '13': '1-13',
  '15': '1-15',
  '18': '1-18',
  '23': '1-23',
  '29': '1-29',
  '30': '1-30',
  '34': '1-34',
  '35': '1-35',
  '36': '1-36',
  '37': '1-37',
  '38': '1-38',
  '39': '1-39',
  '40': '1-40',
  '41': '1-41',
  '42': '1-42',
  '43': '1-43',
  '44': '1-44',
  '46': '1-46',
  '47': '1-47',
  '49': '2-1',
  '50': '2-2',
  '51': '2-3',
  '52': '2-4',
  '53': '2-5',
  '55': '2-6',
  '56': '2-7',
}

export const LESSON_KEY_TO_LEGACY: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_TO_LESSON_KEY).map(([legacy, key]) => [key, legacy]),
)

export const LEGACY_ID_SET = new Set(Object.keys(LEGACY_TO_LESSON_KEY))

export function legacyIdForLessonKey(lessonKey: string): string | undefined {
  return LESSON_KEY_TO_LEGACY[lessonKey]
}

export function migrateProblemIdForAudit(problemId: string): string | null {
  if (problemId.endsWith('__SUMMARY')) {
    const prefix = problemId.slice(0, -'__SUMMARY'.length)
    const key = LEGACY_TO_LESSON_KEY[prefix] ?? (LESSON_KEY_TO_LEGACY[prefix] ? prefix : null)
    return key ? `${key}__SUMMARY` : null
  }
  const parts = problemId.split('-')
  if (parts.length >= 3 && /^\d+$/.test(parts[0]!) && /^\d+$/.test(parts[1]!)) {
    const key = `${parts[0]}-${parts[1]}`
    if (LESSON_KEY_TO_LEGACY[key]) return problemId
    return null
  }
  const legacyPrefix = parts[0]!
  const key = LEGACY_TO_LESSON_KEY[legacyPrefix]
  if (!key || parts.length < 2) return null
  return `${key}-${parts.slice(1).join('-')}`
}

export function legacyPrefixFromProblemId(problemId: string): string | null {
  if (problemId.endsWith('__SUMMARY')) {
    const prefix = problemId.slice(0, -'__SUMMARY'.length)
    return LEGACY_ID_SET.has(prefix) ? prefix : null
  }
  for (const legacy of [...LEGACY_ID_SET].sort((a, b) => b.length - a.length)) {
    if (problemId.startsWith(`${legacy}-`)) return legacy
  }
  return null
}
