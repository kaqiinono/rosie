'use client'

import { useEffect, useState, type RefObject } from 'react'
import { probeBaiduMedia } from './baiduErrors'

export function useBaiduMediaError(ref: RefObject<HTMLMediaElement | null>, source?: string) {
  const [message, setMessage] = useState('')
  useEffect(() => {
    const element = ref.current
    if (!element) return
    let controller: AbortController | undefined
    const clear = () => { controller?.abort(); setMessage('') }
    const failed = () => {
      controller?.abort()
      const attempt = new AbortController()
      controller = attempt
      setMessage('音频暂时无法播放，正在检查…')
      void probeBaiduMedia(element.currentSrc || element.src, attempt.signal).then(result => {
        if (!attempt.signal.aborted) setMessage(result ?? '音频暂时无法播放，请重试。')
      }).catch(() => {
        if (!attempt.signal.aborted) setMessage('音频读取失败，请检查网络后重试。')
      })
    }
    clear()
    element.addEventListener('error', failed)
    element.addEventListener('loadstart', clear)
    element.addEventListener('playing', clear)
    if (element.error) failed()
    return () => {
      controller?.abort()
      element.removeEventListener('error', failed)
      element.removeEventListener('loadstart', clear)
      element.removeEventListener('playing', clear)
    }
  }, [ref, source])
  return message
}
