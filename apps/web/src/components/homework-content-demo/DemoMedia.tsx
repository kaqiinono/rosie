'use client'

import { useEffect, useRef, useState } from 'react'
import { PlayerDock, usePlaylistPlayer } from '@rosie/player'
import { Button, Flex, Text } from '@rosie/ui/themes'

function makeTone(): Blob {
  const rate = 16000, samples = rate * 3
  const bytes = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(bytes)
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)) }
  text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE'); text(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i++) {
    const local = (i % rate) / rate
    const envelope = Math.max(0, Math.min(local * 15, (0.7 - local) * 6))
    view.setInt16(44 + i * 2, Math.sin(i / rate * Math.PI * 2 * [440, 554, 659][Math.floor(i / rate)]) * envelope * 5000, true)
  }
  return new Blob([bytes], { type: 'audio/wav' })
}

type Props = { type: 'audio' | 'video'; active: boolean; epoch: number }
export default function DemoMedia({ type, active, epoch }: Props) {
  const player = usePlaylistPlayer()
  const { stop, playWhenReady } = player
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ownedUrl = useRef('')
  const cancelGeneration = useRef<(() => void) | null>(null)
  const generation = useRef(0)
  const install = (blob: Blob) => {
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current)
    ownedUrl.current = URL.createObjectURL(blob)
    setUrl(ownedUrl.current)
  }
  useEffect(() => {
    if (type === 'audio') install(makeTone())
    return () => { if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current) }
  }, [type])
  useEffect(() => {
    generation.current += 1
    stop(); cancelGeneration.current?.(); setBusy(false)
    return () => { generation.current += 1; stop(); cancelGeneration.current?.() }
  }, [active, epoch, stop])
  const generate = () => {
    setError('')
    if (!('MediaRecorder' in window) || !HTMLCanvasElement.prototype.captureStream) {
      setError('当前浏览器不能生成演示视频。请使用支持 Canvas 录制的浏览器。'); return
    }
    const token = generation.current
    const canvas = document.createElement('canvas')
    canvas.width = 640; canvas.height = 360
    const ctx = canvas.getContext('2d')
    if (!ctx) { setError('无法创建演示画面。'); return }
    let stream: MediaStream | undefined
    try {
      stream = canvas.captureStream(12)
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      let tick = 0
      const draw = () => {
        ctx.fillStyle = '#fff6e5'; ctx.fillRect(0, 0, 640, 360)
        ctx.fillStyle = '#292524'; ctx.font = 'bold 32px sans-serif'; ctx.fillText('3 + 2 = 5', 230, 70)
        for (let i = 0; i < 5; i++) {
          ctx.beginPath(); ctx.arc(120 + i * 100, 190, 30, 0, Math.PI * 2)
          ctx.fillStyle = i < 3 ? '#fbbf24' : '#34d399'; ctx.fill()
        }
        ctx.font = '20px sans-serif'; ctx.fillStyle = '#57534e'; ctx.fillText('Demo video · local sample', 185, 290)
        ctx.fillStyle = '#f59e0b'; ctx.fillRect(40, 325, Math.min(tick / 24, 1) * 560, 8)
      }
      draw()
      const timer = window.setInterval(() => { tick++; draw(); if (tick >= 24) { clearInterval(timer); if (recorder.state === 'recording') recorder.stop() } }, 1000 / 12)
      const finish = () => { clearInterval(timer); stream?.getTracks().forEach(track => track.stop()) }
      cancelGeneration.current = () => { finish(); if (recorder.state === 'recording') recorder.stop() }
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
      recorder.onstop = () => {
        finish(); cancelGeneration.current = null
        if (token !== generation.current) return
        setBusy(false)
        if (chunks.length) install(new Blob(chunks, { type: recorder.mimeType }))
        else setError('未生成视频，请重试。')
      }
      recorder.onerror = () => { finish(); if (token === generation.current) { setBusy(false); setError('生成视频失败，请重试。') } }
      setBusy(true); recorder.start()
    } catch { stream?.getTracks().forEach(track => track.stop()); cancelGeneration.current?.(); setBusy(false); setError('当前浏览器不支持此视频格式。') }
  }
  return <Flex direction="column" gap="3">
    <Text size="2" color="gray">{type === 'audio' ? '三秒提示音样例，非课文录音。' : '两秒本地动画样片，非课程视频。生成后点击播放。'}</Text>
    {type === 'video' && !url && <Button variant="soft" loading={busy} disabled={!active} onClick={generate}>准备演示视频</Button>}
    {url && <Button variant="soft" disabled={!active} onClick={() => {
      setError('')
      void playWhenReady({ url, label: type === 'audio' ? '提示音样例' : '加法动画样片', mediaType: type, source: null, refLink: null })
        .catch(() => setError('播放失败，请再次点击播放。'))
    }}>播放{type === 'audio' ? '音频' : '视频'}</Button>}
    <PlayerDock player={player} placement="inline" appearance="quiet" showProgress />
    {error && <Text role="alert" color="red">{error}</Text>}
  </Flex>
}
