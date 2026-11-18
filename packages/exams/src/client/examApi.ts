'use client'

import { BAIDU_AUTH_MESSAGES, supabase } from '@rosie/core'
import type { ValidationIssue } from '../validation/contracts'

const mediaErrorMessages: Record<string, string> = {
  exam_media_binding_changed: '考试资源绑定需要更新。请联系管理员检查考试资源。',
  exam_media_binding_missing: '试卷所需资源尚未绑定。请联系管理员检查考试资源。',
  exam_media_file_missing: '试卷所需的网盘文件无法读取。请联系管理员检查考试资源。',
  exam_invalid_media_binding: '考试资源的文件类型或绑定无效。请联系管理员检查考试资源。',
  exam_listening_program_missing: '听力时长或播放配置缺失或无效。请联系管理员检查考试资源。',
  exam_media_unavailable: '考试资源暂时无法读取，请稍后重试。',
  baidu_account_changed: '共享网盘账号已变化。请联系管理员检查考试资源绑定。',
}

export class ExamRequestError extends Error {
  constructor(readonly code: string, readonly status: number, readonly issues: readonly ValidationIssue[] = []) {
    super(code)
    this.name = 'ExamRequestError'
  }
}

/** Never keep tokens in module state, URLs or persisted drafts. */
export async function examRequest<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  if (!data.session || data.session.user.id !== userId) throw new ExamRequestError('unauthorized', 401)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  const abort = () => controller.abort()
  init.signal?.addEventListener('abort', abort, { once: true })
  try {
    if (init.signal?.aborted) controller.abort()
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${data.session.access_token}`)
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    const response = await fetch(path, { ...init, cache: 'no-store', redirect: 'error', signal: controller.signal, headers })
    const body: unknown = await response.json()
    const current = await supabase.auth.getSession()
    if (current.data.session?.user.id !== userId) throw new ExamRequestError('unauthorized', 401)
    if (!response.ok) {
      const value = body && typeof body === 'object' ? body as Record<string, unknown> : {}
      throw new ExamRequestError(typeof value.error === 'string' ? value.error : 'exam_unavailable', response.status,
        Array.isArray(value.issues) ? value.issues as ValidationIssue[] : [])
    }
    return body as T
  } catch (error) {
    if (error instanceof ExamRequestError) throw error
    throw new ExamRequestError('exam_network_error', 0)
  } finally {
    clearTimeout(timeout)
    init.signal?.removeEventListener('abort', abort)
  }
}

export function examErrorMessage(error: unknown): string {
  if (!(error instanceof ExamRequestError)) return '操作未完成，请重试。'
  if (Object.hasOwn(mediaErrorMessages, error.code)) {
    const detail = error.issues[0]?.message
    return typeof detail === 'string' && detail ? detail : mediaErrorMessages[error.code]
  }
  if (Object.hasOwn(BAIDU_AUTH_MESSAGES, error.code)) return BAIDU_AUTH_MESSAGES[error.code]
  if (error.code === 'exam_invalid_id') return '试卷或记录的标识格式不正确，请返回列表重新打开。'
  if (error.code === 'exam_revision_mismatch') return '提交内容与当前打开的试卷版本不一致，请保留修改并重新打开对应试卷。'
  if (error.code === 'exam_invalid_json') return '提交的内容不是有效的 JSON，请修正内容包格式后重试。'
  if (error.code === 'exam_invalid_pagination') return '列表分页参数不正确，请返回列表重新打开。'
  if (error.code === 'exam_invalid_request') return '请求参数不符合要求，本次操作未完成。'
  if (error.code === 'exam_invalid_draft') return error.issues.length
    ? '草稿内容未通过格式校验，请根据问题明细修正。'
    : '草稿内容未通过格式校验，服务端未返回具体问题明细。'
  if (error.code === 'exam_invalid_vocabulary_reference') return '内容包中的词条引用与当前词库不一致。'
  if (error.code === 'exam_network_error') return '请求未能完成或响应无法读取，请稍后重试。'
  if (error.code === 'auth_unavailable') return '暂时无法验证登录状态，请稍后重试。当前输入仍保留。'
  if (error.code === 'auth_timeout') return '服务端验证登录超时，请稍后重试。当前输入仍保留。'
  if (error.code === 'auth_network_error') return '服务端无法连接登录验证服务，请检查服务端网络或代理配置。当前输入仍保留。'
  if (error.code === 'auth_rate_limited') return '登录验证服务请求过于频繁，请稍后重试。当前输入仍保留。'
  if (error.code === 'auth_service_error') return '登录验证服务暂时异常，请稍后重试。当前输入仍保留。'
  if (error.code === 'auth_configuration_error') return '服务端登录验证配置缺失，请联系管理员检查配置。当前输入仍保留。'
  if (error.code === 'exam_expired') return '时间已到，已保存的答案已锁定。请重新读取查看结果。'
  if (error.code === 'exam_handwriting_unavailable') return '手写保存与批阅尚未就绪，请保留笔迹并稍后重新读取。'
  if (error.code === 'exam_invalid_answer') return '答案格式或笔迹长度超出限制，请简化过长笔迹后重新保存。'
  if (error.code === 'exam_invalid_grade') return '此题当前不能按所选方式批阅，请重新读取已提交的答案。'
  if (error.code === 'invalid_parent_pin') return '家长 PIN 不正确，请重新输入。'
  if (error.code === 'exam_pin_rate_limited') return 'PIN 验证次数较多，请稍后重试。'
  if (error.code === 'exam_annotations_unavailable') return '阅读标记暂不能保存到云端，请重新读取后继续；当前输入仍保留。'
  if (error.code === 'exam_recording_incomplete') return '还有录音未保存。请先重试上传或明确放弃该段。'
  if (error.code === 'exam_playback_unavailable') return '所需媒体暂时不可用，请检查资源绑定后重试。'
  if (error.code === 'exam_publication_blocked') return '此版本仍有待完善项，尚不能发布。'
  if (error.status === 401) return '登录已过期，请重新登录。当前输入尚未保存。'
  if (error.status === 403) return '当前账号没有此操作权限，或家长验证未通过。'
  if (error.status === 404) return '此内容或学习记录不可访问，请返回列表重新打开。'
  if (error.status === 409) return '此版本已发生变化。请保留当前修改，重新读取后再编辑。'
  if (error.status === 413) return '本次内容过大，请减少单个草稿的内容后重试。'
  if (error.status === 422) return error.issues.length
    ? '内容或词条关联未通过校验，请根据问题明细修正。'
    : '内容或词条关联未通过校验，服务端未返回具体问题明细。'
  if (error.status === 400) return error.issues.length
    ? '请求未被接受，请根据问题明细修正。'
    : '请求未被接受，服务端未返回具体问题明细。'
  return '暂时无法保存或读取。当前输入仍保留，可重试原操作。'
}
