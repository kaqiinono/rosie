import { supabase } from '@rosie/core'
import { entryVariables, validateEntry, type PracticeEntry } from '@rosie/tasks'
import { buildCatalog, generateCatalogRows, type Catalog } from './catalog'

/** 每日口算没有题目清单，作业直接打开今天的练习。 */
export const dailyCalcPath = '/calc/session?mode=daily&start=1'

type Preset = Pick<PracticeEntry, 'name' | 'subject' | 'path' | 'rows'>
export type PresetApplyMode = 'created' | 'updated' | 'current'
export type PresetApplyResult = { mode: PresetApplyMode; updated: number; inserted: number }

async function fromCatalog(name: string, catalog: Catalog): Promise<Preset> {
  const rows = await generateCatalogRows(catalog)
  // A partial catalog must not replace saved media when updating same-name presets.
  const failed = rows.find((row) => row.resourceStatus === 'error')
  if (failed) throw new Error(`${name}的关联资源读取不完整：${failed.resourceError || '请稍后重试'}。本次未更新任何预设。`)
  return { name, subject: catalog.subject, path: catalog.path, rows }
}

async function currentPresets(): Promise<Preset[]> {
  const presets: Preset[] = [
    { name: '每日口算', subject: 'math', path: dailyCalcPath, rows: [] },
    { name: '今日英语计划', subject: 'english', path: '/english/words/daily', rows: [] },
  ]
  for (const [section, label] of Object.entries({ lesson: '数学课堂讲解', homework: '数学课后巩固', pretest: '数学课前测', workbook: '数学练习册', supplement: '数学补充题' }))
    presets.push(await fromCatalog(label, await buildCatalog('math', section)))
  presets.push(await fromCatalog('语文生字练习', await buildCatalog('chineseChars', '')))
  presets.push(await fromCatalog('语文课文阅读', await buildCatalog('chineseReading', '')))
  const english = await buildCatalog('englishCards', '')
  presets.push(await fromCatalog('英语按课背词', english))
  presets.push(await fromCatalog('英语按课练习', { ...english, path: english.path.replace('/cards?', '/practice?') }))
  for (const [kind, name] of [['chinesePoems', '语文古诗'], ['chineseAccumulation', '语文日积月累'], ['chineseRecognize', '语文会认字'], ['chineseWords', '语文词语']] as const)
    presets.push(await fromCatalog(name, await buildCatalog(kind, '')))
  // Use the full catalog, independent of the owner's saved course/start selection.
  // Listening and recitation share sentence text, translations and discovered audio.
  const sentences = await fromCatalog('英语逐句听读', await buildCatalog('englishSentences', ''))
  presets.push(sentences)
  presets.push({
    ...sentences,
    name: '英语逐句背诵',
    rows: sentences.rows.map((row) => ({ ...row, values: { ...row.values, requiresRecite: 'true' } })),
  })
  presets.push(await fromCatalog('英语阅读', await buildCatalog('englishReading', '')))
  presets.push(await fromCatalog('英语语法', await buildCatalog('englishGrammar', '')))
  return presets.filter((entry) => !entryVariables(entry.path).length || entry.rows.length)
}

function readCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readApplyResult(value: unknown): PresetApplyResult {
  if (!value || typeof value !== 'object') throw new Error('预设结果无效')
  const row = value as Record<string, unknown>
  if (row.mode !== 'created' && row.mode !== 'updated' && row.mode !== 'current') throw new Error('预设结果无效')
  return { mode: row.mode, updated: readCount(row.updated), inserted: readCount(row.inserted) }
}

function presetFailure(error: unknown): Error {
  const message = error instanceof Error ? error.message : '预设内容失败'
  if (message.includes('login_required')) return new Error('请先登录')
  if (message.includes('invalid_entries')) return new Error('预设内容无效，没有写入')
  if (message.includes('apply_task_practice_presets')) return new Error('预设功能尚未就绪，请稍后再试')
  return error instanceof Error ? error : new Error(message)
}

/** 只在用户点击时调用。数据库凭据决定本次是新增还是更新，页面加载不读取它。 */
export async function applyEntryPresets(userId: string): Promise<PresetApplyResult> {
  const available = await currentPresets()
  if (!available.length) throw new Error('当前没有可预设的内容')
  for (const entry of available) validateEntry(entry)
  const session = await supabase.auth.getSession()
  if (session.data.session?.user.id !== userId) throw new Error('登录账户已变化，请重新打开入口管理')
  const applied = await supabase.rpc('apply_task_practice_presets', { p_entries: available })
  if (applied.error) throw presetFailure(applied.error)
  return readApplyResult(applied.data)
}

export function presetApplyMessage(result: PresetApplyResult): string {
  if (result.mode === 'created') return '已新增预设内容。再次点击会按当前预设更新。'
  if (result.mode === 'current' || (result.updated === 0 && result.inserted === 0)) return '预设内容已是最新。'
  const parts: string[] = []
  if (result.updated > 0) parts.push(`更新了 ${result.updated} 条同科目同名预设`)
  if (result.inserted > 0) parts.push(`补上了 ${result.inserted} 个还没有的预设`)
  return `已更新预设内容，${parts.join('，')}。其他名称的内容不会改动，已绑定的作业也不会自动改变。`
}
