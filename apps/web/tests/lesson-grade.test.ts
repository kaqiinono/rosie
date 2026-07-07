import { describe, it, expect } from 'vitest'
import {
  LESSON_GRADE,
  GRADE_LABEL,
  gradesInOrder,
  lessonsForGrade,
  gradeOf,
  lessonIdFromHref,
  lessonKeyFromHref,
  lessonDisplayNum,
  lessonDisplayLabel,
  highestGrade,
  gradeForNewLesson,
} from '@rosie/math/utils/lesson-grade'

describe('lesson-grade', () => {
  it('一年级讲次登记正确', () => {
    const keys = lessonsForGrade(1)
    expect(keys).toContain('1-35')
    expect(keys).toContain('1-12')
    expect(keys).not.toContain('2-1')
    expect(keys.every((id) => LESSON_GRADE[id] === 1)).toBe(true)
  })

  it('二年级讲次登记正确', () => {
    expect(LESSON_GRADE['2-1']).toBe(2)
    expect(LESSON_GRADE['49']).toBe(2) // legacy 键仍可用
    expect(lessonsForGrade(2)).toEqual(['2-1', '2-2', '2-3', '2-4', '2-5', '2-6'])
    expect(lessonDisplayNum('2-1')).toBe(1)
    expect(lessonDisplayNum('2-4')).toBe(4)
    expect(lessonDisplayLabel('2-1')).toBe('第 1 讲')
    expect(lessonDisplayLabel('2-4')).toBe('第 4 讲')
  })

  it('gradesInOrder 返回升序去重的年级', () => {
    expect(gradesInOrder()).toEqual([1, 2])
  })

  it('lessonsForGrade(1) 返回一年级全部讲次', () => {
    expect(lessonsForGrade(1)).toHaveLength(20)
    expect(lessonsForGrade(1)).toContain('1-35')
    expect(lessonsForGrade(1)).not.toContain('2-1')
  })

  it('gradeOf 取讲次年级，未登记返回 undefined', () => {
    expect(gradeOf('1-35')).toBe(1)
    expect(gradeOf('2-4')).toBe(2)
    expect(gradeOf('35')).toBe(1) // legacy
    expect(gradeOf('999')).toBeUndefined()
  })

  it('lessonIdFromHref 从路由取 lessonKey', () => {
    expect(lessonIdFromHref('/math/ny/1/35')).toBe('1-35')
    expect(lessonIdFromHref('/math/ny/2/4')).toBe('2-4')
    expect(lessonIdFromHref('/math/ny/1')).toBeUndefined()
    expect(lessonIdFromHref('/math/ny/52')).toBeUndefined()
    expect(lessonIdFromHref('/foo')).toBeUndefined()
  })

  it('lessonKeyFromHref 与 lessonIdFromHref 一致', () => {
    expect(lessonKeyFromHref('/math/ny/2/1')).toBe('2-1')
  })

  it('highestGrade 返回当前最高年级', () => {
    expect(highestGrade()).toBe(2)
  })

  it('gradeForNewLesson 未指定时取最高年级', () => {
    expect(gradeForNewLesson()).toBe(2)
    expect(gradeForNewLesson(1)).toBe(1)
  })

  it('GRADE_LABEL 覆盖到三年级', () => {
    expect(GRADE_LABEL[1]).toBe('一年级')
    expect(GRADE_LABEL[2]).toBe('二年级')
    expect(GRADE_LABEL[3]).toBe('三年级')
  })
})
