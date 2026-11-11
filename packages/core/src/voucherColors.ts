/**
 * 奖券模板颜色。数据库的 `voucher_templates.gradient` 仍保存历史的 `from-X to-Y` 字符串（不改数据），
 * 展示时统一映射为纯色（视觉规范：不用渐变，见 docs/visual-guidelines.md）。
 * 类名必须以完整字面量出现在源码里，Tailwind 才会生成。白字叠加，所以取 600 左右的深色。
 */
const VOUCHER_SOLID_CLASS: Record<string, string> = {
  'from-indigo-500 to-purple-500': 'bg-indigo-600',
  'from-pink-500 to-rose-400': 'bg-pink-600',
  'from-yellow-400 to-orange-400': 'bg-amber-500',
  'from-green-500 to-teal-500': 'bg-green-600',
  'from-teal-500 to-emerald-500': 'bg-teal-600',
  'from-blue-500 to-cyan-400': 'bg-blue-600',
  'from-orange-500 to-rose-500': 'bg-orange-600',
  'from-pink-500 to-fuchsia-500': 'bg-fuchsia-600',
  'from-amber-500 to-violet-500': 'bg-violet-600',
  'from-violet-500 to-purple-400': 'bg-purple-600',
  'from-yellow-500 to-amber-400': 'bg-yellow-600',
  'from-slate-500 to-zinc-500': 'bg-slate-600',
}

export function voucherSolidClass(gradient: string): string {
  return VOUCHER_SOLID_CLASS[gradient] ?? 'bg-slate-600'
}
