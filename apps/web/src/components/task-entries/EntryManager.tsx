'use client'

import { useEffect, useId, useState } from 'react'
import { isAdaptivePlanPath } from './englishPlans'
import { dailyCalcPath, ensureEntryPresets } from './presets'
import { AppDialog, LoadingOverlay, PageBreadcrumb, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Grid, Heading, Select, Text, TextField } from '@rosie/ui/themes'
import { entryVariables, usePracticeEntries, type PracticeEntry } from '@rosie/tasks'
import { refreshSavedRows } from './refreshList'
import { attachResources } from './resources'
import ScopeContentBuilder from './ScopeContentBuilder'
import EntryRowPreview from './EntryRowPreview'
import LessonResourceTags, { lessonResources } from './LessonResourceTags'

const subjects = { math: '数学', chinese: '语文', english: '英语', life: '生活 / 其他' }
function isDailyCalcPath(path: string) {
  return path === '/calc' || path.startsWith('/calc/session?mode=daily')
}
type Draft = Pick<PracticeEntry, 'name' | 'subject' | 'path' | 'rows'>
const empty: Draft = { name: '', subject: 'math', path: '', rows: [] }

export default function EntryManager({ initialSubject = 'math' }: { initialSubject?: Draft['subject'] }) {
  const nameFieldId = useId()
  const subjectFieldId = useId()
  const [subject, setSubject] = useState<Draft['subject']>(initialSubject)
  const api = usePracticeEntries()
  const userId = api.user?.id
  const [initializing, setInitializing] = useState(true)
  const [setupError, setSetupError] = useState('')
  const [setupAttempt, retrySetup] = useState(0)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setInitializing(true); setSetupError('')
    void ensureEntryPresets(userId).then(async () => { if (!cancelled) await api.refresh() })
      .catch((error: unknown) => { if (!cancelled) setSetupError(error instanceof Error ? error.message : '预设内容初始化失败') })
      .finally(() => { if (!cancelled) setInitializing(false) })
    return () => { cancelled = true }
    // The owner and explicit retry control initialization; store refresh is owner-scoped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, setupAttempt])
  const [editing, setEditing] = useState<PracticeEntry | null | undefined>(undefined)
  const [draft, setDraft] = useState<Draft>(empty)
  const [busy, setBusy] = useState(false)
  const [refreshingResources, setRefreshingResources] = useState(false)
  const [message, setMessage] = useState('')
  const [deleting, setDeleting] = useState<PracticeEntry | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [footerHost, setFooterHost] = useState<HTMLDivElement | null>(null)
  const [showContentList, setShowContentList] = useState(false)
  const [entryPhase, setEntryPhase] = useState<'choose' | 'review' | 'decide' | 'added'>('choose')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [rowsExpanded, setRowsExpanded] = useState(true)
  const [editorVersion, setEditorVersion] = useState(0)
  const entries = api.data.filter((entry) => entry.subject === subject)
  const variables = entryVariables(draft.path)
  const dailyCalc = draft.subject === 'math' && draft.rows.length === 0 && isDailyCalcPath(draft.path)
  const adaptiveDirect = draft.subject === 'english' && draft.rows.length === 0 && isAdaptivePlanPath(draft.path)
  const patch = (next: Partial<Draft>) => setDraft((previous) => ({ ...previous, ...next }))
  function chooseDailyCalc() {
    setShowContentList(false); setEntryPhase('choose'); setPreviewId(null); setMessage('')
    patch({ name: draft.name.trim() ? draft.name : '每日口算', path: dailyCalcPath, rows: [] })
  }
  function open(entry: PracticeEntry | null) {
    const nextSubject = entry?.subject ?? subject
    const next = entry ? structuredClone(entry) : { ...empty, subject: nextSubject, rows: [] }
    if (next.subject === 'math' && next.rows.length === 0 && isDailyCalcPath(next.path)) next.path = dailyCalcPath
    setShowContentList(false); setEntryPhase('choose'); setEditing(entry); setDraft(next); setMessage(''); setPreviewId(null); setRowsExpanded(true); setEditorVersion(value => value + 1)
  }
  async function save() {
    setBusy(true); setMessage('')
    try { await api.save(draft, editing ?? undefined); setEditing(undefined) }
    catch (error) { setMessage(error instanceof Error ? error.message : '保存失败') }
    finally { setBusy(false) }
  }
  async function refreshList(entry: PracticeEntry) {
    if (refreshingId) return
    setRefreshingId(entry.id); setMessage('')
    try {
      const rows = await refreshSavedRows(entry)
      const added = rows.length - entry.rows.length
      const failed = rows.filter((row) => row.resourceStatus === 'error').length
      if (JSON.stringify(rows) === JSON.stringify(entry.rows)) {
        setMessage(`${entry.name}的清单已是最新。`)
        return
      }
      await api.save({ name: entry.name, subject: entry.subject, path: entry.path, rows }, entry)
      setMessage(failed
        ? `${entry.name}有 ${failed} 项资源读取失败，原资源已保留。${added > 0 ? `已补上 ${added} 项。` : ''}`
        : added > 0 ? `${entry.name}已补上 ${added} 项，清单已保存。` : `${entry.name}的清单已刷新。`)
    } catch (error) { setMessage(error instanceof Error ? error.message : '刷新清单失败') }
    finally { setRefreshingId(null) }
  }
  function moveRow(index: number, delta: number) {
    const rows = [...draft.rows]; const target = index + delta
    if (target < 0 || target >= rows.length) return
    ;[rows[index], rows[target]] = [rows[target], rows[index]]
    patch({ rows })
  }
  return <Flex direction="column" gap="4" p="4" maxWidth="1100px" mx="auto" minHeight="85dvh">
    <PageBreadcrumb variant="inline" />
    <Flex justify="between" align="center"><Heading>作业内容管理</Heading><Button onClick={() => open(null)}>新增内容</Button></Flex>
    <Text color="gray">维护作业内容及完整列表。作业只需选择内容与开始项，各自记录进度。</Text>
    <Select.Root value={subject} onValueChange={(value) => setSubject(value as Draft['subject'])}>
      <Select.Trigger aria-label="筛选内容科目" /><Select.Content>{Object.entries(subjects).map(([id, label]) => <Select.Item key={id} value={id}>{label}</Select.Item>)}</Select.Content>
    </Select.Root>
    {message && editing === undefined && <Text role="status">{message}</Text>}
    {setupError && <Flex direction="column" gap="2"><Text role="alert">预设内容创建失败：{setupError}</Text><Button variant="soft" onClick={() => retrySetup((value) => value + 1)}>重新创建预设内容</Button></Flex>}
    {initializing && <Text role="status">正在准备三科预设内容…</Text>}
    {api.isLoading || initializing ? <Flex flexGrow="1" position="relative"><LoadingOverlay visible placement="content" /></Flex> : api.error ?
      <Button loading={busy} onClick={async () => { setBusy(true); try { await api.refresh() } catch { setMessage('读取失败，请重试') } finally { setBusy(false) } }}>读取失败，重试</Button> : <>
      {!entries.length && <Text>本科目还没有作业内容。</Text>}
      {entries.map((entry) => <StickerCard key={entry.id} size="md">
        <Flex direction="column" gap="2">
          <Text weight="bold">{entry.name} · {subjects[entry.subject]}</Text>
          <Text size="2">{entry.path}</Text>
          <Text size="2" color="gray">{entryVariables(entry.path).length ? `${entry.rows.length} 项作业内容` : '固定链接，每次重复使用'}</Text>
          <Flex gap="2" wrap="wrap">
            <Button variant="soft" disabled={refreshingId === entry.id} onClick={() => open(entry)}>编辑</Button>
            {entry.rows.length > 0 && <Button variant="soft" loading={refreshingId === entry.id} disabled={refreshingId !== null && refreshingId !== entry.id} onClick={() => void refreshList(entry)}>刷新清单</Button>}
            <Button variant="soft" color="red" disabled={refreshingId === entry.id} onClick={() => setDeleting(entry)}>删除</Button>
          </Flex>
        </Flex>
      </StickerCard>)}
    </>}
    <AppDialog open={editing !== undefined} title={editing ? '编辑作业内容' : '新增作业内容'} size="form" mobileFullscreen contentLayout={entryPhase === 'choose' ? 'fill' : 'scroll'}
      footer={<Flex direction="column" gap="2">
        <Flex gap="2" align="stretch" wrap="wrap">
          <div ref={setFooterHost} className="flex min-w-[min(100%,12rem)] flex-1" />
          <div className="flex min-w-[9rem] flex-1 sm:flex-none">
            <Button size="3" className="w-full" variant="soft" loading={busy} disabled={loadingCatalog || refreshingResources || !draft.path || (!!variables.length && !draft.rows.length)} onClick={() => void save()}>保存清单{draft.rows.length ? ` · ${draft.rows.length}项` : ''}</Button>
          </div>
        </Flex>
        <Text size="1" color="gray">修改不会改变已绑定作业的内容或进度。需要更新时，在作业编辑中主动同步。</Text>
      </Flex>} closeDisabled={busy || loadingCatalog || refreshingResources} onOpenChange={(value) => { if (!value) setEditing(undefined) }}>
      {/* fieldset 不能当 flex 容器：浏览器会多包一层，高度传不进课程列表。 */}
      <fieldset disabled={busy || refreshingResources} className="contents">
      <Flex direction="column" gap="4" flexGrow="1" minHeight="0" className="min-h-0 overflow-hidden">
        <Grid columns={{ initial: '1', sm: '2' }} gap="3" align="start" flexShrink="0">
          <Flex direction="column" gap="1" minWidth="0">
            <Text as="label" htmlFor={nameFieldId} size="2">清单名称</Text>
            <TextField.Root id={nameFieldId} aria-describedby={`${nameFieldId}-hint`} placeholder="例如：二年级第13讲课堂讲解" maxLength={120} value={draft.name} onChange={e => patch({ name: e.target.value })} />
            <Text id={`${nameFieldId}-hint`} size="1" color="gray">加入课程后自动填写，可修改</Text>
          </Flex>
          <Flex direction="column" gap="1" minWidth="0">
            <Text as="label" htmlFor={subjectFieldId} size="2">科目</Text>
            <Select.Root value={draft.subject} onValueChange={(value) => {
              const nextSubject = value as Draft['subject']
              if (nextSubject === draft.subject) return
              setShowContentList(false); patch({ subject: nextSubject, path: '', rows: [] })
              setPreviewId(null); setMessage('')
            }}>
              <Select.Trigger id={subjectFieldId} className="w-full" aria-label="科目" />
              <Select.Content>{Object.entries(subjects).map(([id, name]) => <Select.Item value={id} key={id}>{name}</Select.Item>)}</Select.Content>
            </Select.Root>
          </Flex>
        </Grid>
        {draft.subject === 'math' && !draft.rows.length && !dailyCalc && <Flex><Button size="2" variant="soft" onClick={chooseDailyCalc}>使用每日口算</Button></Flex>}
        {dailyCalc ? <StickerCard as="section" tone="paper" size="md" elevation="flat" aria-label="每日口算">
          <Flex direction="column" gap="3">
            <Text size="5" weight="bold">每日口算</Text>
            <Text>固定链接，每次打开今天的口算。没有题目清单，保存后就能在作业里选用。</Text>
            <Flex><Button size="2" variant="soft" onClick={() => { setMessage(''); patch({ path: '', rows: [] }) }}>改回选择课程</Button></Flex>
          </Flex>
        </StickerCard> : adaptiveDirect ? <StickerCard as="section" tone="paper" size="md" elevation="flat" aria-label="自适应计划">
          <Flex direction="column" gap="3">
            <Text size="5" weight="bold">{draft.name.trim() || '自适应计划'}</Text>
            <Text>固定链接，每次打开直接进入这次自适应练习。没有题目清单，保存后就能在作业里选用。</Text>
            <Flex><Button size="2" variant="soft" onClick={() => { setMessage(''); setShowContentList(false); setEntryPhase('choose'); patch({ path: '', rows: [] }) }}>改回选择课程</Button></Flex>
          </Flex>
        </StickerCard> : draft.subject !== 'life' && <ScopeContentBuilder key={`${editorVersion}:${draft.subject}`} subject={draft.subject} path={draft.path} rows={draft.rows} name={draft.name} footerHost={footerHost} disabled={busy || refreshingResources} onChange={patch} onBusyChange={setLoadingCatalog} onListVisibleChange={setShowContentList} onPhaseChange={setEntryPhase} isNew={!editing} />}
        {draft.subject === 'life' && <Flex direction="column" gap="1">
          <Text size="2">内容链接</Text>
          <TextField.Root aria-label="本站路径" placeholder="本站详情路径" value={draft.path} onChange={e => patch({ path: e.target.value })} />
        </Flex>}
        {!draft.rows.length && draft.subject !== 'life' && !dailyCalc && !adaptiveDirect && <Text size="2" color="gray">选好课程并加入清单后，会自动生成详情链接、内容顺序及关联资源。</Text>}
        {(showContentList || draft.subject === 'life') && !!draft.rows.length && <details open><summary>已生成的内容与资源（{draft.rows.length}项）</summary>
        <Flex direction="column" gap="3" pt="3">
        <Flex justify="between" align="center" gap="3" wrap="wrap">
          <Heading size="3">有序内容清单（{draft.rows.length}项）</Heading>
          <Flex gap="2" wrap="wrap" justify="end" ml="auto" flexShrink="0">
            <Button size="1" variant="soft" disabled={busy || refreshingResources || draft.rows.length < 2} onClick={() => patch({ rows: [...draft.rows].reverse() })}>倒序</Button>
            <Button size="1" variant="soft" disabled={!draft.rows.length} aria-expanded={rowsExpanded} onClick={() => { if (rowsExpanded) setPreviewId(null); setRowsExpanded((value) => !value) }}>{rowsExpanded ? '全部收起' : '全部展开'}</Button>
            <Button size="1" variant="soft" loading={refreshingResources} disabled={busy || !draft.rows.length} onClick={async () => {
          setRefreshingResources(true); setMessage('')
          try { const rows = await attachResources(draft.rows, true); patch({ rows }); setMessage(rows.some((row) => row.resourceStatus === 'error') ? '部分资源读取失败，原资源已保留，可再次刷新资源。' : '关联资源已更新，请保存内容。') }
          catch (error) { setMessage(error instanceof Error ? error.message : '读取资源失败') }
          finally { setRefreshingResources(false) }
        }}>刷新资源</Button>
          </Flex>
        </Flex>
        {variables.length > 0 ? <>
          <Text size="2">共 {draft.rows.length} 项，以下顺序就是作业递进顺序。</Text>
          {draft.rows.map((row, index) => <StickerCard key={row.id} size="sm">
            <Flex direction="column" gap="2">
              <Flex justify="between" align="start" gap="3">
                <Text weight="bold">{index + 1}. {row.label}</Text>
                <Flex flexShrink="0" gap="2" wrap="wrap" justify="end">
                  <Button size="1" variant="soft" onClick={() => setPreviewId(previewId === row.id ? null : row.id)}>{previewId === row.id ? '收起预览' : '预览内容'}</Button>
                  <Button size="1" variant="soft" aria-label={`上移${row.label}`} disabled={index === 0} onClick={() => moveRow(index, -1)}>上移</Button>
                  <Button size="1" variant="soft" aria-label={`下移${row.label}`} disabled={index === draft.rows.length - 1} onClick={() => moveRow(index, 1)}>下移</Button>
                </Flex>
              </Flex>
              {rowsExpanded && <>
                <LessonResourceTags row={row} />
                {row.resourceStatus === 'error'
                  ? <Text size="2" color="red">{row.resourceError || '资源读取失败，可重试'}</Text>
                  : row.resources?.length
                    ? <Flex gap="2" wrap="wrap" aria-label="已关联资源">{row.resources.map((resource) => <Badge key={resource.id} variant="soft" radius="full" color={resource.type === 'video' ? 'amber' : resource.type === 'audio' ? 'blue' : 'gray'}>{resource.label}</Badge>)}</Flex>
                    : !lessonResources(row).length && <Text size="2" color="gray">{row.values.sentenceId ? '尚未绑定单句音频' : '暂无关联媒体'}</Text>}
              </>}
              {previewId === row.id && <EntryRowPreview row={row} />}
            </Flex>
          </StickerCard>)}
        </> : <Text size="2">固定链接，无需填写变量列表。</Text>}
        </Flex></details>}
        {message && <Text role="status">{message}</Text>}
      </Flex>
      </fieldset>
    </AppDialog>
    <AppDialog open={!!deleting} title="删除作业内容？" closeDisabled={busy} onOpenChange={(value) => { if (!value) setDeleting(null) }}>
      <Flex direction="column" gap="3"><Text>已绑定作业仍可使用保存的内容；新作业将无法选择此内容。</Text><Button color="red" loading={busy} onClick={async () => {
        if (!deleting) return
        setBusy(true)
        try { await api.remove(deleting); setDeleting(null) }
        catch (error) { setMessage(error instanceof Error ? error.message : '删除失败'); setDeleting(null) }
        finally { setBusy(false) }
      }}>确认删除</Button></Flex>
    </AppDialog>
  </Flex>
}
