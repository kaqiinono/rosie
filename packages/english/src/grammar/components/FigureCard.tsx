'use client'

import type { GrammarFigure } from '../types'
import { grammarPageImageUrl } from '../types'

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
    <div className="group relative self-start">
      <button
        type="button"
        onClick={() => onPreview(figure)}
        className="block overflow-hidden rounded-xl ring-1 ring-border-light transition-shadow hover:shadow-md"
      >
        <img src={url} alt={`插图（原书 p.${figure.page}）`} className="max-h-64 w-auto max-w-full" />
      </button>
      {isAdmin && (
        <div className="absolute top-1 right-1 flex gap-1 opacity-80">
          {onRecrop && (
            <button
              type="button"
              onClick={onRecrop}
              title="重新裁切"
              className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-bold text-text-secondary shadow ring-1 ring-border-light hover:bg-surface-dim"
            >
              ✂️ 重裁
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="删除插图"
              className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-bold text-app-red shadow ring-1 ring-border-light hover:bg-app-red-light"
            >
              ✕ 删除
            </button>
          )}
        </div>
      )}
    </div>
  )
}
