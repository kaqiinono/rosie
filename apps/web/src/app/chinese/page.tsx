import Link from 'next/link'
import { CHINESE_BOOKS, ChineseDailyCard } from '@rosie/chinese'

export default function ChinesePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">语文学习</h1>
          <p className="mt-1 text-sm text-slate-500">先选择年级，再进入对应学习页面。</p>
        </div>
        <Link href="/" className="shrink-0 pt-1 text-xs font-semibold text-slate-400 no-underline hover:text-slate-600">
          ← 乐园
        </Link>
      </header>

      <div className="mt-6">
        <ChineseDailyCard />
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        {CHINESE_BOOKS.map((book) => (
          <Link
            key={book.slug}
            href={`/chinese/${book.slug}`}
            className="group block rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 no-underline shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-amber-700 uppercase">
                  {book.isOpen ? '已开放' : '筹备中'}
                </p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-900">{book.label}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  识字 {book.recognizeTotal} · 写字 {book.writeTotal}
                </p>
              </div>
              <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-bold text-amber-700 shadow-sm">
                进入
              </span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  )
}
