import { describe, expect, it } from 'vitest'
import { buildStudentProfilePrompt, todayInShanghai, type StudentProfile } from '@rosie/ai'

const profile: StudentProfile = {
  generatedAt: '2026-08-11T00:00:00.000Z',
  today: '2026-08-11',
  subjects: {
    english: {
      activePlan: {
        kind: 'english_adaptive',
        title: '核心词计划',
        mode: 'normal',
        newWordsPerDay: 10,
        total: 80,
        pending: 10,
        learning: 20,
        mastered: 50,
        dueToday: 6,
      },
      plan: {
        weekStart: '2026-08-06',
        focus: 'Unit 1 / Lesson 2',
        todayAssigned: 3,
        todayCompleted: false,
      },
      mastery: { tracked: 20, due: 4, hard: 2, hardKeys: ['apple'] },
      unresolved: { count: 1, keys: ['apple'] },
    },
    math: {
      activePlan: {
        kind: 'math_multi_day',
        title: '暑期计算计划',
        startDate: '2026-08-10',
        endDate: '2026-08-15',
        lessonIds: ['35', '36'],
        todayAssigned: 4,
        todayCompleted: false,
        overdue: 1,
      },
      plan: null,
      mastery: { tracked: 10, due: 2, hard: 1, hardKeys: ['35-L1'] },
      unresolved: { count: 2, keys: ['35-L1'] },
    },
    chinese: {
      activePlan: {
        kind: 'chinese_roadmap',
        title: '二年级语文',
        currentLessonKey: 'g2a-u1-l2',
        lessonsPerBatch: 2,
        completedLessons: 3,
        latestAccuracy: 88,
      },
      plan: null,
      mastery: { tracked: 8, due: 1, hard: 0, hardKeys: [] },
      unresolved: { count: 0, keys: [] },
    },
  },
  calc: { unresolvedCount: 3, recentSignatures: [] },
}

describe('student profile', () => {
  it('formats a subject-scoped prompt without leaking item keys', () => {
    const prompt = buildStudentProfilePrompt(profile, 'english')
    expect(prompt).toContain('自适应计划')
    expect(prompt).toContain('今日到期6')
    expect(prompt).toContain('未解决错题1')
    expect(prompt).not.toContain('apple')
    expect(prompt).not.toContain('math:')
  })

  it('prefers the active Chinese roadmap over the weekly fallback', () => {
    const prompt = buildStudentProfilePrompt(profile, 'chinese')
    expect(prompt).toContain('路线图计划')
    expect(prompt).toContain('最近正确率88%')
    expect(prompt).not.toContain('暂无学习计划')
  })

  it('describes the current math multi-day plan', () => {
    const prompt = buildStudentProfilePrompt(profile, 'math')
    expect(prompt).toContain('多日计划')
    expect(prompt).toContain('今日4题')
    expect(prompt).toContain('逾期未完成1题')
  })

  it('uses the configured Shanghai learning date', () => {
    expect(todayInShanghai(new Date('2026-08-10T16:30:00.000Z'))).toBe('2026-08-11')
  })
})
