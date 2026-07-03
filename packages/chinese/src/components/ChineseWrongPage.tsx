'use client'

import Link from 'next/link'
import { useChineseContext } from '../context/ChineseContext'

const KIND_LABEL: Record<string, string> = {
  pinyin: '拼音',
  stroke: '笔顺',
  phrase: '词语',
  recite: '背诵',
  accumulation: '日积月累',
}

export default function ChineseWrongPage() {
  const { unresolvedWrong } = useChineseContext()

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <header>
        <h1 className="text-xl font-extrabold text-slate-900">错题本</h1>
        <p className="mt-1 text-sm text-slate-500">练错的字词会出现在这里</p>
      </header>

      {unresolvedWrong.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">暂无错题，继续保持！</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {unresolvedWrong.map((row) => {
            const label =
              row.itemType === 'char'
                ? (() => {
                    const parts = row.itemKey.split('::')
                    return parts.length >= 2 ? parts[parts.length - 2]! : row.itemKey
                  })()
                : row.itemKey.split('::').find((p) => /[\u4e00-\u9fff]{2,}/.test(p)) ??
                  row.itemKey
            return (
              <li
                key={`${row.itemKey}-${row.wrongKind}`}
                className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3"
              >
                <div>
                  <span className="text-lg font-bold text-rose-900">{label}</span>
                  <span className="ml-2 text-xs font-semibold text-rose-600">
                    {KIND_LABEL[row.wrongKind] ?? row.wrongKind}
                  </span>
                </div>
                {row.itemType === 'char' && row.wrongKind === 'pinyin' && (
                  <Link
                    href="/chinese/chars/quiz"
                    className="text-xs font-bold text-rose-700 no-underline"
                  >
                    再练
                  </Link>
                )}
                {row.itemType === 'char' && row.wrongKind === 'stroke' && (
                  <Link
                    href="/chinese/chars/writing"
                    className="text-xs font-bold text-rose-700 no-underline"
                  >
                    再练
                  </Link>
                )}
                {row.itemType === 'phrase' && (
                  <Link
                    href="/chinese/chars"
                    className="text-xs font-bold text-rose-700 no-underline"
                  >
                    再练
                  </Link>
                )}
                {row.itemType === 'accumulation' && (
                  <Link
                    href="/chinese/accumulation"
                    className="text-xs font-bold text-rose-700 no-underline"
                  >
                    再练
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Link
        href="/chinese/daily"
        className="mt-8 block text-center text-xs font-semibold text-amber-700 no-underline"
      >
        返回今日语文 →
      </Link>
    </div>
  )
}
