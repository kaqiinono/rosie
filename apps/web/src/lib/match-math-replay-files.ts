import type { MathVideoEditor, VideoProblem } from './baidu-math-video-report-types'

const chineseLabels: Record<string, string> = {
  '例题': 'l', '附加': 's', '附加题': 's', '补充题': 's',
  '练习': 'h', '课后': 'h', '课后题': 'h', '课前测': 'p', '练习册': 'w',
}

// Shared folders can contain several lessons. Require an explicit lesson prefix
// and keep the entire business number (e.g. L1-1a is distinct from L1).
function videoLabel(name: string, lessonKey: string): string | null {
  const filename = name.normalize('NFKC').toLowerCase().replace(/[‐‑‒–—−]/g, '-').trim()
  const match = /^(?:g(\d+)[-_ ]+l(\d+)|(\d+)-(\d+))[-_ ]+(.+)\.mp4$/.exec(filename)
  if (!match || (match[1] ?? match[3]) + '-' + (match[2] ?? match[4]) !== lessonKey) return null
  const suffix = /(?:^|[-_ ·])(例题|附加题?|补充题|课后题?|练习册|练习|课前测|[lhpsw])\s*(\d+[a-z]?(?:-\d+[a-z]?)*)$/.exec(match[5]!)
  if (!suffix) return null
  return (chineseLabels[suffix[1]!] ?? suffix[1]!) + suffix[2]
}

export function matchMathReplayFiles(editor: MathVideoEditor, visible: VideoProblem[], picks: Record<string, string>) {
  const additions: Record<string, string> = {}
  const issues: Record<string, string> = {}
  const labels = new Map<string, number>()
  for (const problem of editor.problems) {
    const label = problem.label.toLowerCase()
    labels.set(label, (labels.get(label) ?? 0) + 1)
  }

  const candidates = new Map<string, string[]>()
  for (const [id, name] of Object.entries(editor.files)) {
    const label = videoLabel(name, editor.lessonKey)
    if (!label) continue
    const matches = candidates.get(label)
    if (matches) matches.push(id)
    else candidates.set(label, [id])
  }

  const owners = new Map(Object.entries(picks).map(([problem, file]) => [file, problem]))
  for (const problem of visible) {
    if (picks[problem.id]) continue
    const label = problem.label.toLowerCase()
    const files = candidates.get(label) ?? []
    const file = files[0]
    if (!file) {
      const parts = [...candidates.entries()]
        .filter(([key]) => key.slice(0, -1) === label && /[a-z]$/.test(key) && !labels.has(key))
        .flatMap(([, ids]) => ids.map(id => editor.files[id]))
      issues[problem.id] = parts.length
        ? '可能是分段视频，请核对：' + parts.join('、')
        : '没有找到讲次和题号一致的视频'
    } else if (labels.get(label) !== 1) {
      issues[problem.id] = '本讲有多道题使用这个题号'
    } else if (files.length > 1) {
      issues[problem.id] = '多个视频符合：' + files.map(id => editor.files[id]).join('、')
    } else {
      const owner = editor.occupied[file]?.problemId ?? owners.get(file)
      if (owner) issues[problem.id] = editor.files[file] + ' 已被 ' + owner + ' 占用'
      else additions[problem.id] = file
    }
  }
  return { additions, issues }
}
