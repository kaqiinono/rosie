import { supabase } from '@rosie/core'
import { entryVariables, validateEntry, type PracticeEntry } from '@rosie/tasks'
import { loadCatalog, type Catalog } from './catalog'

/** 每日口算没有题目清单，作业直接打开今天的练习。 */
export const dailyCalcPath = '/calc/session?mode=daily&start=1'

type Preset = Pick<PracticeEntry, 'name' | 'subject' | 'path' | 'rows'>
function fromCatalog(name: string, catalog: Catalog): Preset {
  return { name, subject: catalog.subject, path: catalog.path, rows: catalog.groups.flatMap((g) => g.rows) }
}
export async function ensureEntryPresets(userId: string): Promise<void> {
  const { data, error } = await supabase.from('task_practice_entry_setup').select('user_id').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (data) return
  const presets: Preset[] = [
    { name: '每日口算', subject: 'math', path: dailyCalcPath, rows: [] },
    { name: '今日英语计划', subject: 'english', path: '/english/words/daily', rows: [] },
  ]
  for (const [section, label] of Object.entries({ lesson: '数学课堂讲解', homework: '数学课后巩固', pretest: '数学课前测', workbook: '数学练习册', supplement: '数学补充题' }))
    presets.push(fromCatalog(label, await loadCatalog('math', section)))
  presets.push(fromCatalog('语文生字练习', await loadCatalog('chineseChars', '')))
  presets.push(fromCatalog('语文课文阅读', await loadCatalog('chineseReading', '')))
  const english = await loadCatalog('englishCards', '')
  presets.push(fromCatalog('英语按课背词', english))
  presets.push(fromCatalog('英语按课练习', { ...english, path: english.path.replace('/cards?', '/practice?') }))
  for (const [kind, name] of [['chinesePoems', '语文古诗'], ['chineseAccumulation', '语文日积月累'], ['chineseRecognize', '语文会认字'], ['chineseWords', '语文词语'], ['englishSentences', '英语逐句听读']] as const)
    presets.push(fromCatalog(name, await loadCatalog(kind, '')))
  presets.push(fromCatalog('英语阅读', await loadCatalog('englishReading', '')))
  presets.push(fromCatalog('英语语法', await loadCatalog('englishGrammar', '')))
  const available = presets.filter((entry) => !entryVariables(entry.path).length || entry.rows.length)
  for (const entry of available) validateEntry(entry)
  const session = await supabase.auth.getSession()
  if (session.data.session?.user.id !== userId) throw new Error('登录账户已变化，请重新打开入口管理')
  const created = await supabase.rpc('initialize_task_practice_entries', { p_entries: available })
  if (created.error) throw created.error
}
