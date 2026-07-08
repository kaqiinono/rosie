'use client'

import type { ComponentType, ReactNode } from 'react'
import type { Problem, ProblemSet } from '@rosie/core'
import type { LessonContextType } from '@rosie/math/components/shared/createLessonProvider'
import type { ProblemDetailComponentProps } from '@rosie/math/components/shared/LessonProblemRoutePage'
import type { FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'
import WeekdayMagic from '@rosie/math/components/lesson36/WeekdayMagic'
import YibihaMagicBook from '@rosie/math/components/lesson38/YibihaMagicBook'
import Lesson34MagicDemo from '@rosie/math/components/lesson34/Lesson34MagicDemo'
import { PROBLEMS as P12, TAG_STYLE as TS12 } from '@rosie/math/utils/lesson12-data'
import Provider12, { useLesson12 } from '@rosie/math/components/lesson12/Lesson12Provider'
import HomePage12 from '@rosie/math/components/lesson12/HomePage'
import AppHeader12 from '@rosie/math/components/lesson12/AppHeader'
import Sidebar12 from '@rosie/math/components/lesson12/Sidebar'
import BottomNav12 from '@rosie/math/components/lesson12/BottomNav'
import FilterPanel12 from '@rosie/math/components/lesson12/FilterPanel'
import ProblemList12 from '@rosie/math/components/lesson12/ProblemList'
import ProblemDetail12 from '@rosie/math/components/lesson12/ProblemDetail'
import { PROBLEMS as P13, TAG_STYLE as TS13 } from '@rosie/math/utils/lesson13-data'
import Provider13, { useLesson13 } from '@rosie/math/components/lesson13/Lesson13Provider'
import HomePage13 from '@rosie/math/components/lesson13/HomePage'
import AppHeader13 from '@rosie/math/components/lesson13/AppHeader'
import Sidebar13 from '@rosie/math/components/lesson13/Sidebar'
import BottomNav13 from '@rosie/math/components/lesson13/BottomNav'
import FilterPanel13 from '@rosie/math/components/lesson13/FilterPanel'
import ProblemList13 from '@rosie/math/components/lesson13/ProblemList'
import ProblemDetail13 from '@rosie/math/components/lesson13/ProblemDetail'
import { PROBLEMS as P15, TAG_STYLE as TS15 } from '@rosie/math/utils/lesson15-data'
import Provider15, { useLesson15 } from '@rosie/math/components/lesson15/Lesson15Provider'
import HomePage15 from '@rosie/math/components/lesson15/HomePage'
import AppHeader15 from '@rosie/math/components/lesson15/AppHeader'
import Sidebar15 from '@rosie/math/components/lesson15/Sidebar'
import BottomNav15 from '@rosie/math/components/lesson15/BottomNav'
import FilterPanel15 from '@rosie/math/components/lesson15/FilterPanel'
import ProblemList15 from '@rosie/math/components/lesson15/ProblemList'
import ProblemDetail15 from '@rosie/math/components/lesson15/ProblemDetail'
import { PROBLEMS as P18, TAG_STYLE as TS18 } from '@rosie/math/utils/lesson18-data'
import Provider18, { useLesson18 } from '@rosie/math/components/lesson18/Lesson18Provider'
import HomePage18 from '@rosie/math/components/lesson18/HomePage'
import AppHeader18 from '@rosie/math/components/lesson18/AppHeader'
import Sidebar18 from '@rosie/math/components/lesson18/Sidebar'
import BottomNav18 from '@rosie/math/components/lesson18/BottomNav'
import FilterPanel18 from '@rosie/math/components/lesson18/FilterPanel'
import ProblemList18 from '@rosie/math/components/lesson18/ProblemList'
import ProblemDetail18 from '@rosie/math/components/lesson18/ProblemDetail'
import { PROBLEMS as P23, TAG_STYLE as TS23 } from '@rosie/math/utils/lesson23-data'
import Provider23, { useLesson23 } from '@rosie/math/components/lesson23/Lesson23Provider'
import HomePage23 from '@rosie/math/components/lesson23/HomePage'
import AppHeader23 from '@rosie/math/components/lesson23/AppHeader'
import Sidebar23 from '@rosie/math/components/lesson23/Sidebar'
import BottomNav23 from '@rosie/math/components/lesson23/BottomNav'
import FilterPanel23 from '@rosie/math/components/lesson23/FilterPanel'
import ProblemList23 from '@rosie/math/components/lesson23/ProblemList'
import ProblemDetail23 from '@rosie/math/components/lesson23/ProblemDetail'
import { PROBLEMS as P29, TAG_STYLE as TS29 } from '@rosie/math/utils/lesson29-data'
import Provider29, { useLesson29 } from '@rosie/math/components/lesson29/Lesson29Provider'
import HomePage29 from '@rosie/math/components/lesson29/HomePage'
import AppHeader29 from '@rosie/math/components/lesson29/AppHeader'
import Sidebar29 from '@rosie/math/components/lesson29/Sidebar'
import BottomNav29 from '@rosie/math/components/lesson29/BottomNav'
import FilterPanel29 from '@rosie/math/components/lesson29/FilterPanel'
import ProblemList29 from '@rosie/math/components/lesson29/ProblemList'
import ProblemDetail29 from '@rosie/math/components/lesson29/ProblemDetail'
import { PROBLEMS as P30, TAG_STYLE as TS30 } from '@rosie/math/utils/lesson30-data'
import Provider30, { useLesson30 } from '@rosie/math/components/lesson30/Lesson30Provider'
import HomePage30 from '@rosie/math/components/lesson30/HomePage'
import AppHeader30 from '@rosie/math/components/lesson30/AppHeader'
import Sidebar30 from '@rosie/math/components/lesson30/Sidebar'
import BottomNav30 from '@rosie/math/components/lesson30/BottomNav'
import FilterPanel30 from '@rosie/math/components/lesson30/FilterPanel'
import ProblemList30 from '@rosie/math/components/lesson30/ProblemList'
import ProblemDetail30 from '@rosie/math/components/lesson30/ProblemDetail'
import { PROBLEMS as P34, TAG_STYLE as TS34 } from '@rosie/math/utils/lesson34-data'
import Provider34, { useLesson34 } from '@rosie/math/components/lesson34/Lesson34Provider'
import HomePage34 from '@rosie/math/components/lesson34/HomePage'
import AppHeader34 from '@rosie/math/components/lesson34/AppHeader'
import Sidebar34 from '@rosie/math/components/lesson34/Sidebar'
import BottomNav34 from '@rosie/math/components/lesson34/BottomNav'
import FilterPanel34 from '@rosie/math/components/lesson34/FilterPanel'
import ProblemList34 from '@rosie/math/components/lesson34/ProblemList'
import ProblemDetail34 from '@rosie/math/components/lesson34/ProblemDetail'
import { PROBLEMS as P35, TAG_STYLE as TS35 } from '@rosie/math/utils/lesson35-data'
import Provider35, { useLesson35 } from '@rosie/math/components/lesson35/Lesson35Provider'
import HomePage35 from '@rosie/math/components/lesson35/HomePage'
import AppHeader35 from '@rosie/math/components/lesson35/AppHeader'
import Sidebar35 from '@rosie/math/components/lesson35/Sidebar'
import BottomNav35 from '@rosie/math/components/lesson35/BottomNav'
import FilterPanel35 from '@rosie/math/components/lesson35/FilterPanel'
import ProblemList35 from '@rosie/math/components/lesson35/ProblemList'
import ProblemDetail35 from '@rosie/math/components/lesson35/ProblemDetail'
import { PROBLEMS as P36, TAG_STYLE as TS36 } from '@rosie/math/utils/lesson36-data'
import Provider36, { useLesson36 } from '@rosie/math/components/lesson36/Lesson36Provider'
import HomePage36 from '@rosie/math/components/lesson36/HomePage'
import AppHeader36 from '@rosie/math/components/lesson36/AppHeader'
import Sidebar36 from '@rosie/math/components/lesson36/Sidebar'
import BottomNav36 from '@rosie/math/components/lesson36/BottomNav'
import FilterPanel36 from '@rosie/math/components/lesson36/FilterPanel'
import ProblemList36 from '@rosie/math/components/lesson36/ProblemList'
import ProblemDetail36 from '@rosie/math/components/lesson36/ProblemDetail'
import { PROBLEMS as P37, TAG_STYLE as TS37 } from '@rosie/math/utils/lesson37-data'
import Provider37, { useLesson37 } from '@rosie/math/components/lesson37/Lesson37Provider'
import HomePage37 from '@rosie/math/components/lesson37/HomePage'
import AppHeader37 from '@rosie/math/components/lesson37/AppHeader'
import Sidebar37 from '@rosie/math/components/lesson37/Sidebar'
import BottomNav37 from '@rosie/math/components/lesson37/BottomNav'
import FilterPanel37 from '@rosie/math/components/lesson37/FilterPanel'
import ProblemList37 from '@rosie/math/components/lesson37/ProblemList'
import ProblemDetail37 from '@rosie/math/components/lesson37/ProblemDetail'
import { PROBLEMS as P38, TAG_STYLE as TS38 } from '@rosie/math/utils/lesson38-data'
import Provider38, { useLesson38 } from '@rosie/math/components/lesson38/Lesson38Provider'
import HomePage38 from '@rosie/math/components/lesson38/HomePage'
import AppHeader38 from '@rosie/math/components/lesson38/AppHeader'
import Sidebar38 from '@rosie/math/components/lesson38/Sidebar'
import BottomNav38 from '@rosie/math/components/lesson38/BottomNav'
import FilterPanel38 from '@rosie/math/components/lesson38/FilterPanel'
import ProblemList38 from '@rosie/math/components/lesson38/ProblemList'
import ProblemDetail38 from '@rosie/math/components/lesson38/ProblemDetail'
import { PROBLEMS as P39, TAG_STYLE as TS39 } from '@rosie/math/utils/lesson39-data'
import Provider39, { useLesson39 } from '@rosie/math/components/lesson39/Lesson39Provider'
import HomePage39 from '@rosie/math/components/lesson39/HomePage'
import AppHeader39 from '@rosie/math/components/lesson39/AppHeader'
import Sidebar39 from '@rosie/math/components/lesson39/Sidebar'
import BottomNav39 from '@rosie/math/components/lesson39/BottomNav'
import FilterPanel39 from '@rosie/math/components/lesson39/FilterPanel'
import ProblemList39 from '@rosie/math/components/lesson39/ProblemList'
import ProblemDetail39 from '@rosie/math/components/lesson39/ProblemDetail'
import { PROBLEMS as P40, TAG_STYLE as TS40 } from '@rosie/math/utils/lesson40-data'
import Provider40, { useLesson40 } from '@rosie/math/components/lesson40/Lesson40Provider'
import HomePage40 from '@rosie/math/components/lesson40/HomePage'
import AppHeader40 from '@rosie/math/components/lesson40/AppHeader'
import Sidebar40 from '@rosie/math/components/lesson40/Sidebar'
import BottomNav40 from '@rosie/math/components/lesson40/BottomNav'
import FilterPanel40 from '@rosie/math/components/lesson40/FilterPanel'
import ProblemList40 from '@rosie/math/components/lesson40/ProblemList'
import ProblemDetail40 from '@rosie/math/components/lesson40/ProblemDetail'
import { PROBLEMS as P41, TAG_STYLE as TS41 } from '@rosie/math/utils/lesson41-data'
import Provider41, { useLesson41 } from '@rosie/math/components/lesson41/Lesson41Provider'
import HomePage41 from '@rosie/math/components/lesson41/HomePage'
import AppHeader41 from '@rosie/math/components/lesson41/AppHeader'
import Sidebar41 from '@rosie/math/components/lesson41/Sidebar'
import BottomNav41 from '@rosie/math/components/lesson41/BottomNav'
import FilterPanel41 from '@rosie/math/components/lesson41/FilterPanel'
import ProblemList41 from '@rosie/math/components/lesson41/ProblemList'
import ProblemDetail41 from '@rosie/math/components/lesson41/ProblemDetail'
import { PROBLEMS as P42, TAG_STYLE as TS42 } from '@rosie/math/utils/lesson42-data'
import Provider42, { useLesson42 } from '@rosie/math/components/lesson42/Lesson42Provider'
import HomePage42 from '@rosie/math/components/lesson42/HomePage'
import AppHeader42 from '@rosie/math/components/lesson42/AppHeader'
import Sidebar42 from '@rosie/math/components/lesson42/Sidebar'
import BottomNav42 from '@rosie/math/components/lesson42/BottomNav'
import FilterPanel42 from '@rosie/math/components/lesson42/FilterPanel'
import ProblemList42 from '@rosie/math/components/lesson42/ProblemList'
import ProblemDetail42 from '@rosie/math/components/lesson42/ProblemDetail'
import { PROBLEMS as P43, TAG_STYLE as TS43 } from '@rosie/math/utils/lesson43-data'
import Provider43, { useLesson43 } from '@rosie/math/components/lesson43/Lesson43Provider'
import HomePage43 from '@rosie/math/components/lesson43/HomePage'
import AppHeader43 from '@rosie/math/components/lesson43/AppHeader'
import Sidebar43 from '@rosie/math/components/lesson43/Sidebar'
import BottomNav43 from '@rosie/math/components/lesson43/BottomNav'
import FilterPanel43 from '@rosie/math/components/lesson43/FilterPanel'
import ProblemList43 from '@rosie/math/components/lesson43/ProblemList'
import ProblemDetail43 from '@rosie/math/components/lesson43/ProblemDetail'
import { PROBLEMS as P44, TAG_STYLE as TS44 } from '@rosie/math/utils/lesson44-data'
import Provider44, { useLesson44 } from '@rosie/math/components/lesson44/Lesson44Provider'
import HomePage44 from '@rosie/math/components/lesson44/HomePage'
import AppHeader44 from '@rosie/math/components/lesson44/AppHeader'
import Sidebar44 from '@rosie/math/components/lesson44/Sidebar'
import BottomNav44 from '@rosie/math/components/lesson44/BottomNav'
import FilterPanel44 from '@rosie/math/components/lesson44/FilterPanel'
import ProblemList44 from '@rosie/math/components/lesson44/ProblemList'
import ProblemDetail44 from '@rosie/math/components/lesson44/ProblemDetail'
import { PROBLEMS as P46, TAG_STYLE as TS46 } from '@rosie/math/utils/lesson46-data'
import Provider46, { useLesson46 } from '@rosie/math/components/lesson46/Lesson46Provider'
import HomePage46 from '@rosie/math/components/lesson46/HomePage'
import AppHeader46 from '@rosie/math/components/lesson46/AppHeader'
import Sidebar46 from '@rosie/math/components/lesson46/Sidebar'
import BottomNav46 from '@rosie/math/components/lesson46/BottomNav'
import FilterPanel46 from '@rosie/math/components/lesson46/FilterPanel'
import ProblemList46 from '@rosie/math/components/lesson46/ProblemList'
import ProblemDetail46 from '@rosie/math/components/lesson46/ProblemDetail'
import { PROBLEMS as P47, TAG_STYLE as TS47 } from '@rosie/math/utils/lesson47-data'
import Provider47, { useLesson47 } from '@rosie/math/components/lesson47/Lesson47Provider'
import HomePage47 from '@rosie/math/components/lesson47/HomePage'
import AppHeader47 from '@rosie/math/components/lesson47/AppHeader'
import Sidebar47 from '@rosie/math/components/lesson47/Sidebar'
import BottomNav47 from '@rosie/math/components/lesson47/BottomNav'
import FilterPanel47 from '@rosie/math/components/lesson47/FilterPanel'
import ProblemList47 from '@rosie/math/components/lesson47/ProblemList'
import ProblemDetail47 from '@rosie/math/components/lesson47/ProblemDetail'
import { PROBLEMS as P49, TAG_STYLE as TS49 } from '@rosie/math/utils/lesson49-data'
import Provider49, { useLesson49 } from '@rosie/math/components/lesson49/Lesson49Provider'
import HomePage49 from '@rosie/math/components/lesson49/HomePage'
import AppHeader49 from '@rosie/math/components/lesson49/AppHeader'
import Sidebar49 from '@rosie/math/components/lesson49/Sidebar'
import BottomNav49 from '@rosie/math/components/lesson49/BottomNav'
import FilterPanel49 from '@rosie/math/components/lesson49/FilterPanel'
import ProblemList49 from '@rosie/math/components/lesson49/ProblemList'
import ProblemDetail49 from '@rosie/math/components/lesson49/ProblemDetail'
import { PROBLEMS as P50, TAG_STYLE as TS50 } from '@rosie/math/utils/lesson50-data'
import Provider50, { useLesson50 } from '@rosie/math/components/lesson50/Lesson50Provider'
import HomePage50 from '@rosie/math/components/lesson50/HomePage'
import AppHeader50 from '@rosie/math/components/lesson50/AppHeader'
import Sidebar50 from '@rosie/math/components/lesson50/Sidebar'
import BottomNav50 from '@rosie/math/components/lesson50/BottomNav'
import FilterPanel50 from '@rosie/math/components/lesson50/FilterPanel'
import ProblemList50 from '@rosie/math/components/lesson50/ProblemList'
import ProblemDetail50 from '@rosie/math/components/lesson50/ProblemDetail'
import { PROBLEMS as P51, TAG_STYLE as TS51 } from '@rosie/math/utils/lesson51-data'
import Provider51, { useLesson51 } from '@rosie/math/components/lesson51/Lesson51Provider'
import HomePage51 from '@rosie/math/components/lesson51/HomePage'
import AppHeader51 from '@rosie/math/components/lesson51/AppHeader'
import Sidebar51 from '@rosie/math/components/lesson51/Sidebar'
import BottomNav51 from '@rosie/math/components/lesson51/BottomNav'
import FilterPanel51 from '@rosie/math/components/lesson51/FilterPanel'
import ProblemList51 from '@rosie/math/components/lesson51/ProblemList'
import ProblemDetail51 from '@rosie/math/components/lesson51/ProblemDetail'
import { PROBLEMS as P52, TAG_STYLE as TS52 } from '@rosie/math/utils/lesson52-data'
import Provider52, { useLesson52 } from '@rosie/math/components/lesson52/Lesson52Provider'
import HomePage52 from '@rosie/math/components/lesson52/HomePage'
import AppHeader52 from '@rosie/math/components/lesson52/AppHeader'
import Sidebar52 from '@rosie/math/components/lesson52/Sidebar'
import BottomNav52 from '@rosie/math/components/lesson52/BottomNav'
import FilterPanel52 from '@rosie/math/components/lesson52/FilterPanel'
import ProblemList52 from '@rosie/math/components/lesson52/ProblemList'
import ProblemDetail52 from '@rosie/math/components/lesson52/ProblemDetail'
import { PROBLEMS as P53, TAG_STYLE as TS53 } from '@rosie/math/utils/lesson53-data'
import Provider53, { useLesson53 } from '@rosie/math/components/lesson53/Lesson53Provider'
import HomePage53 from '@rosie/math/components/lesson53/HomePage'
import AppHeader53 from '@rosie/math/components/lesson53/AppHeader'
import Sidebar53 from '@rosie/math/components/lesson53/Sidebar'
import BottomNav53 from '@rosie/math/components/lesson53/BottomNav'
import FilterPanel53 from '@rosie/math/components/lesson53/FilterPanel'
import ProblemList53 from '@rosie/math/components/lesson53/ProblemList'
import ProblemDetail53 from '@rosie/math/components/lesson53/ProblemDetail'
import { PROBLEMS as P55, TAG_STYLE as TS55 } from '@rosie/math/utils/lesson55-data'
import Provider55, { useLesson55 } from '@rosie/math/components/lesson55/Lesson55Provider'
import HomePage55 from '@rosie/math/components/lesson55/HomePage'
import AppHeader55 from '@rosie/math/components/lesson55/AppHeader'
import Sidebar55 from '@rosie/math/components/lesson55/Sidebar'
import BottomNav55 from '@rosie/math/components/lesson55/BottomNav'
import FilterPanel55 from '@rosie/math/components/lesson55/FilterPanel'
import ProblemList55 from '@rosie/math/components/lesson55/ProblemList'
import ProblemDetail55 from '@rosie/math/components/lesson55/ProblemDetail'
import { PROBLEMS as P56, TAG_STYLE as TS56 } from '@rosie/math/utils/lesson56-data'
import Provider56, { useLesson56 } from '@rosie/math/components/lesson56/Lesson56Provider'
import HomePage56 from '@rosie/math/components/lesson56/HomePage'
import AppHeader56 from '@rosie/math/components/lesson56/AppHeader'
import Sidebar56 from '@rosie/math/components/lesson56/Sidebar'
import BottomNav56 from '@rosie/math/components/lesson56/BottomNav'
import FilterPanel56 from '@rosie/math/components/lesson56/FilterPanel'
import ProblemList56 from '@rosie/math/components/lesson56/ProblemList'
import ProblemDetail56 from '@rosie/math/components/lesson56/ProblemDetail'

export type LessonModule = {
  slug: string
  legacyId: string
  PROBLEMS: ProblemSet
  TAG_STYLE: Record<string, string>
  Provider: ComponentType<{ children: ReactNode }>
  useLesson: () => LessonContextType
  HomePage: ComponentType<{ problems: ProblemSet; solveCount: Record<string, number> }>
  AppHeader: ComponentType<{ problems: ProblemSet }>
  Sidebar: ComponentType<{ problems: ProblemSet }>
  BottomNav: ComponentType
  FilterPanel: ComponentType<FilterPanelProps>
  ProblemList: ComponentType<{
    problems: Problem[]
    solveCount: Record<string, number>
    basePath: string
    showSource?: boolean
    sourceLabel?: string
  }>
  ProblemDetail: ComponentType<ProblemDetailComponentProps>
  layoutBgClass: string
  MagicPage?: ComponentType
}

export const LESSON_MODULES: Record<string, LessonModule> = {
  lesson12: {
    slug: 'lesson12',
    legacyId: '12',
    PROBLEMS: P12,
    TAG_STYLE: TS12,
    Provider: Provider12,
    useLesson: useLesson12,
    HomePage: HomePage12,
    AppHeader: AppHeader12,
    Sidebar: Sidebar12,
    BottomNav: BottomNav12,
    FilterPanel: FilterPanel12,
    ProblemList: ProblemList12,
    ProblemDetail: ProblemDetail12,
    layoutBgClass: 'bg-orange-50',
  },
  lesson13: {
    slug: 'lesson13',
    legacyId: '13',
    PROBLEMS: P13,
    TAG_STYLE: TS13,
    Provider: Provider13,
    useLesson: useLesson13,
    HomePage: HomePage13,
    AppHeader: AppHeader13,
    Sidebar: Sidebar13,
    BottomNav: BottomNav13,
    FilterPanel: FilterPanel13,
    ProblemList: ProblemList13,
    ProblemDetail: ProblemDetail13,
    layoutBgClass: 'bg-green-50',
  },
  lesson15: {
    slug: 'lesson15',
    legacyId: '15',
    PROBLEMS: P15,
    TAG_STYLE: TS15,
    Provider: Provider15,
    useLesson: useLesson15,
    HomePage: HomePage15,
    AppHeader: AppHeader15,
    Sidebar: Sidebar15,
    BottomNav: BottomNav15,
    FilterPanel: FilterPanel15,
    ProblemList: ProblemList15,
    ProblemDetail: ProblemDetail15,
    layoutBgClass: 'bg-sky-50',
  },
  lesson18: {
    slug: 'lesson18',
    legacyId: '18',
    PROBLEMS: P18,
    TAG_STYLE: TS18,
    Provider: Provider18,
    useLesson: useLesson18,
    HomePage: HomePage18,
    AppHeader: AppHeader18,
    Sidebar: Sidebar18,
    BottomNav: BottomNav18,
    FilterPanel: FilterPanel18,
    ProblemList: ProblemList18,
    ProblemDetail: ProblemDetail18,
    layoutBgClass: 'bg-purple-50',
  },
  lesson23: {
    slug: 'lesson23',
    legacyId: '23',
    PROBLEMS: P23,
    TAG_STYLE: TS23,
    Provider: Provider23,
    useLesson: useLesson23,
    HomePage: HomePage23,
    AppHeader: AppHeader23,
    Sidebar: Sidebar23,
    BottomNav: BottomNav23,
    FilterPanel: FilterPanel23,
    ProblemList: ProblemList23,
    ProblemDetail: ProblemDetail23,
    layoutBgClass: 'bg-violet-50',
  },
  lesson29: {
    slug: 'lesson29',
    legacyId: '29',
    PROBLEMS: P29,
    TAG_STYLE: TS29,
    Provider: Provider29,
    useLesson: useLesson29,
    HomePage: HomePage29,
    AppHeader: AppHeader29,
    Sidebar: Sidebar29,
    BottomNav: BottomNav29,
    FilterPanel: FilterPanel29,
    ProblemList: ProblemList29,
    ProblemDetail: ProblemDetail29,
    layoutBgClass: 'bg-rose-50',
  },
  lesson30: {
    slug: 'lesson30',
    legacyId: '30',
    PROBLEMS: P30,
    TAG_STYLE: TS30,
    Provider: Provider30,
    useLesson: useLesson30,
    HomePage: HomePage30,
    AppHeader: AppHeader30,
    Sidebar: Sidebar30,
    BottomNav: BottomNav30,
    FilterPanel: FilterPanel30,
    ProblemList: ProblemList30,
    ProblemDetail: ProblemDetail30,
    layoutBgClass: 'bg-amber-50',
  },
  lesson34: {
    slug: 'lesson34',
    legacyId: '34',
    PROBLEMS: P34,
    TAG_STYLE: TS34,
    Provider: Provider34,
    useLesson: useLesson34,
    HomePage: HomePage34,
    AppHeader: AppHeader34,
    Sidebar: Sidebar34,
    BottomNav: BottomNav34,
    FilterPanel: FilterPanel34,
    ProblemList: ProblemList34,
    ProblemDetail: ProblemDetail34,
    layoutBgClass: 'bg-[#fffbeb]',
    MagicPage: Lesson34MagicDemo,
  },
  lesson35: {
    slug: 'lesson35',
    legacyId: '35',
    PROBLEMS: P35,
    TAG_STYLE: TS35,
    Provider: Provider35,
    useLesson: useLesson35,
    HomePage: HomePage35,
    AppHeader: AppHeader35,
    Sidebar: Sidebar35,
    BottomNav: BottomNav35,
    FilterPanel: FilterPanel35,
    ProblemList: ProblemList35,
    ProblemDetail: ProblemDetail35,
    layoutBgClass: 'bg-[#fef9f0]',
  },
  lesson36: {
    slug: 'lesson36',
    legacyId: '36',
    PROBLEMS: P36,
    TAG_STYLE: TS36,
    Provider: Provider36,
    useLesson: useLesson36,
    HomePage: HomePage36,
    AppHeader: AppHeader36,
    Sidebar: Sidebar36,
    BottomNav: BottomNav36,
    FilterPanel: FilterPanel36,
    ProblemList: ProblemList36,
    ProblemDetail: ProblemDetail36,
    layoutBgClass: 'bg-[#f0f7ff]',
    MagicPage: WeekdayMagic,
  },
  lesson37: {
    slug: 'lesson37',
    legacyId: '37',
    PROBLEMS: P37,
    TAG_STYLE: TS37,
    Provider: Provider37,
    useLesson: useLesson37,
    HomePage: HomePage37,
    AppHeader: AppHeader37,
    Sidebar: Sidebar37,
    BottomNav: BottomNav37,
    FilterPanel: FilterPanel37,
    ProblemList: ProblemList37,
    ProblemDetail: ProblemDetail37,
    layoutBgClass: 'bg-[#f0f7ff]',
  },
  lesson38: {
    slug: 'lesson38',
    legacyId: '38',
    PROBLEMS: P38,
    TAG_STYLE: TS38,
    Provider: Provider38,
    useLesson: useLesson38,
    HomePage: HomePage38,
    AppHeader: AppHeader38,
    Sidebar: Sidebar38,
    BottomNav: BottomNav38,
    FilterPanel: FilterPanel38,
    ProblemList: ProblemList38,
    ProblemDetail: ProblemDetail38,
    layoutBgClass: 'bg-[#f5f3ff]',
    MagicPage: YibihaMagicBook,
  },
  lesson39: {
    slug: 'lesson39',
    legacyId: '39',
    PROBLEMS: P39,
    TAG_STYLE: TS39,
    Provider: Provider39,
    useLesson: useLesson39,
    HomePage: HomePage39,
    AppHeader: AppHeader39,
    Sidebar: Sidebar39,
    BottomNav: BottomNav39,
    FilterPanel: FilterPanel39,
    ProblemList: ProblemList39,
    ProblemDetail: ProblemDetail39,
    layoutBgClass: 'bg-[#fffbeb]',
  },
  lesson40: {
    slug: 'lesson40',
    legacyId: '40',
    PROBLEMS: P40,
    TAG_STYLE: TS40,
    Provider: Provider40,
    useLesson: useLesson40,
    HomePage: HomePage40,
    AppHeader: AppHeader40,
    Sidebar: Sidebar40,
    BottomNav: BottomNav40,
    FilterPanel: FilterPanel40,
    ProblemList: ProblemList40,
    ProblemDetail: ProblemDetail40,
    layoutBgClass: 'bg-[#f0fdf4]',
  },
  lesson41: {
    slug: 'lesson41',
    legacyId: '41',
    PROBLEMS: P41,
    TAG_STYLE: TS41,
    Provider: Provider41,
    useLesson: useLesson41,
    HomePage: HomePage41,
    AppHeader: AppHeader41,
    Sidebar: Sidebar41,
    BottomNav: BottomNav41,
    FilterPanel: FilterPanel41,
    ProblemList: ProblemList41,
    ProblemDetail: ProblemDetail41,
    layoutBgClass: 'bg-[#f0f9ff]',
  },
  lesson42: {
    slug: 'lesson42',
    legacyId: '42',
    PROBLEMS: P42,
    TAG_STYLE: TS42,
    Provider: Provider42,
    useLesson: useLesson42,
    HomePage: HomePage42,
    AppHeader: AppHeader42,
    Sidebar: Sidebar42,
    BottomNav: BottomNav42,
    FilterPanel: FilterPanel42,
    ProblemList: ProblemList42,
    ProblemDetail: ProblemDetail42,
    layoutBgClass: 'bg-rose-50',
  },
  lesson43: {
    slug: 'lesson43',
    legacyId: '43',
    PROBLEMS: P43,
    TAG_STYLE: TS43,
    Provider: Provider43,
    useLesson: useLesson43,
    HomePage: HomePage43,
    AppHeader: AppHeader43,
    Sidebar: Sidebar43,
    BottomNav: BottomNav43,
    FilterPanel: FilterPanel43,
    ProblemList: ProblemList43,
    ProblemDetail: ProblemDetail43,
    layoutBgClass: 'bg-cyan-50',
  },
  lesson44: {
    slug: 'lesson44',
    legacyId: '44',
    PROBLEMS: P44,
    TAG_STYLE: TS44,
    Provider: Provider44,
    useLesson: useLesson44,
    HomePage: HomePage44,
    AppHeader: AppHeader44,
    Sidebar: Sidebar44,
    BottomNav: BottomNav44,
    FilterPanel: FilterPanel44,
    ProblemList: ProblemList44,
    ProblemDetail: ProblemDetail44,
    layoutBgClass: 'bg-indigo-50',
  },
  lesson46: {
    slug: 'lesson46',
    legacyId: '46',
    PROBLEMS: P46,
    TAG_STYLE: TS46,
    Provider: Provider46,
    useLesson: useLesson46,
    HomePage: HomePage46,
    AppHeader: AppHeader46,
    Sidebar: Sidebar46,
    BottomNav: BottomNav46,
    FilterPanel: FilterPanel46,
    ProblemList: ProblemList46,
    ProblemDetail: ProblemDetail46,
    layoutBgClass: 'bg-[#f0fdfa]',
  },
  lesson47: {
    slug: 'lesson47',
    legacyId: '47',
    PROBLEMS: P47,
    TAG_STYLE: TS47,
    Provider: Provider47,
    useLesson: useLesson47,
    HomePage: HomePage47,
    AppHeader: AppHeader47,
    Sidebar: Sidebar47,
    BottomNav: BottomNav47,
    FilterPanel: FilterPanel47,
    ProblemList: ProblemList47,
    ProblemDetail: ProblemDetail47,
    layoutBgClass: 'bg-[#fdf4ff]',
  },
  lesson49: {
    slug: 'lesson49',
    legacyId: '49',
    PROBLEMS: P49,
    TAG_STYLE: TS49,
    Provider: Provider49,
    useLesson: useLesson49,
    HomePage: HomePage49,
    AppHeader: AppHeader49,
    Sidebar: Sidebar49,
    BottomNav: BottomNav49,
    FilterPanel: FilterPanel49,
    ProblemList: ProblemList49,
    ProblemDetail: ProblemDetail49,
    layoutBgClass: 'bg-[#eef2ff]',
  },
  lesson50: {
    slug: 'lesson50',
    legacyId: '50',
    PROBLEMS: P50,
    TAG_STYLE: TS50,
    Provider: Provider50,
    useLesson: useLesson50,
    HomePage: HomePage50,
    AppHeader: AppHeader50,
    Sidebar: Sidebar50,
    BottomNav: BottomNav50,
    FilterPanel: FilterPanel50,
    ProblemList: ProblemList50,
    ProblemDetail: ProblemDetail50,
    layoutBgClass: 'bg-[#f0fdfa]',
  },
  lesson51: {
    slug: 'lesson51',
    legacyId: '51',
    PROBLEMS: P51,
    TAG_STYLE: TS51,
    Provider: Provider51,
    useLesson: useLesson51,
    HomePage: HomePage51,
    AppHeader: AppHeader51,
    Sidebar: Sidebar51,
    BottomNav: BottomNav51,
    FilterPanel: FilterPanel51,
    ProblemList: ProblemList51,
    ProblemDetail: ProblemDetail51,
    layoutBgClass: 'bg-[#ecfdf5]',
  },
  lesson52: {
    slug: 'lesson52',
    legacyId: '52',
    PROBLEMS: P52,
    TAG_STYLE: TS52,
    Provider: Provider52,
    useLesson: useLesson52,
    HomePage: HomePage52,
    AppHeader: AppHeader52,
    Sidebar: Sidebar52,
    BottomNav: BottomNav52,
    FilterPanel: FilterPanel52,
    ProblemList: ProblemList52,
    ProblemDetail: ProblemDetail52,
    layoutBgClass: 'bg-[#f0f9ff]',
  },
  lesson53: {
    slug: 'lesson53',
    legacyId: '53',
    PROBLEMS: P53,
    TAG_STYLE: TS53,
    Provider: Provider53,
    useLesson: useLesson53,
    HomePage: HomePage53,
    AppHeader: AppHeader53,
    Sidebar: Sidebar53,
    BottomNav: BottomNav53,
    FilterPanel: FilterPanel53,
    ProblemList: ProblemList53,
    ProblemDetail: ProblemDetail53,
    layoutBgClass: 'bg-[#f0f9ff]',
  },
  lesson55: {
    slug: 'lesson55',
    legacyId: '55',
    PROBLEMS: P55,
    TAG_STYLE: TS55,
    Provider: Provider55,
    useLesson: useLesson55,
    HomePage: HomePage55,
    AppHeader: AppHeader55,
    Sidebar: Sidebar55,
    BottomNav: BottomNav55,
    FilterPanel: FilterPanel55,
    ProblemList: ProblemList55,
    ProblemDetail: ProblemDetail55,
    layoutBgClass: 'bg-[#f0fdfa]',
  },
  lesson56: {
    slug: 'lesson56',
    legacyId: '56',
    PROBLEMS: P56,
    TAG_STYLE: TS56,
    Provider: Provider56,
    useLesson: useLesson56,
    HomePage: HomePage56,
    AppHeader: AppHeader56,
    Sidebar: Sidebar56,
    BottomNav: BottomNav56,
    FilterPanel: FilterPanel56,
    ProblemList: ProblemList56,
    ProblemDetail: ProblemDetail56,
    layoutBgClass: 'bg-[#f0f9ff]',
  },
}

export function lessonModuleBySlug(slug: string): LessonModule | undefined {
  return LESSON_MODULES[slug]
}
