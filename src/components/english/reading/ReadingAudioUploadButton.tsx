'use client'

import { useCallback, useRef, useState } from 'react'
import clsx from 'clsx'
import { isReadingAudioFile } from '@/utils/reading-audio-types'

type ReadingAudioUploadButtonProps = {
  passageKey: string
  hasAudio: boolean
  onUpload: (passageKey: string, file: File) => Promise<{ error: string | null }>
  className?: string
  size?: 'sm' | 'md'
}

export default function ReadingAudioUploadButton({
  passageKey,
  hasAudio,
  onUpload,
  className,
  size = 'md',
}: ReadingAudioUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openPicker = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (uploading) return
      inputRef.current?.click()
    },
    [uploading],
  )

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      if (!isReadingAudioFile(file)) {
        setError('请选择音频文件（mp3、m4a 等）')
        return
      }
      setUploading(true)
      setError(null)
      const { error: uploadError } = await onUpload(passageKey, file)
      setUploading(false)
      if (uploadError) setError(uploadError)
    },
    [onUpload, passageKey],
  )

  const sizeClass = size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1 text-[11px]'

  return (
    <div className={clsx('inline-flex flex-col items-end gap-0.5', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
        className="sr-only"
        aria-hidden
        onChange={(e) => void onFileChange(e)}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={openPicker}
        title={hasAudio ? '重新上传将覆盖原音频' : '选择音频文件上传'}
        aria-label={hasAudio ? '更换课文音频' : '上传课文音频'}
        className={clsx(
          'inline-flex cursor-pointer items-center gap-1 rounded-full font-bold whitespace-nowrap ring-1 transition active:scale-95 disabled:cursor-wait disabled:opacity-60',
          sizeClass,
          hasAudio
            ? 'bg-white/90 text-slate-600 ring-slate-200 hover:bg-white'
            : 'bg-white/90 text-orange-700 ring-orange-200 hover:bg-white',
        )}
      >
        <span className="text-[12px] leading-none">{uploading ? '⏳' : '📤'}</span>
        <span>{uploading ? '上传中' : hasAudio ? '换' : '上传'}</span>
      </button>
      {error && (
        <span
          className="max-w-[10rem] text-right text-[9px] leading-tight text-red-600"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  )
}
