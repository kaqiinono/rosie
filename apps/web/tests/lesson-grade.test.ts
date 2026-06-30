import { describe, it, expect } from 'vitest'
import {
  LESSON_GRADE,
  GRADE_LABEL,
  gradesInOrder,
  lessonsForGrade,
  gradeOf,
  lessonIdFromHref,
  lessonDisplayNum,
  lessonDisplayLabel,
  highestGrade,
  gradeForNewLesson,
} from '@rosie/math/utils/lesson-grade'

describe('lesson-grade', () => {
  it('现有 20 讲全部属于一年级', () => {
    const ids = ['12','13','15','18','23','29','30','34','35','36','37','38','39','40','41','42','43','44','46','47']
    expect(ids.every((id) => LESSON_GRADE[id] === 1)).toBe(true)
    expect(ids.every((id) => Object.keys(LESSON_GRADE).includes(id))).toBe(true)
  })

  it('第 49 讲属于二年级', () => {
    expect(LESSON_GRADE['49']).toBe(2)
    expect(gradeOf('49')).toBe(2)
    expect(lessonsForGrade(2)).toEqual(['49'])
    expect(lessonDisplayNum('49')).toBe(1)
    expect(lessonDisplayLabel('49')).toBe('第 1 讲')
  })

  it('gradesInOrder 返回升序去重的年级', () => {
    expect(gradesInOrder()).toEqual([1, 2])
  })

  it('lessonsForGrade(1) 返回一年级全部 20 讲', () => {
    expect(lessonsForGrade(1)).toHaveLength(20)
    expect(lessonsForGrade(1)).toContain('35')
    expect(lessonsForGrade(1)).not.toContain('49')
  })

  it('gradeOf 取讲次年级，未登记返回 undefined', () => {
    expect(gradeOf('35')).toBe(1)
    expect(gradeOf('999')).toBeUndefined()
  })

  it('lessonIdFromHref 从路由取讲次 id', () => {
    expect(lessonIdFromHref('/math/ny/35')).toBe('35')
    expect(lessonIdFromHref('/math/ny/g1')).toBeUndefined()
    expect(lessonIdFromHref('/foo')).toBeUndefined()
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
