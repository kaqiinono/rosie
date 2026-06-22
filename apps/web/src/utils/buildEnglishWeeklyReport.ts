import type { EnglishWeeklyReport } from '@/utils/type'
import type { WordEntry, WeeklyPlan, WordMasteryMap } from '@/utils/type'
import { ALL_CN_DAYS, classifyPlanWords, fmtDate, fmtWeekRange, wordKey } from '@/utils/english-helpers'
import { ensureStageInit, getWordMasteryLevel } from '@/utils/masteryUtils'
import { todayStr } from '@/utils/constant'

function formatUnitLesson(plan: WeeklyPlan): string {
  const units = plan.unit.split(', ')
  const lessons = plan.lesson.split(', ')
  const allSameUnit = units.every((u) => u === units[0])
  if (allSameUnit) {
    return `${units[0]} · ${lessons.join(', ')}`
  }
  return units.map((u, i) => `${u} · ${lessons[i] ?? ''}`).join('，')
}

/**
 * Build a detailed end-of-week report for the English weekly plan (display + persistence).
 */
export function buildEnglishWeeklyReport(
  plan: WeeklyPlan,
  vocab: WordEntry[],
  masteryMap: WordMasteryMap,
): EnglishWeeklyReport {
  const today = todayStr()
  const weekRangeLabel = fmtWeekRange(plan.weekStart, plan.weekStartDay)
  const unitLessonLabel = formatUnitLesson(plan)
  const generatedAt = new Date().toISOString()
  const planClassification = classifyPlanWords(plan, vocab)
  const daysInWeek = plan.days.length

  const byDay = plan.days.map((day, i) => {
    const wd = (plan.weekStartDay + i) % 7
    const p = plan.progress[day.date]
    return {
      date: day.date,
      weekdayLabel: ALL_CN_DAYS[wd],
      displayDate: fmtDate(day.date),
      hadSession: p?.quizDone === true,
      lastScore: p?.lastScore !== undefined ? p.lastScore : null,
    }
  })

  let daysWithQuiz = 0
  const scores: number[] = []
  let highScoreDays = 0
  let lowScoreDays = 0
  for (const d of byDay) {
    if (d.hadSession) {
      daysWithQuiz += 1
      if (d.lastScore !== null) {
        scores.push(d.lastScore)
        if (d.lastScore >= 90) highScoreDays += 1
        if (d.lastScore < 60) lowScoreDays += 1
      }
    }
  }

  const sum = scores.reduce((a, b) => a + b, 0)
  const averageQuizScore = scores.length > 0 ? Math.round((sum / scores.length) * 10) / 10 : null
  const dayCompletionRatePercent =
    daysInWeek > 0 ? Math.round((daysWithQuiz / daysInWeek) * 100) : 0

  const keyToEntry = new Map<string, WordEntry>()
  for (const w of vocab) keyToEntry.set(wordKey(w), w)

  const allKeys = new Set<string>()
  for (const day of plan.days) for (const k of day.newWordKeys) allKeys.add(k)

  let consolidateCount = 0
  let previewCount = 0
  for (const k of allKeys) {
    if (planClassification.get(k) === 'preview') previewCount += 1
    else consolidateCount += 1
  }

  let consolidateMet = 0
  for (const k of allKeys) {
    if (planClassification.get(k) !== 'consolidate') continue
    const st = ensureStageInit(masteryMap[k] ?? { correct: 0, incorrect: 0, lastSeen: today }, today)
    if ((st.stage ?? 0) >= 2) consolidateMet += 1
  }

  const spotlightCandidates: EnglishWeeklyReport['spotlightWords'] = []
  for (const k of allKeys) {
    const entry = keyToEntry.get(k)
    if (!entry) continue
    const kind = planClassification.get(k) === 'preview' ? 'preview' : 'consolidate'
    const m = masteryMap[k]
    const level = getWordMasteryLevel(m?.correct ?? 0)
    const st = ensureStageInit(m ?? { correct: 0, incorrect: 0, lastSeen: today }, today)
    spotlightCandidates.push({
      word: entry.word,
      kind,
      stage: st.stage ?? 0,
      level,
    })
  }
  spotlightCandidates.sort((a, b) => b.stage - a.stage || b.level - a.level)
  const spotlightWords = spotlightCandidates.slice(0, 14)

  const missedDays = byDay.filter((d) => d.date < today && !d.hadSession)
  const weakScoreDays = byDay.filter((d) => d.hadSession && d.lastScore !== null && d.lastScore < 60)

  const narrative: string[] = []
  narrative.push(
    `本报告覆盖 ${weekRangeLabel}，教材范围：${unitLessonLabel}。计划按「周四起一周」共 ${daysInWeek} 个学习日排布，每日新词约 ${plan.newWordsPerDay} 个。`,
  )
  narrative.push(
    daysWithQuiz === 0
      ? '本周尚未在 App 中完成任何一天的测验打卡；若已在纸质或其他方式学习，可继续用「开始练习」补做日测以留下记录。'
      : `在 ${daysInWeek} 天中，有 ${daysWithQuiz} 天完成了至少一次测验（系统以当日测验结束为准），日完成度约 ${dayCompletionRatePercent}%。`,
  )
  if (averageQuizScore !== null) {
    narrative.push(
      `已记录分数的日测平均约为 ${averageQuizScore}%。其中「高分日」（≥90%）共 ${highScoreDays} 天；若低于 60% 的日测有 ${lowScoreDays} 天，建议回放错题与释义并缩短复习间隔。`,
    )
  } else if (daysWithQuiz > 0) {
    narrative.push('部分日测未留下百分制分数，可重新练习该日以得到更完整的数据。')
  }
  narrative.push(
    consolidateCount > 0
      ? `必记（巩固）向词汇共 ${consolidateCount} 个，其中约 ${consolidateMet} 个已达到阶段 2 及以上的巩固线（按当前掌握度与间隔复习算法估算）。预习向词汇 ${previewCount} 个，用于提前接触下一课。`
      : '本周以预习向词汇为主，适合建立语音与词形印象，后续周会逐步转入必记巩固。',
  )
  if (allKeys.size > 0) {
    const top = spotlightWords[0]
    if (top) {
      narrative.push(
        `当前榜单里掌握度较突出的是「${top.word}」（${top.kind === 'consolidate' ? '必记' : '预习'}，约阶段 ${top.stage}）。保持每日小剂量复习比一次长时间突击更利于长期记忆。`,
      )
    }
  }

  const suggestions: string[] = []
  if (missedDays.length > 0) {
    suggestions.push(
      `有 ${missedDays.length} 个已过去的日期尚未完成日测：${missedDays.map((d) => d.displayDate + d.weekdayLabel).join('、')}。若仍在本周期内，可集中补做以拉齐进度。`,
    )
  }
  if (consolidateCount > 0 && consolidateMet < consolidateCount) {
    suggestions.push(
      `必记词仍有 ${consolidateCount - consolidateMet} 个未达阶段 2，建议结合「仅看释义」模式多次短测，并关注橙红标出的预习词在下周一并转入必记。`,
    )
  }
  if (weakScoreDays.length > 0) {
    suggestions.push(
      `有 ${weakScoreDays.length} 天日测分数偏低，可对该日词表逐词朗读例句，并在第二天用题型 B（词→义）再测一次。`,
    )
  }
  if (suggestions.length === 0) {
    suggestions.push('保持当前节奏：每天先快速过词表，再进入测验；周末可浏览本周所有必记词一次总复习。')
    suggestions.push('若学有余力，可把预习词提前造句或口头造个小故事，帮助语义网络形成。')
  }
  suggestions.push('下一周开新单元前，建议用「错词/低分日」回炉一遍，再开始新词，负担更小。')

  return {
    version: 1,
    weekRangeLabel,
    unitLessonLabel,
    generatedAt,
    execution: {
      daysInWeek,
      daysWithQuiz,
      dayCompletionRatePercent,
      averageQuizScore,
      highScoreDays,
      lowScoreDays,
    },
    byDay,
    vocabulary: {
      totalPlanWordKeys: allKeys.size,
      consolidateCount,
      previewCount,
      consolidateMet,
      newWordSlotsPerDay: plan.newWordsPerDay,
    },
    spotlightWords,
    narrative,
    suggestions,
  }
}
