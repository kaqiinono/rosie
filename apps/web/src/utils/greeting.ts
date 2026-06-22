export function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了，早点休息哦 🌙'
  if (h < 11) return '早上好，新的一天开始啦 ☀️'
  if (h < 14) return '中午好，吃饱了再学习 🍚'
  if (h < 18) return '下午好，继续加油 💪'
  return '晚上好，今天学到了什么呢 🌟'
}
