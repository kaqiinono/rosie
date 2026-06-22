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

  const sizeClass = size === 'sm' ? 'h-8 w-8 text-[14px]' : 'h-9 w-9 text-[15px]'

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
        title={
          uploading
            ? '上传中…'
            : hasAudio
              ? '重新上传将覆盖原音频'
              : '选择音频文件上传'
        }
        aria-label={
          uploading
            ? '上传中'
            : hasAudio
              ? '更换课文音频'
              : '上传课文音频'
        }
        className={clsx(
          'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full ring-1 transition active:scale-95 disabled:cursor-wait disabled:opacity-60',
          sizeClass,
          hasAudio
            ? 'bg-white/90 text-slate-500 ring-slate-200 hover:bg-white hover:text-slate-700'
            : 'bg-white/90 text-orange-700 ring-orange-200 hover:bg-white',
          className,
        )}
      >
        {uploading ? (
          <span
            aria-hidden
            className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : hasAudio ? (
          <ReplaceIcon />
        ) : (
          <UploadIcon />
        )}
      </button>
      {error && (
        <span
          className="max-w-40 text-right text-[9px] leading-tight text-red-600"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  )
}

function UploadIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M5 20h14" />
    </svg>
  )
}

function ReplaceIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 15.5-6.2" />
      <path d="M19 3v4h-4" />
      <path d="M21 12a9 9 0 0 1-15.5 6.2" />
      <path d="M5 21v-4h4" />
    </svg>
  )
}
