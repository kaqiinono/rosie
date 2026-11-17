'use client'

import { useMemo, type ReactNode } from 'react'
import { useAuth } from '@rosie/core'
import { SEA_POOL } from '@rosie/math/utils/sea-data'
import { lessonModuleByKey } from '@rosie/math/utils/lesson-module-registry'
import { useProblemVideoCatalog } from '@rosie/math-kit/hooks/useProblemVideoCatalog'
import { ExternalProblemActions } from '@rosie/math-kit/components/shared/ProblemCardActions'
import { ProblemWorkspaceRuntimeProvider } from '@rosie/math-kit/components/shared/ProblemWorkspaceRuntime'
import type { PracticeEntryRow, PracticeResource } from '@rosie/tasks'
import { Button, Flex, Text } from '@rosie/ui/themes'
import PracticeResources from './PracticeResources'

const localRuntime = { preview: true, onCorrect: () => undefined, onWrong: () => undefined, onDontKnow: () => undefined, dontKnowUsed: false }

export default function MathPracticeContent({ row, actions, onCorrect, expanded = true }: { row: PracticeEntryRow; onCorrect?: (problemId: string) => Promise<void>; actions?: ReactNode; expanded?: boolean }) {
  const { user } = useAuth()
  const item = SEA_POOL.find(item => item.problem.id === row.values.problemId)
  const lessonKey = item?.lessonId ?? `${row.values.grade}-${row.values.seq}`
  const lesson = lessonModuleByKey(lessonKey)
  const catalog = useProblemVideoCatalog(user, lessonKey)
  const bound = catalog.hasVideo(row.values.problemId)
  const mediaRow = useMemo(() => {
    const resources: PracticeResource[] = (row.resources ?? []).filter(resource => !(resource.source === 'auto' && resource.type === 'video'))
    if (bound) resources.unshift({ id: `replay:${row.values.problemId}`, label: '课堂回放', type: 'video', source: 'auto', url: `/api/baidu/video/${encodeURIComponent(row.values.problemId)}` })
    return { ...row, content: [], resources, resourceStatus: 'ready' as const }
  }, [row, bound])
  const Provider = lesson?.Provider
  const Detail = lesson?.ProblemDetail
  return <Flex direction="column" gap="3">
    {item && Provider && Detail ? <ProblemWorkspaceRuntimeProvider value={onCorrect ? { ...localRuntime, onCorrect: () => onCorrect(row.values.problemId) } : localRuntime}>
      <ExternalProblemActions><Provider><Detail problem={item.problem} mode="inline" /></Provider></ExternalProblemActions>
    </ProblemWorkspaceRuntimeProvider> : <Text color="gray">未找到对应题目，请进入详情页查看。</Text>}
    {catalog.status === 'loading' && <Text role="status">正在读取课堂回放…</Text>}
    {catalog.status === 'error' && <Text role="alert" color="red">课堂回放读取失败，请重试。</Text>}
    {catalog.status === 'signed-out' && <Text color="red">请重新登录后读取课堂回放。</Text>}
    {catalog.status === 'unsynced' && <Text color="gray">本课尚未发布回放绑定。</Text>}
    {catalog.status === 'ready' && !bound && <Text color="gray">这道题暂无绑定的课堂回放。</Text>}
    {catalog.status === 'unknown' && <Text color="gray">无法识别本课的回放目录。</Text>}
    {expanded && <PracticeResources row={mediaRow} />}
    <Flex gap="2" wrap="wrap" align="center">
      <Button variant="soft" disabled={catalog.status === 'loading' || !user} onClick={() => void catalog.retry()}>重试读取回放</Button>
      {actions}
    </Flex>
  </Flex>
}
