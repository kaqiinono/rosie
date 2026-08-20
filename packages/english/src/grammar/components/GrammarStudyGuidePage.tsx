'use client'

import Link from 'next/link'
import { useState } from 'react'
import { OrbBackground, PageBreadcrumb } from '@rosie/ui'
import { useGrammarUnits } from '../hooks/useGrammarUnits'
import { grammarPageImageUrl, type GrammarFigure, type GrammarUnitDetail } from '../types'
import { LessonView } from './LessonView'
import { ExerciseView } from './ExerciseView'

/** 学习指导 12 页条目的延展位区间（guide-p272…p283，见 BACKMATTER 注册表） */
const GUIDE_UNITS = Array.from({ length: 12 }, (_, i) => 158 + i)

const NOOP_GROUP_RESULT = () => {}

/**
 * 学习指导总览：按页条目顺序聚合展示全部内容。
 * 单元页/首页的「学习指导」标记通过 `#guide-{延展位}` 锚点定位到对应页。
 */
export default function GrammarStudyGuidePage() {
  const { units, isLoading } = useGrammarUnits(GUIDE_UNITS)
  const [lightbox, setLightbox] = useState<GrammarFigure | null>(null)

  const pages = GUIDE_UNITS.map((n) => units.get(n)).filter(
    (d): d is GrammarUnitDetail => d !== undefined,
  )

  return (
    <>
      <OrbBackground variant="home" />

      {/* 面包屑 inline 放在容器内顶部，与内容左缘对齐（fixed 变体宽屏时会落在容器外留白里） */}
      <div className="relative z-1 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-6 px-4 pt-5 pb-16 sm:px-6">
        <div className="w-fit">
          <PageBreadcrumb variant="inline" />
        </div>
        <header className="text-center">
          <div className="inline-block text-5xl">🧭</div>
          <h1 className="mt-2 bg-gradient-to-br from-emerald-700 via-teal-600 to-sky-500 bg-clip-text text-[clamp(26px,5vw,34px)] leading-tight font-black text-transparent">
            学习指导
          </h1>
          <p className="text-text-secondary mt-1.5 text-sm">
            《剑桥初级英语语法》· 自测选择题，每题标注对应学习单元
          </p>
        </header>

        {isLoading && pages.length === 0 ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface/70 ring-border-light h-24 animate-pulse rounded-xl ring-1"
              />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <div className="bg-surface text-text-muted ring-border-light rounded-2xl p-8 text-center text-sm ring-1">
            学习指导内容尚未入库
          </div>
        ) : (
          pages.map((d) => (
            <section
              key={d.unitNumber}
              id={`guide-${d.unitNumber}`}
              className="bg-surface/90 ring-border-light flex scroll-mt-24 flex-col gap-4 rounded-2xl p-4 shadow-sm ring-1 backdrop-blur-sm sm:p-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-text-primary text-base font-black">{d.title}</h2>
                {d.bookPages.length > 0 && (
                  <span className="bg-surface text-text-muted ring-border-light rounded-full px-2.5 py-0.5 text-xs font-bold ring-1">
                    📖 原书 p.{d.bookPages[0]}
                    {d.bookPages.length > 1 ? `–${d.bookPages[d.bookPages.length - 1]}` : ''}
                  </span>
                )}
              </div>
              {d.lesson.sections.length > 0 && (
                <LessonView
                  data={d.lesson}
                  isAdmin={false}
                  pageImages={d.pageImages}
                  onPreviewFigure={setLightbox}
                />
              )}
              {d.exercises.length > 0 && (
                <ExerciseView
                  groups={d.exercises}
                  isAdmin={false}
                  pageImages={d.pageImages}
                  onGroupResult={NOOP_GROUP_RESULT}
                  onPreviewFigure={setLightbox}
                />
              )}
            </section>
          ))
        )}

        <div className="text-center">
          <Link
            href="/english/grammar"
            className="text-text-secondary text-sm font-bold underline-offset-2 hover:underline"
          >
            ← 返回语法地图
          </Link>
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <div className="mx-4 max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={grammarPageImageUrl(lightbox.path)}
              alt={`插图（原书 p.${lightbox.page}）`}
              className="max-h-[88vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </>
  )
}
