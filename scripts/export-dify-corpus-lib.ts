import fs from 'fs'
import path from 'path'
import type { Problem } from '@rosie/core'
import { SEA_LESSONS, SEA_POOL } from '../packages/math/src/utils/sea-data'

const SECTION_LABELS: Record<string, string> = {
  pretest: '课前测',
  lesson: '课堂',
  homework: '作业',
  workbook: '练习册',
  supplement: '补充题',
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong>/gi, '**')
    .replace(/<\/strong>/gi, '**')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

function formatMathProblem(
  p: Problem,
  meta: { lessonTitle: string; lessonId: string; section: string; href: string },
): string {
  const lines: string[] = []
  lines.push(`### ${p.id} · ${p.title}`)
  lines.push('')
  lines.push(`- 课程：${meta.lessonTitle}（第${meta.lessonId}讲）`)
  lines.push(`- 分区：${SECTION_LABELS[meta.section] ?? meta.section}`)
  lines.push(`- 题型：${p.tagLabel}`)
  lines.push(`- 难度：${p.difficulty} 星`)
  lines.push(`- 应用链接：${meta.href}`)
  if (p.figureNode) lines.push('- 备注：本题含图示，完整题目请打开应用链接查看')
  if (p.analysisImg) lines.push(`- 题解图片：${p.analysisImg}`)
  lines.push('')
  lines.push('**题目**')
  lines.push('')
  lines.push(stripHtml(p.text))
  lines.push('')
  if (p.finalQ) {
    lines.push(`**问题**：${stripHtml(p.finalQ)}（${p.finalUnit}）`)
    lines.push('')
  }
  if (p.analysis.length > 0) {
    lines.push('**解析**')
    lines.push('')
    for (const step of p.analysis) {
      lines.push(`- ${stripHtml(step)}`)
    }
    lines.push('')
  }
  lines.push(`**答案**：${p.finalAns}${p.finalUnit ? ` ${p.finalUnit}` : ''}`)
  lines.push('')
  lines.push('---')
  lines.push('')
  return lines.join('\n')
}

function exportMath(outDir: string): { problems: number } {
  const mathDir = path.join(outDir, 'math')
  fs.mkdirSync(mathDir, { recursive: true })

  let totalProblems = 0
  const sectionOrder = ['pretest', 'lesson', 'homework', 'workbook', 'supplement'] as const

  for (const lesson of SEA_LESSONS) {
    const chunks: string[] = [
      `# 数学题库 · ${lesson.title}`,
      '',
      `> Rosie 数学模块 · 第 ${lesson.id} 讲 · 共收录本讲全部题目（课前测/课堂/作业/练习册/补充）`,
      '',
    ]

    let lessonCount = 0
    for (const section of sectionOrder) {
      const list = (lesson.problems as Record<string, Problem[]>)[section]
      if (!list?.length) continue
      chunks.push(`## ${SECTION_LABELS[section] ?? section}`)
      chunks.push('')
      list.forEach((p, i) => {
        const href = `/math/ny/${lesson.id}/${section}/${i + 1}`
        chunks.push(formatMathProblem(p, {
          lessonTitle: lesson.title,
          lessonId: lesson.id,
          section,
          href,
        }))
        lessonCount++
      })
    }

    if (lessonCount === 0) continue
    totalProblems += lessonCount
    fs.writeFileSync(path.join(mathDir, `lesson-${lesson.id}.md`), chunks.join('\n'), 'utf8')
  }

  const indexLines: string[] = [
    '# 数学题库总索引',
    '',
    `> 共 ${SEA_POOL.length} 道题，分布在 ${SEA_LESSONS.length} 个课程中`,
    '',
    '| ID | 课程 | 分区 | 标题 | 链接 |',
    '| --- | --- | --- | --- | --- |',
  ]
  for (const item of SEA_POOL) {
    const p = item.problem
    indexLines.push(
      `| ${p.id} | 第${item.lessonId}讲 | ${SECTION_LABELS[item.section] ?? item.section} | ${p.title.replace(/\|/g, '\\|')} | ${item.href} |`,
    )
  }
  fs.writeFileSync(path.join(mathDir, '_index.md'), indexLines.join('\n'), 'utf8')

  return { problems: totalProblems }
}

function writeReadme(outDir: string, mathStats: { problems: number }): void {
  const readme = `# Dify 知识库 · 数学题库

本目录由 \`pnpm corpus:export\` 自动生成，可直接上传到 Dify 知识库。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| \`math/lesson-12.md\` … \`lesson-47.md\` | 按课程分拆，每文件含该讲全部题目（题干+解析+答案+应用链接） |
| \`math/_index.md\` | 全库索引表（${mathStats.problems} 题） |

## 上传到 Dify

1. 进入 Dify → **知识库** → **创建知识库** → **导入已有文本**
2. 上传 \`math/lesson-*.md\`（推荐按课程分拆，检索更准）
3. 分段策略：**按 Markdown 标题分段**（\`###\` = 单题粒度）
4. 题目有更新后重新运行 \`pnpm corpus:export\`

## 注意

- 部分题目含图示（\`figureNode\`），语料中已标注，完整题目请打开应用链接
- 英语词库请从 Supabase \`word_entries\` 单独导出

生成时间：${new Date().toISOString()}
`
  fs.writeFileSync(path.join(outDir, 'README.md'), readme, 'utf8')
}

/** Export all math problems as Markdown files for Dify knowledge base upload. */
export function exportMathCorpus(outDir: string): { problems: number } {
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true })
  }
  fs.mkdirSync(outDir, { recursive: true })

  const mathStats = exportMath(outDir)
  writeReadme(outDir, mathStats)
  return mathStats
}
