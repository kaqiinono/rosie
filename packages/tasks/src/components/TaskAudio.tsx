'use client'

import { useEffect } from 'react'
import { supabase } from '@rosie/core'
import { PlayerDock, usePlaylistPlayer, type PlayerTrack } from '@rosie/player'
import type { TaskMaterial } from '../types'
import { useTasks, buttonClass } from './shared'

export default function TaskAudio({ material }: { material: TaskMaterial }) {
  const { run, busy, notify } = useTasks()
  const player = usePlaylistPlayer()
  const stop = player.stop
  useEffect(() => () => stop(), [stop, material.id])
  return <div className="space-y-3"><p className="text-sm text-slate-500">当前音频会一直循环。点击下一条才切换，最后请手动确认任务完成。</p>
    <button disabled={busy || !material.audio.length} className={buttonClass} onClick={() => void run(async () => {
      const tracks: PlayerTrack[] = await Promise.all(material.audio.map(async a => {
        const { data, error } = await supabase.storage.from('task-audio').createSignedUrl(a.path, 86400)
        if (error) throw error
        return { label: a.label, url: data.signedUrl, refLink: null, mediaType: 'audio', source: null }
      }))
      player.play(tracks)
    })}>开始 / 重新载入音频</button>
    <PlayerDock theme="light" player={{ ...player, loopMode: 'one', loopCount: Infinity, cycleLoopMode: () => undefined, cycleLoopCount: () => undefined, setLoopMode: () => undefined, onEnded: () => { const element = player.audioRef.current; if (element) { element.currentTime = 0; void element.play().catch(() => notify('请点击播放继续听音频')) } } }} />
  </div>
}
