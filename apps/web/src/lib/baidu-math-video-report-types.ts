export type VideoProblemStatus = 'matched' | 'missing' | 'unknown' | 'conflict' | 'invalid_key'

export interface VideoProblemReportRow {
  problemId: string
  displayId: string | null
  label: string
  title: string
  grade: number | null
  lessonKey: string
  lessonLabel: string
  section: string
  sectionLabel: string
  href: string
  key: string | null
  matchBy: 'displayId' | 'id'
  expectedFilename: string | null
  expectedPath: string | null
  hasVideo: boolean | null
  status: VideoProblemStatus
  reason: string
  conflictingIds: string[]
}

export interface VideoFileReportRow {
  path: string
  filename: string
  key: string | null
  parsedQuestionNumber: string | null
  grade: number | null
  lessonKey: string | null
  status: 'orphan' | 'invalid_file'
  reason: string
}

export interface MathVideoReport {
  lessonKey: string
  syncedAt: string | null
  directory: string
  summary: {
    files: number
    matchedFiles: number
    videoKeys: number
    problems: number
    matched: number
    missing: number
    unknown: number
    conflictKeys: number
    invalidProblems: number
    orphanFiles: number
    invalidFiles: number
  }
  problems: VideoProblemReportRow[]
  files: VideoFileReportRow[]
}
