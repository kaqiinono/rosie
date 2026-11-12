import 'server-only'
import { createAdminSupabase } from './api-auth'

export async function lessonDirectory(lessonKey: string, accountId: string) {
  const db = createAdminSupabase()
  const lesson = await db
    .from('math_replay_lessons')
    .select('directory_id,main_path')
    .eq('lesson_key', lessonKey)
    .eq('account_id', accountId)
    .maybeSingle()
  if (lesson.error) throw Error('directory_unavailable')
  if (!lesson.data?.directory_id || typeof lesson.data.main_path !== 'string') return null
  const directory = await db
    .from('baidu_sync_directories')
    .select('path')
    .eq('id', lesson.data.directory_id)
    .eq('account_id', accountId)
    .maybeSingle()
  if (directory.error) throw Error('directory_unavailable')
  if (typeof directory.data?.path !== 'string') return null
  const root = directory.data.path
  const main = lesson.data.main_path
  if (main !== root && !(root === '/' ? main.startsWith('/') : main.startsWith(root + '/'))) return null
  return main
}
