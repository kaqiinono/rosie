'use client'

import { use, useMemo } from 'react'
import Link from 'next/link'
import { PoemRecite, getBookPoems, useChineseContext } from '@rosie/chinese'

export default function ChinesePoemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { bookSlug } = useChineseContext()
  const poem = useMemo(
    () => getBookPoems(bookSlug).find((p) => p.id === id),
    [bookSlug, id],
  )

  if (!poem) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-slate-500">未找到该古诗</p>
        <Link href="/chinese/poems" className="mt-2 text-sm text-violet-600">
          返回列表
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      <Link href="/chinese/poems" className="text-xs font-semibold text-violet-600 no-underline">
        ← 古诗列表
      </Link>
      <div className="mt-4">
        <PoemRecite poem={poem} />
      </div>
    </div>
  )
}
