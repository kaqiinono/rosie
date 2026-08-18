import type { GrammarIndexEntry } from './types'

/**
 * 116 单元静态元数据索引（编号/标题/分类/书页码）。
 *
 * Phase 1 为空数组：首页降级为仅展示 DB 中已入库的单元（无锁定地图）。
 * Phase 2 由 `pnpm grammar:extract --toc` 从原书目录页一次性提取生成，
 * 人工校对后提交；此后首页呈现全书地图，未入库单元显示 🔒 锁定。
 */
export const GRAMMAR_INDEX: GrammarIndexEntry[] = []
