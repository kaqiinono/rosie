'use client'

import { AppDialog, ImageCropper } from '@rosie/ui'

interface FigureCropModalProps {
  imageUrl: string
  title: string
  saving: boolean
  error: string | null
  onConfirm: (blob: Blob) => void
  onClose: () => void
}

/** Grammar keeps its existing upload/save contract; selection is shared with exams. */
export function FigureCropModal({ imageUrl, title, saving, error, onConfirm, onClose }: FigureCropModalProps) {
  return <AppDialog open title={title} size="preview" closeDisabled={saving} onOpenChange={open => { if (!open && !saving) onClose() }}>
    <ImageCropper imageUrl={imageUrl} saving={saving} error={error} confirmLabel="裁切并插入" onConfirm={blob => onConfirm(blob)} />
  </AppDialog>
}
