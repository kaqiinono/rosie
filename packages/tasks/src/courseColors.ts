import type { TaskCourse } from './types'

export function colorAppearance(value: string) {
  const channels = [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16) / 255)
  const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  return { value, background: value, border: value, text: luminance > 0.179 ? '#000000' : '#ffffff' }
}

export const COURSE_COLORS = [
  ['#e5e7eb', '银灰'], ['#ef6548', '珊瑚'], ['#efa481', '蜜桃'],
  ['#ffad24', '橙黄'], ['#91c52b', '草绿'], ['#bedb78', '嫩绿'],
  ['#7ecdeb', '天蓝'], ['#8eafd4', '雾蓝'], ['#9181b7', '浅紫'],
  ['#bd8fb9', '丁香'], ['#ed9dc0', '粉红'], ['#f13e23', '朱红'],
  ['#59b83b', '鲜绿'], ['#059669', '松绿'], ['#2563eb', '湖蓝'],
  ['#7c3aed', '藤紫'], ['#e11d48', '莓红'], ['#d97706', '麦黄'], ['#0891b2', '青蓝'],
].map(([value, label]) => ({ ...colorAppearance(value), label }))

export function courseColor(course?: Pick<TaskCourse, 'id' | 'color'>) {
  const selected = COURSE_COLORS.find(color => color.value === course?.color?.toLowerCase())
  if (selected) return selected
  if (course?.color && /^#[0-9a-fA-F]{6}$/.test(course.color)) return { ...colorAppearance(course.color), label: '自定义' }
  return COURSE_COLORS[(course?.id ?? '').split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % COURSE_COLORS.length]
}

export function coursePastelColor(course?: Pick<TaskCourse, 'id' | 'color'>) {
  const color = courseColor(course)
  const background = '#' + [1, 3, 5].map(offset => {
    const channel = parseInt(color.value.slice(offset, offset + 2), 16)
    return Math.round(channel * 0.22 + 255 * 0.78).toString(16).padStart(2, '0')
  }).join('')
  return { ...color, background, text: '#1e293b' }
}
