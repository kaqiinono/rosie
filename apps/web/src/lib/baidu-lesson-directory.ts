import 'server-only'
import { createAdminSupabase } from './api-auth'

export async function lessonDirectory(lessonKey: string, accountId: string) {
  const db = createAdminSupabase()
  const lesson = await db.from('math_replay_lessons').select('directory_id')
    .eq('lesson_key', lessonKey).eq('account_id', accountId).maybeSingle()
  if (lesson.error) throw Error('directory_unavailable')
  if (!lesson.data?.directory_id) return null
  const directory = await db.from('baidu_sync_directories').select('path')
    .eq('id', lesson.data.directory_id).eq('account_id', accountId).maybeSingle()
  if (directory.error) throw Error('directory_unavailable')
  return typeof directory.data?.path === 'string' ? directory.data.path : null
}
