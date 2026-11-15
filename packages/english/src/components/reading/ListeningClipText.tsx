'use client'

type Props = {
  english: string
  chinese?: string
  showTranslation?: boolean
}

/** Shared sentence presentation for reading listening and homework previews. */
export default function ListeningClipText({ english, chinese, showTranslation = true }: Props) {
  return <>
    <p lang="en" className="text-2xl leading-[1.45] font-semibold text-slate-900">
      <mark className="rounded-sm bg-amber-100 box-decoration-clone text-inherit">
        {english}
      </mark>
    </p>
    {showTranslation && chinese && (
      <p lang="zh-CN" className="mt-2 text-base leading-relaxed text-slate-600">{chinese}</p>
    )}
  </>
}
