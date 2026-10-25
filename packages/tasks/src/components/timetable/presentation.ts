export { COURSE_COLORS, coursePastelColor as courseColor } from '../../courseColors'
export const clockTime = (value: string, hour12 = false) => new Date(value).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12 })
export const statusLabel = { scheduled: '待上课', confirmed: '✓ 已确认', cancelled: '已停课' }
