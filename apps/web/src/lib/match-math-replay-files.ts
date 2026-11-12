import type { MathVideoEditor, VideoProblem } from './baidu-math-video-report-types'

const chineseLabels: Record<string, string> = {
  '例题': 'l', '附加': 's', '附加题': 's', '补充题': 's',
  '练习': 'h', '课后': 'h', '课后题': 'h', '课前测': 'p', '练习册': 'w',
}
const questionNumber = /(?:例题|附加题?|补充题|课后题?|练习册|练习|课前测|(?<![a-z0-9])[lhpsw])\s*(\d+[a-z]?(?:-\d+[a-z]?)*)(?![a-z0-9])/g

function normalize(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/[‐‑‒–—−]/g, '-').trim()
}

function titleText(text: string) {
  return normalize(text).replace(/[\s\p{P}]/gu, '')
}

function matchesLessonNumber(text: string, number: number) {
  if (/^\d+$/.test(text)) return Number(text) === number
  const digits = '零一二三四五六七八九'
  if (number < 10) return text === digits[number]
  const tens = Math.floor(number / 10)
  const units = number % 10
  return text === (tens === 1 ? '' : digits[tens]) + '十' + (units ? digits[units] : '')
}

function lessonFileStem(name: string, lessonKey: string) {
  if (!/\.mp4$/i.test(name)) return null
  let stem = normalize(name.slice(0, -4))
  const [grade, lesson] = lessonKey.split('-').map(Number)
  const prefix = /^(\d+)-(\d+)(?=$|[^a-z0-9])/.exec(stem)
  if (prefix) {
    if (+prefix[1] !== grade || +prefix[2] !== lesson) return null
    stem = stem.slice(prefix[0].length)
  }
  for (const marker of stem.matchAll(/g(\d+)[\s_-]*l(\d+)/g)) {
    if (+marker[1] !== grade || +marker[2] !== lesson) return null
  }
  stem = stem.replace(/g\d+[\s_-]*l\d+/g, '')
  for (const marker of stem.matchAll(/([\d一二三四五六七八九十]+)年级|第\s*([\d一二三四五六七八九十]+)\s*讲/g)) {
    if (marker[1] ? !matchesLessonNumber(marker[1], grade) : !matchesLessonNumber(marker[2], lesson)) return null
    stem = stem.replace(marker[0], '')
  }
  return stem.trim().replace(/^[-_\s]+|[-_\s]+$/g, '')
}

function canonicalNumber(number: string) {
  return number.replace(/\d+/g, digits => String(Number(digits)))
}

export function matchMathReplayFiles(editor: MathVideoEditor, visible: VideoProblem[], picks: Record<string, string>) {
  const additions: Record<string, string> = {}
  const issues: Record<string, string> = {}
  const problems = editor.problems.map(p => {
    // Catalog titles often carry a textbook heading, e.g. “例题2 · 腿数差”.
    const topic = p.title.replace(/^\s*(?:例题|练一练|练习|附加|补充题|课前测|课后|小测验)[^·]*·\s*/, '')
    return { id: p.id, label: canonicalNumber(normalize(p.label)), title: titleText(p.title), topic: titleText(topic) }
  })
  const candidates = new Map<string, string[]>()
  const warnings = new Map<string, string>()

  for (const [fileId, name] of Object.entries(editor.files)) {
    const stem = lessonFileStem(name, editor.lessonKey)
    if (!stem) continue
    const numbers = new Set<string>()
    const description = stem.replace(questionNumber, (token: string, number: string) => {
      const prefix = token.slice(0, token.indexOf(number)).trim()
      numbers.add((chineseLabels[prefix] ?? prefix) + canonicalNumber(number))
      return ' '
    })
    const numeric = /^\d+$/.test(stem)
    const hasNumber = numeric || numbers.size > 0
    const byNumber = problems.filter(p => numeric
      ? p.label.replace(/^[lhpsw]/, '') === canonicalNumber(stem)
      : numbers.has(p.label))
    const full = titleText(stem)
    const text = titleText(description)
    const withHeading = problems.filter(p => p.title !== p.topic && p.topic && full.includes(p.title))
    const byTitle = withHeading.length ? withHeading : problems.filter(p => p.topic && text.includes(p.topic))
    const matches = hasNumber && byTitle.length
      ? byNumber.filter(p => byTitle.includes(p))
      : hasNumber ? byNumber : byTitle

    if (numbers.size > 1 || (hasNumber && byTitle.length && !matches.length)) {
      for (const p of [...byNumber, ...byTitle]) warnings.set(p.id, '文件中的题号或标题互相冲突：' + name)
    } else if (matches.length > 1) {
      for (const p of matches) warnings.set(p.id, '文件对应本讲多道题：' + name)
    } else if (matches.length === 1) {
      const id = matches[0].id
      const files = candidates.get(id) ?? []
      files.push(fileId)
      candidates.set(id, files)
    } else {
      for (const label of numbers) {
        if (!/[a-z]$/.test(label)) continue
        for (const p of problems.filter(p => p.label === label.slice(0, -1))) {
          warnings.set(p.id, '可能是分段视频，请核对：' + name)
        }
      }
    }
  }

  const owners = new Map(Object.entries(picks).map(([problem, file]) => [file, problem]))
  for (const problem of visible) {
    if (picks[problem.id]) continue
    const warning = warnings.get(problem.id)
    const files = candidates.get(problem.id) ?? []
    const file = files[0]
    if (warning) issues[problem.id] = warning
    else if (!file) issues[problem.id] = '没有找到题号或标题对应的视频'
    else if (files.length > 1) issues[problem.id] = '多个视频符合：' + files.map(id => editor.files[id]).join('、')
    else {
      const owner = editor.occupied[file]?.problemId ?? owners.get(file)
      if (owner) issues[problem.id] = editor.files[file] + ' 已被 ' + owner + ' 占用'
      else additions[problem.id] = file
    }
  }
  return { additions, issues }
}
