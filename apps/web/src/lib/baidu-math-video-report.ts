import 'server-only'
import { SOURCE_LABELS } from '@rosie/core'
import { SEA_LESSON_MAP } from '@rosie/math/utils/sea-data'
import { lessonByKey, routeForLesson } from '@rosie/math-kit/utils/lesson-registry'
import { problemCardDisplayId } from '@rosie/math-kit/utils/problem-display-id'
import { MATH_VIDEO_DIRECTORY, problemVideoKey, problemVideoPath } from '@rosie/math-kit/utils/problem-video'
import { videoKeyFromPath, type MathVideoSnapshot } from './baidu-math-video-catalog'
import type { MathVideoReport, VideoFileReportRow, VideoProblemReportRow } from './baidu-math-video-report-types'

/** Pure comparison: only the manual sync route ever enumerates the remote directory. */
export function buildMathVideoReport(snapshot: MathVideoSnapshot): MathVideoReport {
  const selectedLesson = lessonByKey(snapshot.lessonKey)
  const content = SEA_LESSON_MAP[snapshot.lessonKey]
  if (!selectedLesson || !content) throw new Error('invalid_lesson')
  const sections = ['pretest', 'lesson', 'homework', 'workbook', 'supplement'] as const
  const scopedEntries = sections.flatMap((section) => (content.problems[section] ?? []).map((problem, index) => ({
    problem, lessonId: snapshot.lessonKey, section,
    href: `${routeForLesson(selectedLesson)}/${section}/${index + 1}`,
  })))
  const entries = [...new Map(scopedEntries.map((entry) => [entry.problem.id, entry])).values()]
  const idsByKey = new Map<string, string[]>()
  for (const { problem } of entries) {
    const key = problemVideoKey(problem)
    if (key) idsByKey.set(key, [...(idsByKey.get(key) ?? []), problem.id])
  }
  const available = new Set(snapshot.keys)
  const problems: VideoProblemReportRow[] = entries.map(({ problem, lessonId, section, href }) => {
    const lesson = lessonByKey(lessonId)
    const key = problemVideoKey(problem)
    const conflictingIds = key ? (idsByKey.get(key) ?? []).filter((id) => id !== problem.id) : []
    const hasVideo = snapshot.syncedAt === null || !key ? null : available.has(key)
    const status = !key ? 'invalid_key' : conflictingIds.length ? 'conflict' : hasVideo === null ? 'unknown' : hasVideo ? 'matched' : 'missing'
    const reason = status === 'invalid_key' ? '题目编号无法生成有效视频文件名。'
      : status === 'conflict' ? '多个题目生成了同一个视频 key，请核对实际 ID 与 displayId。'
      : status === 'unknown' ? '尚未成功同步，无法判断视频是否存在。'
      : status === 'matched' ? '本次快照包含完全一致的视频文件路径。'
      : '本次快照没有匹配文件，请核对文件名、大小写和存放目录；不代表一定未上传。'
    return {
      problemId: problem.id, displayId: problem.displayId?.trim() || null,
      label: problemCardDisplayId(problem), title: problem.title,
      grade: lesson?.grade ?? null, lessonKey: lessonId,
      lessonLabel: `${lesson?.grade ?? '?'}年级 · ${SEA_LESSON_MAP[lessonId]?.title ?? lessonId}`,
      section, sectionLabel: SOURCE_LABELS[section] ?? section, href, key,
      matchBy: problem.displayId?.trim() ? 'displayId' : 'id',
      expectedFilename: key ? `${key}.mp4` : null,
      expectedPath: key ? problemVideoPath(key) : null,
      hasVideo, status, reason, conflictingIds,
    }
  })
  const files: VideoFileReportRow[] = snapshot.filePaths.flatMap((path): VideoFileReportRow[] => {
    const key = videoKeyFromPath(path)
    if (key && idsByKey.has(key)) return []
    const filename = path.slice(path.lastIndexOf('/') + 1)
    const prefix = /^(\d+)-(\d+)-/.exec(filename)
    const reason = key ? '文件名合法，但当前题库没有题目使用这个视频 key。'
      : path.slice(0, path.lastIndexOf('/')) !== MATH_VIDEO_DIRECTORY ? '文件不在指定目录的直接子级。'
      : !filename.endsWith('.mp4') ? '扩展名不符合规则，仅支持小写 .mp4。'
      : '文件名不符合「年级-讲次-题号.mp4」规则。'
    return [{
      path, filename, key, grade: prefix ? Number(prefix[1]) : null,
      parsedQuestionNumber: prefix ? filename.slice(prefix[0].length).replace(/\.[^.]*$/, '') || null : null,
      lessonKey: prefix ? `${prefix[1]}-${prefix[2]}` : null,
      status: key ? 'orphan' : 'invalid_file', reason,
    }]
  })
  return {
    lessonKey: snapshot.lessonKey, syncedAt: snapshot.syncedAt, directory: MATH_VIDEO_DIRECTORY, problems, files,
    summary: {
      files: snapshot.filePaths.length, videoKeys: available.size, problems: problems.length,
      matchedFiles: snapshot.filePaths.length - files.length,
      matched: problems.filter((row) => row.hasVideo === true).length,
      missing: problems.filter((row) => row.hasVideo === false).length,
      unknown: problems.filter((row) => row.hasVideo === null).length,
      conflictKeys: [...idsByKey.values()].filter((ids) => ids.length > 1).length,
      invalidProblems: problems.filter((row) => row.status === 'invalid_key').length,
      orphanFiles: files.filter((row) => row.status === 'orphan').length,
      invalidFiles: files.filter((row) => row.status === 'invalid_file').length,
    },
  }
}
