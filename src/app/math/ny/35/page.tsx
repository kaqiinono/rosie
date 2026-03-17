'use client'

import { useState, useCallback, useRef } from 'react'
import type { PageName, ProblemSet, Problem } from '@/utils/type'
import { STORAGE_KEYS, SOURCE_LABELS } from '@/utils/constant'
import { PROBLEMS } from '@/utils/lesson35-data'
import { useLocalStorage } from '@/hooks/useLocalStorage'

import AppHeader from '@/components/math/lesson35/AppHeader'
import Sidebar from '@/components/math/lesson35/Sidebar'
import BottomNav from '@/components/math/lesson35/BottomNav'
import HomePage from '@/components/math/lesson35/HomePage'
import ProblemList from '@/components/math/lesson35/ProblemList'
import FilterPanel from '@/components/math/lesson35/FilterPanel'
import ProblemDetail from '@/components/math/lesson35/ProblemDetail'
import CongratsModal from '@/components/math/lesson35/CongratsModal'
import Toast from '@/components/math/lesson35/Toast'

interface Filters {
  source: Set<string>
  type: Set<string>
}

export default function Lesson35Page() {
  const [currentPage, setCurrentPage] = useState<PageName>('home')
  const [prevPage, setPrevPage] = useState<PageName>('home')
  const [currentProb, setCurrentProb] = useState<{ set: string; prob: Problem } | null>(null)
  const [solved, setSolved] = useLocalStorage<Record<string, boolean>>(STORAGE_KEYS.GUIYI_SOLVED, {})
  const [toast, setToast] = useState<string | null>(null)
  const [showCongrats, setShowCongrats] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    source: new Set(['lesson', 'homework', 'workbook', 'pretest']),
    type: new Set(['type1', 'type2', 'type3', 'type4', 'type5']),
  })
  const mainRef = useRef<HTMLDivElement>(null)

  const navigate = useCallback(
    (page: PageName, filterType?: string) => {
      setPrevPage(currentPage)
      setCurrentPage(page)
      if (page === 'alltest' && filterType) {
        setFilters(f => ({
          ...f,
          type: new Set([filterType]),
        }))
      }
      mainRef.current?.scrollTo(0, 0)
    },
    [currentPage],
  )

  const openProblem = useCallback(
    (setName: string, id: string) => {
      const list = PROBLEMS[setName as keyof ProblemSet]
      const prob = list?.find(p => p.id === id)
      if (!prob) return
      setCurrentProb({ set: setName, prob })
      setPrevPage(currentPage)
      setCurrentPage('detail')
      mainRef.current?.scrollTo(0, 0)
    },
    [currentPage],
  )

  const goBack = useCallback(() => {
    const target = prevPage === 'detail' || prevPage === 'home' ? 'home' : prevPage
    setCurrentPage(target)
  }, [prevPage])

  const handleSolve = useCallback(
    (id: string) => {
      if (!solved[id]) {
        setSolved(prev => ({ ...prev, [id]: true }))
        setShowCongrats(true)
      }
    },
    [solved, setSolved],
  )

  const toggleFilter = useCallback((axis: 'source' | 'type', value: string) => {
    setFilters(f => {
      const next = new Set(f[axis])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...f, [axis]: next }
    })
  }, [])

  const handleFilterByTag = useCallback(
    (tag: string) => {
      navigate('alltest', tag)
    },
    [navigate],
  )

  const pretestDone = PROBLEMS.pretest.filter(p => solved[p.id]).length

  return (
    <div className="flex min-h-screen flex-col bg-[#fef9f0] text-[15px] text-text-primary" style={{ fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' }}>
      <AppHeader
        currentPage={currentPage}
        solved={solved}
        problems={PROBLEMS}
        onNavigate={navigate}
      />

      <div className="mx-auto flex w-full max-w-[1400px] flex-1 pb-[60px] md:pb-0">
        <Sidebar
          currentPage={currentPage}
          solved={solved}
          problems={PROBLEMS}
          onNavigate={navigate}
        />

        <div ref={mainRef} className="min-w-0 flex-1 overflow-y-auto p-5 md:px-8 md:py-6">
          {/* HOME */}
          {currentPage === 'home' && (
            <HomePage problems={PROBLEMS} solved={solved} onNavigate={navigate} />
          )}

          {/* LESSON */}
          {currentPage === 'lesson' && (
            <div>
              <div className="mb-3.5 rounded-[14px] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
                <div className="text-sm font-bold">📖 课堂讲解 · 6道例题</div>
                <div className="mt-1 text-xs text-text-muted">按顺序学习，点击题目开始互动</div>
              </div>
              <ProblemList
                problems={PROBLEMS.lesson}
                solved={solved}
                setName="lesson"
                onOpen={openProblem}
                onFilterByTag={handleFilterByTag}
              />
            </div>
          )}

          {/* HOMEWORK */}
          {currentPage === 'homework' && (
            <div>
              <div className="mb-3.5 rounded-[14px] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
                <div className="text-sm font-bold">✏️ 课后巩固 · 6道练习</div>
                <div className="mt-1 text-xs text-text-muted">巩固今天学到的归一技巧</div>
              </div>
              <ProblemList
                problems={PROBLEMS.homework}
                solved={solved}
                setName="homework"
                onOpen={openProblem}
                onFilterByTag={handleFilterByTag}
              />
            </div>
          )}

          {/* WORKBOOK */}
          {currentPage === 'workbook' && (
            <div>
              <div className="mb-3.5 rounded-[14px] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
                <div className="text-sm font-bold">📚 练习册闯关 · 12关</div>
                <div className="mt-1 text-xs text-text-muted">每一关都是新挑战，你能全部通关吗？</div>
              </div>
              <ProblemList
                problems={PROBLEMS.workbook}
                solved={solved}
                setName="workbook"
                onOpen={openProblem}
                onFilterByTag={handleFilterByTag}
              />
            </div>
          )}

          {/* ALLTEST */}
          {currentPage === 'alltest' && (
            <FilterPanel
              problems={PROBLEMS}
              solved={solved}
              filters={filters}
              onToggleFilter={toggleFilter}
              onOpenProblem={openProblem}
            />
          )}

          {/* PRETEST */}
          {currentPage === 'pretest' && (
            <div>
              <div className="mb-3.5 rounded-[14px] border border-[#fde68a] bg-gradient-to-br from-[#fffbeb] to-yellow-light p-4">
                <div className="mb-1 text-sm font-extrabold text-[#92400e]">📝 课前测 · 第35讲</div>
                <div className="mb-2 text-xs text-[#a16207]">一年级目标班 · 春季 · 做完5道题看看你的起点！</div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-[#fde68a]">
                    <div
                      className="h-full rounded-sm bg-yellow transition-[width] duration-400"
                      style={{ width: `${Math.round((pretestDone / 5) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs font-bold text-[#92400e]">{pretestDone}/5</div>
                </div>
              </div>
              <ProblemList
                problems={PROBLEMS.pretest}
                solved={solved}
                setName="pretest"
                onOpen={openProblem}
                onFilterByTag={handleFilterByTag}
              />
            </div>
          )}

          {/* DETAIL */}
          {currentPage === 'detail' && currentProb && (
            <ProblemDetail
              problem={currentProb.prob}
              isSolved={!!solved[currentProb.prob.id]}
              onSolve={handleSolve}
              onBack={goBack}
              onToast={setToast}
            />
          )}
        </div>
      </div>

      <BottomNav currentPage={currentPage} onNavigate={navigate} />
      <CongratsModal visible={showCongrats} onClose={() => setShowCongrats(false)} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
