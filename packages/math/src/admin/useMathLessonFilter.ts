'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { gradesInOrder, lessonsForGrade } from '@rosie/math/utils/lesson-grade'
import {
  aggregateSourceButtons,
  aggregateTypeButtons,
} from '@rosie/math/utils/math-problem-search'
import {
  resolveInitialGradeAndLessons,
  writeMathLessonFilter,
} from '@rosie/math/admin/math-lesson-filter-storage'

function initialAxisFilter(
  lessons: string[],
  savedKeys: string[] | undefined,
  aggregate: typeof aggregateSourceButtons,
): Set<string> {
  const all = new Set(aggregate(lessons).map((b) => b.key))
  if (!savedKeys?.length) return all
  const picked = new Set(savedKeys.filter((key) => all.has(key)))
  return picked.size > 0 ? picked : all
}

export function useMathLessonFilter() {
  const grades = gradesInOrder()
  const [initial] = useState(() => resolveInitialGradeAndLessons())

  const [selectedGrade, setSelectedGrade] = useState(initial.grade)
  const [selectedLessons, setSelectedLessons] = useState<string[]>(initial.lessons)
  const [sourceFilter, setSourceFilter] = useState<Set<string>>(() =>
    initialAxisFilter(initial.lessons, initial.saved?.sourceFilter, aggregateSourceButtons),
  )
  const [typeFilter, setTypeFilter] = useState<Set<string>>(() =>
    initialAxisFilter(initial.lessons, initial.saved?.typeFilter, aggregateTypeButtons),
  )
  const skipLessonResetRef = useRef(true)

  const gradeLessonIds = useMemo(() => lessonsForGrade(selectedGrade), [selectedGrade])

  const selectedLessonsKey = useMemo(
    () => [...selectedLessons].sort((a, b) => Number(a) - Number(b)).join(','),
    [selectedLessons],
  )

  const sourceFilterKey = useMemo(() => [...sourceFilter].sort().join(','), [sourceFilter])

  const typeFilterKey = useMemo(() => [...typeFilter].sort().join(','), [typeFilter])

  const selectedLessonSet = useMemo(
    () => new Set(selectedLessons),
    [selectedLessonsKey, selectedLessons],
  )

  const sourceBtns = useMemo(
    () => aggregateSourceButtons(selectedLessons),
    [selectedLessonsKey, selectedLessons],
  )

  const typeBtns = useMemo(
    () => aggregateTypeButtons(selectedLessons),
    [selectedLessonsKey, selectedLessons],
  )

  useEffect(() => {
    if (skipLessonResetRef.current) {
      skipLessonResetRef.current = false
      return
    }
    setSourceFilter(new Set(sourceBtns.map((b) => b.key)))
    setTypeFilter(new Set(typeBtns.map((b) => b.key)))
  }, [selectedLessonsKey, sourceBtns, typeBtns])

  useEffect(() => {
    writeMathLessonFilter({
      selectedGrade,
      selectedLessons,
      sourceFilter: [...sourceFilter],
      typeFilter: [...typeFilter],
    })
  }, [selectedGrade, selectedLessonsKey, sourceFilterKey, typeFilterKey, selectedLessons, sourceFilter, typeFilter])

  function selectGrade(grade: number) {
    if (grade === selectedGrade) return
    setSelectedGrade(grade)
    setSelectedLessons(lessonsForGrade(grade))
  }

  function toggleLesson(id: string) {
    setSelectedLessons((prev) =>
      prev.includes(id) ? prev.filter((lessonId) => lessonId !== id) : [...prev, id],
    )
  }

  function toggleAllLessonsInGrade() {
    const allOn = gradeLessonIds.every((id) => selectedLessonSet.has(id))
    setSelectedLessons(allOn ? [] : [...gradeLessonIds])
  }

  function toggleFilter(axis: 'source' | 'type', value: string) {
    const setter = axis === 'source' ? setSourceFilter : setTypeFilter
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function toggleAllFilters(axis: 'source' | 'type') {
    const btns = axis === 'source' ? sourceBtns : typeBtns
    const setter = axis === 'source' ? setSourceFilter : setTypeFilter
    const current = axis === 'source' ? sourceFilter : typeFilter
    const allSelected = btns.length > 0 && btns.every((b) => current.has(b.key))
    setter(allSelected ? new Set() : new Set(btns.map((b) => b.key)))
  }

  return {
    grades,
    selectedGrade,
    selectedLessons,
    selectedLessonsKey,
    selectedLessonSet,
    gradeLessonIds,
    sourceFilter,
    typeFilter,
    sourceFilterKey,
    typeFilterKey,
    sourceBtns,
    typeBtns,
    selectGrade,
    toggleLesson,
    toggleAllLessonsInGrade,
    toggleFilter,
    toggleAllFilters,
  }
}
