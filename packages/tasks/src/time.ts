export function localDate(value = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}
export function atTime(date: string, time: string): string {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}+08:00`).toISOString()
}
export function dateAfter(date: string, days: number): string {
  return localDate(new Date(new Date(atTime(date, '12:00')).getTime() + days * 86400000))
}
export function displayTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
