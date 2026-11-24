'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Heading, Text, TextField } from '@rosie/ui/themes'
import type { SyncDirectoryList } from '@/app/api/baidu/sync/directories/route'
import { requestTheater } from '@/lib/theater/client'
import {
  theaterLanguageLabel, theaterPlaybackCopyName, theaterVideoFormat, theaterVideoStem,
  type MatchedTheaterSubtitle, type TheaterAdminFilm, type TheaterDirectoryInventory, type TheaterSubtitleJob,
  type TheaterMediaDirectory, type TheaterMediaDirectorySettings, type TheaterSubtitleMatchResult,
} from '@/lib/theater/types'
import { SyncPending, SyncSelect, useSyncConfirmation } from './SyncControls'

type TheaterOperation = 'catalog' | 'directory' | 'files' | 'match' | 'transcribe' | 'save' | 'publish' | 'retry' | 'import' | 'copy'

const jobActive = (state: TheaterSubtitleJob['state']) =>
  state === 'queued' || state === 'transcribing' || state === 'writing'
const jobLabels = {
  queued: '找不到现有字幕，已排队生成原声字幕。',
  transcribing: '正在识别影片对白…',
  writing: '正在将字幕保存到网盘…',
  ready: '字幕已保存到影片目录。',
  failed: '字幕生成未完成。',
  submission_unknown: '暂时无法确认字幕任务。',
} satisfies Record<TheaterSubtitleJob['state'], string>

export default function BaiduTheaterManager({ userId, paths }: { userId: string; paths: SyncDirectoryList }) {
  const [films, setFilms] = useState<TheaterAdminFilm[] | null>(null)
  const [mediaDirectory, setMediaDirectory] = useState<TheaterMediaDirectory | null>()
  const [directoryChoice, setDirectoryChoice] = useState('')
  const [changingDirectory, setChangingDirectory] = useState(false)
  const [inventory, setInventory] = useState<TheaterDirectoryInventory | null>(null)
  const [title, setTitle] = useState('')
  const [videoId, setVideoId] = useState('')
  const [enId, setEnId] = useState('')
  const [zhId, setZhId] = useState('')
  const [shareLink, setShareLink] = useState('')
  const [shareCode, setShareCode] = useState('')
  const [shareFeedback, setShareFeedback] = useState<{ kind: 'error' | 'success'; message: string } | null>(null)
  const [matched, setMatched] = useState<TheaterSubtitleMatchResult | null>(null)
  const [job, setJob] = useState<TheaterSubtitleJob | null>(null)
  const [jobError, setJobError] = useState('')
  const appliedSubtitle = useRef<string | null>(null)
  const [busy, setBusy] = useState<TheaterOperation | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const pending = useRef<{ controller: AbortController; operation: TheaterOperation } | null>(null)
  const { confirm, dialog } = useSyncConfirmation()
  const generationQuery = '?generation=' + encodeURIComponent(paths.generation)
  const catalogUrl = '/api/baidu/sync/theater' + generationQuery
  const directoryUrl = '/api/baidu/sync/theater/directory' + generationQuery
  const directoryId = mediaDirectory?.directoryId ?? ''
  const choosingDirectory = mediaDirectory === null || changingDirectory
  const directoryOptions = paths.directories.filter(item => !item.managedBy)
    .map(item => ({ value: item.id, label: item.path }))
  const videos = inventory?.videos.filter(file => theaterVideoFormat(file.name)) ?? []
  const unsupportedVideos = inventory?.videos.filter(file => !theaterVideoFormat(file.name)) ?? []
  const selectedVideo = videos.find(file => file.fileId === videoId)
  const directorySubtitles = selectedVideo
    ? inventory?.subtitles.filter(file => file.folder === selectedVideo.folder) ?? [] : []
  const generatedSubtitle = job?.subtitle
  const subtitles = [...new Map([
    ...directorySubtitles, ...(matched?.tracks ?? []), ...(generatedSubtitle ? [generatedSubtitle] : []),
  ].map(file => [file.fileId, { value: file.fileId, label: file.name }])).values()]
  const needsSubtitle = !enId && !zhId && !shareLink.trim()
  const canGenerateSubtitles = needsSubtitle && matched && !matched.tracks.length && !matched.failedCount &&
    !matched.remainingCount && !job
  const showTranscription = (job && jobActive(job.state)) || (needsSubtitle && (canGenerateSubtitles || job || jobError))
  const dirty = Boolean(title || videoId || enId || zhId)

  const run = useCallback(async (operation: TheaterOperation, action: (signal: AbortSignal) => Promise<void>) => {
    const previous = pending.current
    if (previous && (operation !== 'import' || previous.operation !== 'match')) return
    previous?.controller.abort()
    const controller = new AbortController()
    pending.current = { controller, operation }
    setBusy(operation)
    setError('')
    setNotice('')
    try {
      await action(controller.signal)
    } catch (cause) {
      if (!controller.signal.aborted) {
        const message = cause instanceof Error ? cause.message : '操作失败，请重试。'
        if (operation === 'import') setShareFeedback({ kind: 'error', message })
        else setError(message)
      }
    } finally {
      if (pending.current?.controller === controller) {
        pending.current = null
        setBusy(null)
      }
    }
  }, [])

  const readFiles = useCallback((id: string, signal: AbortSignal) =>
    requestTheater<TheaterDirectoryInventory>(userId, catalogUrl + '&directoryId=' + encodeURIComponent(id), { signal }),
  [catalogUrl, userId])

  const initialize = useCallback(() => run('catalog', async signal => {
    const [catalog, settings] = await Promise.all([
      requestTheater<TheaterAdminFilm[]>(userId, catalogUrl, { signal }),
      requestTheater<TheaterMediaDirectorySettings>(userId, directoryUrl, { signal }),
    ])
    if (signal.aborted) return
    setFilms(catalog)
    setMediaDirectory(settings.directory)
    if (settings.directory) {
      setBusy('files')
      const result = await readFiles(settings.directory.directoryId, signal)
      if (!signal.aborted) setInventory(result)
    }
  }), [catalogUrl, directoryUrl, readFiles, run, userId])

  useEffect(() => {
    void initialize()
    return () => {
      pending.current?.controller.abort()
      pending.current = null
    }
  }, [initialize])

  function refresh() {
    if (mediaDirectory === undefined) { void initialize(); return }
    void run('catalog', async signal => {
      const result = await requestTheater<TheaterAdminFilm[]>(userId, catalogUrl, { signal })
      if (!signal.aborted) setFilms(result)
    })
  }

  const subtitleJobUrl = useCallback((id: string) => '/api/baidu/sync/theater/subtitles?' +
    new URLSearchParams({ id, generation: paths.generation }), [paths.generation])
  const jobId = job?.id
  const jobState = job?.state
  useEffect(() => {
    if (!jobId || !jobState || !jobActive(jobState)) return
    const id = jobId
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        const current = await requestTheater<TheaterSubtitleJob>(userId, subtitleJobUrl(id), {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]),
        })
        if (controller.signal.aborted) return
        setJob(current)
        setJobError('')
        if (!jobActive(current.state)) return
      } catch {
        if (controller.signal.aborted) return
        setJobError('暂时无法读取任务进度，稍后自动重试。')
      }
      timer = setTimeout(poll, 12_000)
    }
    timer = setTimeout(poll, 8_000)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [jobId, jobState, subtitleJobUrl, userId])

  useEffect(() => {
    if (!generatedSubtitle || appliedSubtitle.current === generatedSubtitle.fileId) return
    const { fileId, language } = generatedSubtitle
    appliedSubtitle.current = fileId
    if (language === 'en' && zhId !== fileId) setEnId(current => current || fileId)
    if (language === 'zh' && enId !== fileId) setZhId(current => current || fileId)
  }, [generatedSubtitle, enId, zhId])

  function resetSubtitleJob() {
    setJob(null)
    setJobError('')
    appliedSubtitle.current = null
  }

  function resetShareInput() {
    setShareLink('')
    setShareCode('')
    setShareFeedback(null)
  }

  function resetFilmDraft() {
    setTitle('')
    setVideoId('')
    setEnId('')
    setZhId('')
    resetShareInput()
    setMatched(null)
    resetSubtitleJob()
  }

  function retrySubtitleJob() {
    if (job?.state !== 'failed') return
    const id = job.id
    void run('retry', async signal => {
      const current = await requestTheater<TheaterSubtitleJob>(userId, subtitleJobUrl(id), { signal, method: 'PATCH' })
      if (!signal.aborted) {
        setJob(current)
        setJobError('')
      }
    })
  }

  function loadFiles(id: string) {
    if (!id) return
    void run('files', async signal => {
      const result = await readFiles(id, signal)
      if (signal.aborted) return
      setInventory(result)
      if (videoId && !result.videos.some(file => file.fileId === videoId)) resetFilmDraft()
    })
  }

  function bindDirectory() {
    if (!directoryChoice || directoryChoice === directoryId) return
    const action = () => void run('directory', async signal => {
      const saved = await requestTheater<TheaterMediaDirectory>(userId, directoryUrl, {
        method: 'PUT', signal, body: JSON.stringify({
          directoryId: directoryChoice, revision: mediaDirectory?.revision ?? null,
        }),
      })
      if (signal.aborted) return
      setMediaDirectory(saved)
      setChangingDirectory(false)
      setDirectoryChoice('')
      setInventory(null)
      resetFilmDraft()
      setNotice('已绑定媒体目录。')
      setBusy('files')
      const result = await readFiles(saved.directoryId, signal)
      if (!signal.aborted) setInventory(result)
    })
    if (dirty) confirm('更改媒体目录会清空当前未保存的影片信息。继续更改？', action)
    else action()
  }

  function matchSubtitles(id: string, bindings: { en: string; zh: string }, generate: boolean) {
    if (!directoryId || !id) return
    void run(generate ? 'transcribe' : 'match', async signal => {
      const result = await requestTheater<TheaterSubtitleMatchResult>(
        userId, '/api/baidu/sync/theater/subtitles', {
          method: 'POST', signal,
          body: JSON.stringify({
            generation: paths.generation, directoryId, videoId: id, generate,
          }),
        },
      )
      if (signal.aborted) return
      setMatched(result)
      if (result.job) setJob(result.job)
      setJobError(result.jobError ?? '')
      if (result.suggested.en && result.suggested.en !== bindings.zh)
        setEnId(current => current || result.suggested.en || '')
      if (result.suggested.zh && result.suggested.zh !== bindings.en)
        setZhId(current => current || result.suggested.zh || '')
    })
  }

  function pickVideo(id: string) {
    if (id === videoId) return
    const video = videos.find(file => file.fileId === id)
    const previousTitle = selectedVideo ? theaterVideoStem(selectedVideo.name).slice(0, 120) : ''
    if (!title.trim() || title === previousTitle) setTitle(video ? theaterVideoStem(video.name).slice(0, 120) : '')
    setVideoId(id)
    setEnId('')
    setZhId('')
    resetShareInput()
    setMatched(null)
    resetSubtitleJob()
    if (video) matchSubtitles(id, { en: '', zh: '' }, false)
  }

  function importShareSubtitles() {
    if (!selectedVideo) return
    const link = shareLink.trim()
    if (!link) {
      setShareFeedback({ kind: 'error', message: '请先粘贴这部影片的百度网盘分享链接。' })
      return
    }
    const { fileId, folder } = selectedVideo
    void run('import', async signal => {
      setShareFeedback(null)
      setJobError('')
      const request = new AbortController()
      const cancel = () => request.abort()
      signal.addEventListener('abort', cancel, { once: true })
      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        cancel()
      }, 55_000)
      let tracks: MatchedTheaterSubtitle[]
      try {
        tracks = await requestTheater<MatchedTheaterSubtitle[]>(userId, '/api/baidu/sync/theater/subtitles', {
          method: 'POST', signal: request.signal, body: JSON.stringify({
            action: 'importShare', generation: paths.generation, directoryId, videoId: fileId, link, code: shareCode,
          }),
        })
        if (signal.aborted) return
        if (timedOut) throw Error('获取网盘字幕超时，请重试。')
      } catch (error) {
        if (timedOut) throw Error('获取网盘字幕超时，请重试。')
        throw error
      } finally {
        clearTimeout(timeout)
        signal.removeEventListener('abort', cancel)
      }
      if (!Array.isArray(tracks) || !tracks.length) throw Error('未收到可绑定的字幕，请刷新页面后重试。')
      const en = tracks.find(track => track.language === 'en')?.fileId
      const zh = tracks.find(track => track.language === 'zh')?.fileId
      setInventory(current => current && { ...current, subtitles: [...new Map([
        ...current.subtitles, ...tracks.map(track => ({ fileId: track.fileId, name: track.name, folder })),
      ].map(file => [file.fileId, file])).values()] })
      setMatched(current => ({
        tracks: [...new Map([...(current?.tracks ?? []), ...tracks].map(track => [track.fileId, track])).values()],
        suggested: { ...current?.suggested, ...(en ? { en } : {}), ...(zh ? { zh } : {}) },
        failedCount: current?.failedCount ?? 0,
        remainingCount: current?.remainingCount ?? 0,
      }))
      if (en && en !== zhId) setEnId(current => current || en)
      if (zh && zh !== enId) setZhId(current => current || zh)
      resetShareInput()
      setShareFeedback({ kind: 'success', message: `已导入 ${tracks.length} 份网盘字幕，可保存草稿。` })
    })
  }

  function save(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || !directoryId || !videoId || !(enId || zhId) || enId === zhId) return
    void run('save', async signal => {
      await requestTheater(userId, catalogUrl, { method: 'POST', signal, body: JSON.stringify({
        title: title.trim(), directoryId, videoId, enId: enId || null, zhId: zhId || null,
      }) })
      if (signal.aborted) return
      setInventory(current => current && { ...current, videos: current.videos.filter(file => file.fileId !== videoId) })
      resetFilmDraft()
      setNotice('已保存草稿，核对后可上架。')
      const result = await requestTheater<TheaterAdminFilm[]>(userId, catalogUrl, { signal })
      if (!signal.aborted) setFilms(result)
    })
  }

  function toggleFilm(film: TheaterAdminFilm) {
    const action = () => void run('publish', async signal => {
      await requestTheater(userId, catalogUrl, { method: 'PUT', signal, body: JSON.stringify({
        id: film.id, revision: film.revision, published: !film.published,
      }) })
      const result = await requestTheater<TheaterAdminFilm[]>(userId, catalogUrl, { signal })
      if (signal.aborted) return
      setFilms(result)
      setNotice(film.published ? '影片已下架。' : '影片已上架。')
    })
    if (film.published) confirm('下架《' + film.title + '》？学习记录和网盘文件会保留。', action)
    else action()
  }

  function attachPlaybackCopy(film: TheaterAdminFilm) {
    void run('copy', async signal => {
      await requestTheater(userId, catalogUrl, { method: 'PATCH', signal, body: JSON.stringify({
        id: film.id, revision: film.revision,
      }) })
      const result = await requestTheater<TheaterAdminFilm[]>(userId, catalogUrl, { signal })
      if (signal.aborted) return
      setFilms(result)
      setNotice('已关联 MP4 播放副本。')
    })
  }

  const disabled = busy !== null
  const shareDisabled = disabled && busy !== 'match'
  return (
    <Flex direction="column" gap="4" data-sync-saving={busy === 'directory' || busy === 'save' || busy === 'publish' || busy === 'import' || busy === 'copy'}
      data-sync-dirty={dirty}>
      <Flex wrap="wrap" align="center" justify="between" gap="2">
        <Heading as="h2" size="4">电影剧场</Heading>
        <Button variant="soft" onClick={refresh} disabled={disabled}>刷新片库</Button>
      </Flex>
      {notice && <Text role="status" size="2">{notice}</Text>}
      {error && <Text role="alert" size="2" color="red">{error}</Text>}
      {busy === 'catalog' && <SyncPending>正在读取片库…</SyncPending>}
      {mediaDirectory !== undefined && <StickerCard as="section" size="sm" elevation="flat">
        <Flex direction="column" gap="2">
          <Flex align="center" justify="between" gap="2" wrap="wrap">
            <Heading as="h3" size="3">媒体目录</Heading>
            {mediaDirectory && !changingDirectory && <Button type="button" variant="soft" disabled={disabled}
              onClick={() => setChangingDirectory(true)}>更改目录</Button>}
          </Flex>
          {mediaDirectory && <Text size="2" className="break-all">{mediaDirectory.path}</Text>}
          {choosingDirectory && <>
            {!directoryOptions.length && <Text size="2" color="gray">请先在「路径」添加影片所在的授权目录。</Text>}
            <SyncSelect label={mediaDirectory ? '新媒体目录' : '选择媒体目录'} value={directoryChoice} options={directoryOptions}
              empty="选择授权目录" disabled={disabled || !directoryOptions.length} onValueChange={setDirectoryChoice} />
            <Flex gap="2" wrap="wrap">
              <Button type="button" loading={busy === 'directory'}
                disabled={disabled || !directoryChoice || directoryChoice === directoryId} onClick={bindDirectory}>绑定媒体目录</Button>
              {changingDirectory && <Button type="button" variant="soft" color="gray" disabled={disabled}
                onClick={() => { setChangingDirectory(false); setDirectoryChoice('') }}>取消</Button>}
            </Flex>
          </>}
        </Flex>
      </StickerCard>}
      {directoryId && <StickerCard>
        <form onSubmit={save}>
          <Flex direction="column" gap="3">
            <Heading as="h3" size="3">添加影片</Heading>
            {busy === 'files' && <SyncPending>正在检查影片目录及子目录…</SyncPending>}
            {inventory && <>
              <SyncSelect label="视频" value={videoId} options={videos.map(file => ({
                value: file.fileId, label: file.folder ? `${file.folder}/${file.name}` : file.name,
              }))} empty="选择未绑定的视频" disabled={disabled || !videos.length} onValueChange={pickVideo} />
              {inventory.videos.length === 0 && <Text color="gray" size="2" role="status">
                该目录及子目录中没有未绑定的视频。
              </Text>}
              {unsupportedVideos.length > 0 && <details>
                <summary className="cursor-pointer text-sm text-text-secondary">
                  找到 {unsupportedVideos.length} 个其他格式的视频，目前支持绑定 MP4、MKV、RMVB
                </summary>
                <ul className="mt-2 space-y-1 pl-4">
                  {unsupportedVideos.map(file => <li key={file.fileId}>
                    <Text size="2" className="break-all">{file.folder ? `${file.folder}/${file.name}` : file.name}</Text>
                  </li>)}
                </ul>
              </details>}
            </>}
            {selectedVideo && <>
              <Flex direction="column" gap="1" asChild>
                <label>
                  <Text size="2">片名</Text>
                  <TextField.Root value={title} maxLength={120} disabled={disabled}
                    onChange={event => setTitle(event.target.value)} />
                </label>
              </Flex>
              <div className="grid min-w-0 gap-3 md:grid-cols-2">
                <SyncSelect label="英文字幕" value={enId} options={subtitles.filter(file => file.value !== zhId)}
                  empty="不绑定英文字幕" disabled={disabled} onValueChange={setEnId} />
                <SyncSelect label="中文字幕" value={zhId} options={subtitles.filter(file => file.value !== enId)}
                  empty="不绑定中文字幕" disabled={disabled} onValueChange={setZhId} />
              </div>
              <StickerCard as="section" size="sm" tone="paper" elevation="flat">
                <Flex direction="column" gap="2">
                  <Flex align="center" justify="between" gap="2" wrap="wrap">
                    <Heading as="h4" size="3">同目录字幕</Heading>
                    <Button type="button" variant="soft" loading={busy === 'match'} disabled={disabled}
                      onClick={() => matchSubtitles(videoId, { en: enId, zh: zhId }, false)}>重新匹配</Button>
                  </Flex>
                  {busy === 'match' && <Text role="status" size="2" color="gray">正在查找同目录字幕…</Text>}
                  {matched && !matched.tracks.length && !matched.failedCount && !matched.remainingCount &&
                    <Text size="2" color="gray">没有找到同名字幕。</Text>}
                  {generatedSubtitle && <Flex direction="column" gap="1">
                    <Text size="2" weight="bold" className="break-all">
                      {generatedSubtitle.name} · {generatedSubtitle.cueCount} 条
                    </Text>
                    <Text size="2" className="whitespace-pre-wrap break-words">{generatedSubtitle.preview}</Text>
                    {!generatedSubtitle.language && <Text size="2" color="gray">
                      已生成原声字幕，请在上方选择要绑定的字幕轨。
                    </Text>}
                  </Flex>}
                  {matched?.tracks.map(track => (
                    <Flex key={track.fileId} direction="column" gap="1">
                      <Text size="2" weight="bold" className="break-all">{track.name} · {track.cueCount} 条</Text>
                      <Text size="2" className="whitespace-pre-wrap break-words">{track.preview}</Text>
                    </Flex>
                  ))}
                  {matched?.tracks.some(track => !track.language || !matched.suggested[track.language]) &&
                    <Text size="2" color="gray">请在上方为未自动绑定的字幕选择语言和文件。</Text>}
                  {matched?.failedCount ? <Text size="2" role="status">
                    有 {matched.failedCount} 个同名文件无法预览，请核对格式或重新匹配。
                  </Text> : null}
                  {matched?.remainingCount ? <Text size="2" color="gray">
                    还有 {matched.remainingCount} 个同名文件，可在字幕下拉框手动选择。
                  </Text> : null}
                </Flex>
              </StickerCard>
              <StickerCard as="section" size="sm" tone="paper" elevation="flat">
                <Flex direction="column" gap="2">
                  <Heading as="h4" size="3">从百度网盘分享获取字幕</Heading>
                  <Flex direction="column" gap="1" asChild><label>
                    <Text size="2">影片分享链接或完整分享内容</Text>
                    <TextField.Root value={shareLink} maxLength={500} disabled={shareDisabled}
                      onChange={event => setShareLink(event.target.value)} />
                  </label></Flex>
                  <Flex direction="column" gap="1" asChild><label>
                    <Text size="2">提取码（链接中含提取码时可省略）</Text>
                    <TextField.Root value={shareCode} maxLength={4} disabled={shareDisabled}
                      onChange={event => setShareCode(event.target.value)} />
                  </label></Flex>
                  <Flex><Button type="button" loading={busy === 'import'}
                    disabled={shareDisabled} onClick={importShareSubtitles}>获取网盘字幕</Button></Flex>
                  {busy === 'import' && <SyncPending>正在读取百度网盘字幕并保存到影片目录…</SyncPending>}
                  {shareFeedback && <Text size="2" color={shareFeedback.kind === 'error' ? 'red' : 'green'}
                    role={shareFeedback.kind === 'error' ? 'alert' : 'status'}>{shareFeedback.message}</Text>}
                </Flex>
              </StickerCard>
              {showTranscription && <Flex direction="column" gap="2">
                {canGenerateSubtitles && <Flex>
                  <Button type="button" variant="soft" loading={busy === 'transcribe'} disabled={disabled}
                    onClick={() => matchSubtitles(videoId, { en: '', zh: '' }, true)}>没有现成字幕，提交百炼转写</Button>
                </Flex>}
                {job && <Text role="status" size="2" weight="medium">{jobLabels[job.state]}</Text>}
                {jobError && <Text role="status" size="2" color="red">{jobError}</Text>}
                {job?.message && <Text size="2" color={jobActive(job.state) ? 'gray' : 'red'}>{job.message}</Text>}
                {job?.state === 'failed' && <Flex>
                  <Button type="button" variant="soft" loading={busy === 'retry'} disabled={disabled}
                    onClick={retrySubtitleJob}>重试转写</Button>
                </Flex>}
              </Flex>}
            </>}
            <Flex gap="2" wrap="wrap">
              <Button type="button" variant="soft" disabled={disabled} onClick={() => loadFiles(directoryId)}>
                重新检查目录
              </Button>
              {selectedVideo && <Button type="submit" loading={busy === 'save'}
                disabled={disabled || !title.trim() || !(enId || zhId) || enId === zhId}>
                保存为草稿
              </Button>}
            </Flex>
          </Flex>
        </form>
      </StickerCard>}

      {films?.length === 0 && <Text color="gray" size="2">片库还没有影片。</Text>}
      {films?.map(film => (
        <StickerCard key={film.id}>
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Flex direction="column" gap="1" minWidth="0">
              <Text weight="bold" className="break-words">{film.title}</Text>
              <Text size="2" color="gray" className="break-all">{film.videoName}</Text>
              <Flex gap="2" wrap="wrap">
                <Badge color={film.published ? 'green' : 'gray'}>{film.published ? '已上架' : '未上架'}</Badge>
                {film.languages.map(language => <Badge key={language}>{theaterLanguageLabel[language]}字幕</Badge>)}
                {film.playbackName && <Badge color="green">已关联播放副本</Badge>}
                {!film.directoryId && <Badge color="red">授权目录已移除</Badge>}
              </Flex>
            </Flex>
            <Flex direction="column" gap="2" align="start" minWidth="0">
              <Flex gap="2" wrap="wrap">
                {film.format !== 'mp4' && <Button type="button" variant="soft"
                  disabled={disabled || !film.directoryId} onClick={() => attachPlaybackCopy(film)}>
                  {film.playbackName ? '重新关联 MP4 副本' : '关联 MP4 副本'}
                </Button>}
                <Button type="button" variant={film.published ? 'soft' : 'solid'}
                  disabled={disabled || !film.directoryId} onClick={() => toggleFilm(film)}>{film.published ? '下架' : '上架'}</Button>
              </Flex>
              {film.format !== 'mp4' && !film.playbackName && <Text size="2" color="gray" className="break-all">
                如需副本，将 {theaterPlaybackCopyName(film.videoName)} 放到影片同目录。
              </Text>}
            </Flex>
          </Flex>
        </StickerCard>
      ))}
      {dialog}
    </Flex>
  )
}
