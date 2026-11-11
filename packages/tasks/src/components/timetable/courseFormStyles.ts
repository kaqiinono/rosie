// Shared by the course editor and its pickers; focus never changes control geometry.
// 颜色全部取 Radix 主题令牌（--accent-* / --focus-*），随根主题切换，不再写死绿色。
export const courseFocusClass =
  'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-8)]'

export const courseFieldFocusClass =
  'focus-within:bg-[var(--accent-2)] focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--focus-8)]'
