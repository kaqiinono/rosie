// 课程安排的同级模块。前三项在 /tasks/timetable 内切换，作业是独立路由 /tasks/homework。
export type TimetableSection = 'schedule' | 'agenda' | 'courses'
export type TaskSection = TimetableSection | 'homework'
export const TASK_SECTIONS: readonly (readonly [TaskSection, string])[] = [
  ['schedule', '课程表'],
  ['agenda', '日程'],
  ['courses', '课程'],
  ['homework', '作业'],
]
export const HOMEWORK_PATH = '/tasks/homework'
export const TIMETABLE_PATH = '/tasks/timetable'

export function isTimetableSection(value: string | null): value is TimetableSection {
  return value === 'schedule' || value === 'agenda' || value === 'courses'
}
/** 切到某个模块时应前往的地址。 */
export function sectionHref(section: TaskSection): string {
  if (section === 'homework') return HOMEWORK_PATH
  return section === 'schedule' ? TIMETABLE_PATH : `${TIMETABLE_PATH}?section=${section}`
}
