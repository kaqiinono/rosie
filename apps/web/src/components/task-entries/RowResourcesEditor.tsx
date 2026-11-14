'use client'

import { useState } from 'react'
import { Button, Flex, Select, Text, TextArea, TextField } from '@rosie/ui/themes'
import type { PracticeEntryRow, PracticeResource } from '@rosie/tasks'
import { attachResources } from './resources'

type Props = { row: PracticeEntryRow; onChange: (patch: Partial<PracticeEntryRow>) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void }
export default function RowResourcesEditor({ row, onChange, disabled = false, onBusyChange }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const resources = row.resources ?? []
  function edit(id: string, patch: Partial<PracticeResource>) {
    onChange({ resources: resources.map((resource) => resource.id === id ? { ...resource, ...patch, source: 'manual' } : resource) })
  }
  async function refresh() {
    setLoading(true); onBusyChange?.(true); setError('')
    try {
      const [updated] = await attachResources([row], true)
      onChange({ content: updated.content, resources: updated.resources, resourceStatus: updated.resourceStatus, resourceError: updated.resourceError })
    } catch (cause) { setError(cause instanceof Error ? cause.message : '读取失败，请重试') }
    finally { setLoading(false); onBusyChange?.(false) }
  }
  return <Flex direction="column" gap="2">
    <Flex justify="between" align="center" gap="3" wrap="wrap">
      <Text size="2" weight="bold">资源链接</Text>
      <Flex gap="2" wrap="wrap" justify="end" ml="auto">
      <Button size="1" variant="soft" disabled={disabled || loading} onClick={() => onChange({ resources: [...resources, { id: crypto.randomUUID(), label: '', type: 'audio', source: 'manual', url: '' }] })}>添加资源</Button>
      <Button size="1" variant="soft" disabled={disabled} loading={loading} onClick={() => void refresh()}>刷新关联资源</Button>
    </Flex>
    </Flex>
    {row.resourceStatus === 'error' && <Text size="2" color="red" role="alert">{row.resourceError || '资源读取失败，可重试；已保存的资源保留。'}</Text>}
    {error && <Text size="2" color="red" role="alert">{error}</Text>}
    {!resources.length && <Text size="2" color="gray">{row.resourceStatus === 'ready' ? '未发现已绑定音视频，可手动添加。' : '尚未读取关联资源。'}</Text>}
    {resources.map((resource, index) => <Flex direction="column" gap="2" key={resource.id}>
      <Flex gap="2" align="center"><Text aria-hidden>{resource.type === 'video' ? '🎬' : resource.type === 'audio' ? '🔊' : '🔗'}</Text>
        <TextField.Root disabled={disabled || loading} aria-label={`资源${index + 1}名称`} placeholder="资源名称" value={resource.label} onChange={(e) => edit(resource.id, { label: e.target.value })} />
        <Select.Root disabled={disabled || loading} value={resource.type} onValueChange={(type) => edit(resource.id, { type: type as PracticeResource['type'] })}>
          <Select.Trigger aria-label={`资源${index + 1}类型`} /><Select.Content><Select.Item value="audio">音频</Select.Item><Select.Item value="video">视频</Select.Item><Select.Item value="link">PDF / 页面链接</Select.Item></Select.Content>
        </Select.Root>
      </Flex>
      <TextField.Root disabled={disabled || loading} aria-label={`资源${index + 1}链接`} value={resource.url} placeholder="本站资源地址或 HTTPS 音视频、PDF 地址" onChange={(e) => edit(resource.id, { url: e.target.value })} />
      {resource.type !== 'link' && <Flex gap="2">
        <TextField.Root disabled={disabled || loading} aria-label="片段开始秒数" type="number" min="0" step="0.1" placeholder="开始秒数（可选）" value={resource.startSeconds ?? ''} onChange={(e) => edit(resource.id, { startSeconds: e.target.value === '' ? undefined : Number(e.target.value) })} />
        <TextField.Root disabled={disabled || loading} aria-label="片段结束秒数" type="number" min="0" step="0.1" placeholder="结束秒数（可选）" value={resource.endSeconds ?? ''} onChange={(e) => edit(resource.id, { endSeconds: e.target.value === '' ? undefined : Number(e.target.value) })} />
      </Flex>}
      <Flex gap="2">
        <Button size="1" variant="soft" disabled={disabled || loading || index === 0} onClick={() => {
          const next = [...resources]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange({ resources: next })
        }}>上移</Button>
        <Button size="1" variant="soft" color="red" disabled={disabled || loading} onClick={() => onChange({
          resources: resources.filter((item) => item.id !== resource.id),
          hiddenResourceIds: [...new Set([...(row.hiddenResourceIds ?? []), resource.id])],
        })}>删除资源</Button>
      </Flex>
    </Flex>)}
    <Text size="1" color="gray">手动链接使用可播放直链，不填网盘分享页。刷新保留手动资源，已删除的自动资源不会重新加入。</Text>
    <Flex justify="between" align="center" gap="3" wrap="wrap">
      <Text size="2" weight="bold">泡泡展示内容</Text>
      <Flex ml="auto"><Button size="1" variant="soft" disabled={disabled || loading} onClick={() => onChange({ content: [...(row.content ?? []), { title: '', text: '' }] })}>添加文字内容</Button></Flex>
    </Flex>
    {(row.content ?? []).map((block, index) => <Flex direction="column" gap="2" key={index}>
      <Flex align="center" gap="2">
        <Flex flexGrow="1" minWidth="0"><TextField.Root disabled={disabled || loading} aria-label="内容标题" value={block.title} onChange={(e) => onChange({ content: row.content!.map((item, i) => i === index ? { ...item, title: e.target.value } : item) })} /></Flex>
        <Flex flexShrink="0"><Button size="1" variant="soft" disabled={disabled || loading} onClick={() => onChange({ content: row.content!.filter((_, i) => i !== index) })}>移除这段内容</Button></Flex>
      </Flex>
      <TextArea disabled={disabled || loading} aria-label={block.title || '正文'} value={block.text} rows={3} onChange={(e) => onChange({ content: row.content!.map((item, i) => i === index ? { ...item, text: e.target.value } : item) })} />
      <TextArea disabled={disabled || loading} aria-label="译文或说明" placeholder="译文或说明（可选）" value={block.translation ?? ''} rows={2} onChange={(e) => onChange({ content: row.content!.map((item, i) => i === index ? { ...item, translation: e.target.value } : item) })} />
    </Flex>)}
  </Flex>
}
