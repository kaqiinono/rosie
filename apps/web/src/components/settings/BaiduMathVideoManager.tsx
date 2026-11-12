'use client'

import { lessonReplayKey, summaryReplayOrder } from '@rosie/math-kit/utils/lesson-registry'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isAdminUser, useAuth, SOURCE_LABELS } from '@rosie/core'
import {
  Box,
  Button,
  Card,
  CheckboxGroup,
  Flex,
  Grid,
  Heading,
  Text,
  TextField,
} from '@rosie/ui/themes'
import { SyncPending, SyncSelect, useSyncConfirmation } from './SyncControls'
import { CourseMainDirectory, type SyncChosenDirectory } from './SyncDirectoryChooser'
import {
  LESSONS,
  lessonByKey,
  gradesInOrderFromRegistry,
} from '@rosie/math-kit/utils/lesson-registry'
import {
  invalidateProblemVideoCatalogs,
  replaceProblemVideoCatalog,
} from '@rosie/math-kit/hooks/useProblemVideoCatalog'
import {
  bindingValue,
  sameMathDirectory,
  VIDEO_SOURCES,
  type MathVideoEditor,
  type VideoSource,
} from '@/lib/baidu-math-video-report-types'
import { requestBaiduVideoData, type VideoRequest } from './baidu-video-client'
import { matchMathReplayFiles } from '@/lib/match-math-replay-files'
import MathVideoReport from './MathVideoReport'
import MathVideoPairingPanel from './MathVideoPairingPanel'
import type { SyncDirectoryList } from '@/app/api/baidu/sync/directories/route'

const grades = gradesInOrderFromRegistry().map((g) => ({ value: String(g), label: g + '年级' }))
const defaultLesson = [...LESSONS].sort((a, b) => b.grade - a.grade || b.seq - a.seq)[0]!.lessonKey
type Picks = Record<string, string>

function savedPicks(editor: MathVideoEditor): Picks {
  return sameMathDirectory(editor)
    ? Object.fromEntries(editor.bindings.map((b) => [b.problemId, bindingValue(b)]))
    : {}
}

function LessonEditor({ userId, paths }: { userId: string; paths: SyncDirectoryList }) {
  const [lessonKey, setLesson] = useState(defaultLesson)
  const [editor, setEditor] = useState<MathVideoEditor | null>(null)
  const [picks, setPicks] = useState<Picks>({})
  const [sources, setSources] = useState<VideoSource[]>(['lesson'])
  const [questionSearch, setQuestionSearch] = useState('')
  const [batchIssues, setBatchIssues] = useState<Record<string, string>>({})
  const [showIssues, setShowIssues] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const { confirm, dialog } = useSyncConfirmation()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  const grade = lessonByKey(lessonKey)?.grade
  const options = LESSONS.filter((l) => l.grade === grade).map((l) => ({
    value: l.lessonKey,
    label: '第 ' + l.seq + ' 讲',
  }))

  const run = useCallback(
    async (
      input: VideoRequest,
      apply: (value: MathVideoEditor, signal: AbortSignal) => void | Promise<void>,
    ) => {
      if (pending.current) return
      const controller = new AbortController()
      pending.current = controller
      setSaving(input.action === 'save')
      setSaveError('')
      setBusy(true)
      setError('')
      setMessage('')
      try {
        const next = await requestBaiduVideoData(userId, input, controller.signal)
        if (!controller.signal.aborted) await apply(next, controller.signal)
      } catch (cause) {
        if (!controller.signal.aborted && input.action === 'save')
          setSaveError(cause instanceof Error ? cause.message : '请重新读取后重试。')
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error && cause.name === 'Error'
              ? cause.message
              : '请求未完成，请重新读取后重试。',
          )
      } finally {
        if (pending.current === controller) {
          pending.current = null
          setBusy(false)
          setSaving(false)
        }
      }
    },
    [userId],
  )

  const accept = useCallback(
    (next: MathVideoEditor) => {
      setBatchIssues({})
      setEditor(next)
      setPicks(savedPicks(next))
      setChoosing(!next.selectedId)
      replaceProblemVideoCatalog(userId, {
        summaryNames: Object.fromEntries(
          next.bindings
            .filter((b) => b.available && summaryReplayOrder(next.lessonKey, b.problemId))
            .map((b) => [b.problemId, b.name]),
        ),
        lessonKey: next.lessonKey,
        keys: next.bindings.filter((b) => b.available).map((b) => b.problemId),
        syncedAt: next.savedAt,
      })
    },
    [userId],
  )

  useEffect(() => {
    void run({ action: 'read', lessonKey }, accept)
    return () => {
      pending.current?.abort()
      pending.current = null
    }
  }, [lessonKey, run, accept])

  const published = new Map(editor?.bindings.map((b) => [b.problemId, b]))
  const query = questionSearch.trim().toLowerCase()
  const visibleProblems =
    editor?.problems.filter(
      (p) =>
        sources.includes(p.source) &&
        [p.id, p.label, p.title].some((value) => value.toLowerCase().includes(query)),
    ) ?? []
  const bankIds = new Set(editor?.problems.map((p) => p.id))
  const fullKey = lessonReplayKey(lessonKey)
  bankIds.add(fullKey)
  const retired =
    editor?.bindings.filter(
      (b) =>
        !bankIds.has(b.problemId) &&
        !summaryReplayOrder(lessonKey, b.problemId) &&
        picks[b.problemId],
    ) ?? []
  const changingDirectory = Boolean(editor && !sameMathDirectory(editor))
  const dirty = Boolean(
    changingDirectory ||
      (editor &&
        (Object.keys(picks).length !== editor.bindings.length ||
          editor.bindings.some((b) => picks[b.problemId] !== bindingValue(b)))),
  )
  function afterDiscard(proceed: () => void) {
    if (dirty) confirm('放弃本讲尚未保存的修改？', proceed)
    else proceed()
  }
  function changeLesson(key: string) {
    if (busy || key === lessonKey) return
    afterDiscard(() => {
      setEditor(null)
      setPicks({})
      setQuestionSearch('')
      setChoosing(false)
      setLesson(key)
    })
  }
  function clearDirectory() {
    if (!editor) return
    setBatchIssues({})
    setEditor({
      ...editor,
      selectedId: null,
      selectedPath: null,
      syncedAt: null,
      version: null,
      files: {},
      occupied: {},
    })
    setPicks({})
    setChoosing(true)
    setError('')
    setMessage('')
  }
  function chooseDirectory(main: SyncChosenDirectory) {
    afterDiscard(() => {
      void run(
        { action: 'read', lessonKey, directoryId: main.directory_id, path: main.path },
        async (snapshot, signal) => {
          if (snapshot.generation !== paths.generation)
            throw Error('共享网盘账号已变更，请刷新授权路径列表。')
          accept(snapshot)
          const next = await requestBaiduVideoData(
            userId,
            {
              action: 'sync',
              lessonKey,
              directoryId: main.directory_id,
              path: main.path,
              generation: snapshot.generation,
              version: snapshot.version,
            },
            signal,
          )
          if (signal.aborted) return
          invalidateProblemVideoCatalogs(userId)
          accept(next)
          setChoosing(false)
          setMessage('已读取 ' + Object.keys(next.files).length + ' 个视频。')
        },
      )
    })
  }
  function reread() {
    const directoryId = editor?.selectedId ?? undefined
    const path = editor?.selectedPath ?? undefined
    void run({ action: 'read', lessonKey, directoryId, path }, (next) => {
      if (!editor || !dirty) {
        accept(next)
        return
      }
      if (next.generation !== editor.generation) {
        setError('共享网盘账号已变更。请放弃旧账号的草稿后重新读取。')
        return
      }
      const latest =
        !editor.selectedId || !editor.selectedPath
          ? { ...next, selectedId: null, selectedPath: null, version: null, syncedAt: null, files: {}, occupied: {} }
          : next
      const merged = savedPicks(latest)
      const base = savedPicks(editor)
      const overlaps: string[] = []
      for (const id of new Set([...Object.keys(base), ...Object.keys(picks)])) {
        if (base[id] === picks[id]) continue
        if (merged[id] !== base[id] && merged[id] !== picks[id]) overlaps.push(id)
        if (picks[id]) merged[id] = picks[id]!
        else delete merged[id]
      }
      accept(latest)
      setPicks(merged)
      setMessage(
        overlaps.length
          ? '已保留草稿。这些题目的已保存绑定也有改动，保存前请核对：' + overlaps.join('、')
          : '已读取最新清单并保留草稿，请核对后保存。',
      )
    })
  }
  function sync() {
    if (!editor?.selectedId || !editor.selectedPath) return
    void run(
      {
        action: 'sync',
        lessonKey,
        directoryId: editor.selectedId,
        path: editor.selectedPath,
        generation: editor.generation,
        version: editor.version,
      },
      (next) => {
        invalidateProblemVideoCatalogs(userId)
        if (next.revision !== editor.revision || next.generation !== editor.generation) {
          setError('本讲绑定或共享账号已变更，草稿已保留。请重新读取后核对。')
          return
        }
        const resolved = { ...picks }
        for (const b of next.bindings) {
          const old = published.get(b.problemId)
          if (old && old.fileId === null && resolved[b.problemId] === bindingValue(old))
            resolved[b.problemId] = bindingValue(b)
        }
        accept(next)
        setPicks(resolved)
        setChoosing(false)
        setMessage('已同步 ' + Object.keys(next.files).length + ' 个视频。')
      },
    )
  }
  function matchVisible() {
    if (!editor?.version || busy) return
    const { additions, issues } = matchMathReplayFiles(editor, visibleProblems, picks)
    setPicks({ ...picks, ...additions })
    setBatchIssues(issues)
    setMessage(
      '本次匹配 ' +
        Object.keys(additions).length +
        ' 道题，' +
        Object.keys(issues).length +
        ' 道需手动选择。',
    )
  }
  function choose(problemId: string, fileId: string | null) {
    setPicks((prev) => {
      const next = { ...prev }
      if (fileId) next[problemId] = fileId
      else delete next[problemId]
      return next
    })
    setMessage('')
  }
  function save() {
    if (!editor || !dirty) return
    if (changingDirectory && editor.bindings.length) {
      confirm('更换目录将解除原目录的 ' + editor.bindings.length + ' 条绑定。保存本讲修改？', () =>
        publish(editor),
      )
    } else publish(editor)
  }
  function publish(editor: MathVideoEditor) {
    void run(
      {
        action: 'save',
        lessonKey,
        directoryId: editor.selectedId,
        path: editor.selectedPath,
        generation: editor.generation,
        version: editor.version,
        revision: editor.revision,
        picks,
      },
      (next) => {
        accept(next)
        setChoosing(false)
        setMessage('本讲绑定已保存。')
      },
    )
  }

  const issues = visibleProblems.filter((p) => !picks[p.id] && batchIssues[p.id])
  const selectedMain =
    editor?.selectedId && editor.selectedPath
      ? { directory_id: editor.selectedId, path: editor.selectedPath }
      : null
  return (
    <Flex
      direction="column"
      gap="3"
      role="region"
      aria-label="数学视频回放"
      data-sync-dirty={dirty}
      data-sync-saving={saving}
    >
      <Heading as="h2" size="4">
        数学视频回放
      </Heading>
      <Text size="2" color="gray">
        先选已收藏的授权路径，再进入本讲子目录并确认为主目录，然后批量匹配或逐题绑定 MP4。
      </Text>
      <Grid columns={{ initial: '1', sm: '2' }} gap="3">
        <SyncSelect
          value={String(grade)}
          options={grades}
          disabled={busy}
          label="年级"
          onValueChange={(v) => {
            const first = LESSONS.find((l) => String(l.grade) === v)
            if (first) changeLesson(first.lessonKey)
          }}
        />
        <SyncSelect
          value={lessonKey}
          options={options}
          disabled={busy}
          label="讲次"
          onValueChange={changeLesson}
        />
      </Grid>
      {editor && (
        <CourseMainDirectory
          userId={userId}
          paths={paths}
          main={selectedMain}
          disabled={busy}
          choosing={choosing}
          onChoosingChange={setChoosing}
          onClear={() => afterDiscard(clearDirectory)}
          onChoose={chooseDirectory}
        />
      )}
      <Flex gap="2" wrap="wrap">
        <Button variant="soft" disabled={busy || !editor?.selectedId} onClick={sync}>
          刷新文件列表
        </Button>
        <Button variant="soft" disabled={busy} onClick={reread}>
          重新读取
        </Button>
        {dirty && (
          <Button
            variant="soft"
            color="gray"
            disabled={busy}
            onClick={() => afterDiscard(() => void run({ action: 'read', lessonKey }, accept))}
          >
            放弃草稿
          </Button>
        )}
      </Flex>
      {(busy || (!editor && !error)) && <SyncPending>正在处理…</SyncPending>}
      {error && (
        <Text role="alert" size="2" color="red">
          {error}
        </Text>
      )}
      {message && (
        <Text role="status" size="2" color="green">
          {message}
        </Text>
      )}
      {editor && (
        <>
          <Text size="2" color="gray">
            {!paths.directories.length
              ? '请先在「路径」标签添加授权目录。'
              : editor.syncedAt
                ? '最近同步：' +
                  new Date(editor.syncedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) +
                  ' · ' +
                  Object.keys(editor.files).length +
                  ' 个视频'
                : editor.selectedId
                  ? '尚未取得文件列表，请点击「刷新文件列表」重试。'
                  : '请选择授权路径下的本讲主目录。'}
          </Text>
          <Box>
            <Text as="p" id="sync-sources" weight="medium" size="2" mb="2">
              题目来源（可多选）
            </Text>
            <CheckboxGroup.Root
              value={sources}
              aria-labelledby="sync-sources"
              onValueChange={(values) =>
                setSources(VIDEO_SOURCES.filter((source) => values.includes(source)))
              }
            >
              <Flex gap="3" wrap="wrap">
                {VIDEO_SOURCES.map((source) => (
                  <CheckboxGroup.Item key={source} value={source}>
                    {SOURCE_LABELS[source]}
                  </CheckboxGroup.Item>
                ))}
              </Flex>
            </CheckboxGroup.Root>
          </Box>
          <TextField.Root
            aria-label="搜索题号或题目"
            placeholder="搜索题号或题目"
            value={questionSearch}
            onChange={(e) => setQuestionSearch(e.target.value)}
          />
          <Flex align="center" wrap="wrap" gap="2">
            <Button
              variant="soft"
              disabled={busy || !editor.version || !visibleProblems.some((p) => !picks[p.id])}
              onClick={matchVisible}
            >
              批量匹配
            </Button>
            <Text size="2" color="gray">
              仅匹配当前筛选中的未绑定题目
            </Text>
          </Flex>
          {issues.length > 0 && (
            <Box>
              <Button
                variant="soft"
                aria-expanded={showIssues}
                onClick={() => setShowIssues(!showIssues)}
              >
                查看需要手动选择的题目
              </Button>
              {showIssues &&
                issues.map((p) => (
                  <Text key={p.id} as="p" size="2">
                    {p.label} · {p.title} — {batchIssues[p.id]}
                  </Text>
                ))}
            </Box>
          )}
          <MathVideoPairingPanel
            key={lessonKey + ':' + editor.selectedId + ':' + editor.selectedPath}
            editor={editor}
            problems={visibleProblems}
            picks={picks}
            busy={busy}
            choose={choose}
          />
          {retired.map((b) => (
            <Flex key={b.problemId} wrap="wrap" align="center" gap="2">
              <Text size="2">
                原题 {b.problemId} 已移出题库 · {b.name}
              </Text>
              <Button
                variant="soft"
                color="red"
                disabled={busy}
                onClick={() => choose(b.problemId, null)}
              >
                解绑
              </Button>
            </Flex>
          ))}
          <Card>
            <Flex direction="column" align="start" gap="2">
              <Text role="status" size="2" weight="medium">
                {saving
                  ? '正在提交本讲绑定…'
                  : dirty
                    ? '当前修改尚未保存'
                    : editor.savedAt
                      ? '本讲绑定已保存'
                      : '本讲尚未保存绑定'}
              </Text>
              {dirty && changingDirectory && (
                <Text size="2">更换目录将解除原目录的 {editor.bindings.length} 条绑定。</Text>
              )}
              {saveError && (
                <Text role="alert" size="2" color="red">
                  保存未确认：{saveError}
                </Text>
              )}
              {editor.savedAt && (
                <Text size="2" color="gray" className="break-all">
                  最近保存：
                  {new Date(editor.savedAt).toLocaleString('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                  })}{' '}
                  · 目录：
                  {editor.mainPath ?? '未绑定'} · 题目绑定{' '}
                  {
                    editor.bindings.filter(
                      (b) => b.problemId !== fullKey && !summaryReplayOrder(lessonKey, b.problemId),
                    ).length
                  }{' '}
                  个 · 总结视频{' '}
                  {editor.bindings.filter((b) => summaryReplayOrder(lessonKey, b.problemId)).length}{' '}
                  个 · 整讲回放：{published.get(fullKey)?.name ?? '未绑定'}
                </Text>
              )}
              <Button
                onClick={save}
                disabled={busy || !dirty || Boolean(editor.selectedId && !editor.version)}
                loading={saving}
              >
                保存本讲绑定
              </Button>
            </Flex>
          </Card>
          <MathVideoReport editor={editor} />
        </>
      )}
      {dialog}
    </Flex>
  )
}

export default function BaiduMathVideoManager({ paths }: { paths: SyncDirectoryList }) {
  const { user } = useAuth()
  return user && isAdminUser(user) ? (
    <LessonEditor key={user.id} userId={user.id} paths={paths} />
  ) : null
}
