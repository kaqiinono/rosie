'use client'

import { GrammarScanImage } from './GrammarScanImage'

import type { GrammarFigure } from '../types'
import { grammarPageImageUrl } from '../types'
import { StickerCard } from '@rosie/ui'
import { Button } from '@rosie/ui/themes'

interface FigureCardProps {
  figure: GrammarFigure
  isAdmin: boolean
  onPreview: (figure: GrammarFigure) => void
  onRecrop?: () => void
  onRemove?: () => void
}

/** 插图卡片（讲解 Section / 练习组共用）：所有用户可点击放大；admin 另有重裁/删除入口 */
export function FigureCard({ figure, isAdmin, onPreview, onRecrop, onRemove }: FigureCardProps) {
  const url = grammarPageImageUrl(figure.path)
  return (
    <div className="group relative max-w-full self-start">
      <StickerCard asChild tone="white" size="none" elevation="sm" radius="md" className="block max-w-full overflow-hidden p-0">
        <button // native-ok: 图片预览需按原图比例撑开容器；Radix Button 的固定高度会使图片溢出并覆盖后续内容
          type="button"
          onClick={() => onPreview(figure)}
          className="block max-w-full overflow-hidden p-0"
        >
          <GrammarScanImage
            loading="lazy"
            src={url}
            alt={`插图（原书 p.${figure.page}）`}
            className="block max-h-64 w-auto max-w-full"
          />
        </button>
      </StickerCard>
      {isAdmin && (
        <div className="absolute top-1 right-1 flex gap-1 opacity-80">
          {onRecrop && (
            <Button
              type="button"
              onClick={onRecrop}
              title="重新裁切"
              variant="outline"
              color="gray"
              size="1"
            >
              ✂️ 重裁
            </Button>
          )}
          {onRemove && (
            <Button
              type="button"
              onClick={onRemove}
              title="删除插图"
              variant="outline"
              color="red"
              size="1"
            >
              ✕ 删除
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
