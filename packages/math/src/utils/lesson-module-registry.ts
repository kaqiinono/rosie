'use client'

import type { ComponentType, ReactNode } from 'react'
import type { Problem, ProblemSet } from '@rosie/core'
import type { LessonContextType } from '@rosie/math/components/shared/createLessonProvider'
import type { ProblemDetailComponentProps } from '@rosie/math/components/shared/LessonProblemRoutePage'
import type { FilterPanelProps } from '@rosie/math/components/shared/FilterPanel'
import WeekdayMagic from '@rosie/math/components/lesson/g1/lesson36/WeekdayMagic'
import YibihaMagicBook from '@rosie/math/components/lesson/g1/lesson38/YibihaMagicBook'
import Lesson34MagicDemo from '@rosie/math/components/lesson/g1/lesson34/Lesson34MagicDemo'
import { PROBLEMS as G1Lesson12PROBLEMS, TAG_STYLE as G1Lesson12TAG_STYLE } from '@rosie/math/utils/g1/lesson12-data'
import G1Lesson12Provider, { useG1Lesson12 } from '@rosie/math/components/lesson/g1/lesson12/G1Lesson12Provider'
import G1Lesson12HomePage from '@rosie/math/components/lesson/g1/lesson12/HomePage'
import G1Lesson12AppHeader from '@rosie/math/components/lesson/g1/lesson12/AppHeader'
import G1Lesson12Sidebar from '@rosie/math/components/lesson/g1/lesson12/Sidebar'
import G1Lesson12BottomNav from '@rosie/math/components/lesson/g1/lesson12/BottomNav'
import G1Lesson12FilterPanel from '@rosie/math/components/lesson/g1/lesson12/FilterPanel'
import G1Lesson12ProblemList from '@rosie/math/components/lesson/g1/lesson12/ProblemList'
import G1Lesson12ProblemDetail from '@rosie/math/components/lesson/g1/lesson12/ProblemDetail'
import { PROBLEMS as G1Lesson13PROBLEMS, TAG_STYLE as G1Lesson13TAG_STYLE } from '@rosie/math/utils/g1/lesson13-data'
import G1Lesson13Provider, { useG1Lesson13 } from '@rosie/math/components/lesson/g1/lesson13/G1Lesson13Provider'
import G1Lesson13HomePage from '@rosie/math/components/lesson/g1/lesson13/HomePage'
import G1Lesson13AppHeader from '@rosie/math/components/lesson/g1/lesson13/AppHeader'
import G1Lesson13Sidebar from '@rosie/math/components/lesson/g1/lesson13/Sidebar'
import G1Lesson13BottomNav from '@rosie/math/components/lesson/g1/lesson13/BottomNav'
import G1Lesson13FilterPanel from '@rosie/math/components/lesson/g1/lesson13/FilterPanel'
import G1Lesson13ProblemList from '@rosie/math/components/lesson/g1/lesson13/ProblemList'
import G1Lesson13ProblemDetail from '@rosie/math/components/lesson/g1/lesson13/ProblemDetail'
import { PROBLEMS as G1Lesson15PROBLEMS, TAG_STYLE as G1Lesson15TAG_STYLE } from '@rosie/math/utils/g1/lesson15-data'
import G1Lesson15Provider, { useG1Lesson15 } from '@rosie/math/components/lesson/g1/lesson15/G1Lesson15Provider'
import G1Lesson15HomePage from '@rosie/math/components/lesson/g1/lesson15/HomePage'
import G1Lesson15AppHeader from '@rosie/math/components/lesson/g1/lesson15/AppHeader'
import G1Lesson15Sidebar from '@rosie/math/components/lesson/g1/lesson15/Sidebar'
import G1Lesson15BottomNav from '@rosie/math/components/lesson/g1/lesson15/BottomNav'
import G1Lesson15FilterPanel from '@rosie/math/components/lesson/g1/lesson15/FilterPanel'
import G1Lesson15ProblemList from '@rosie/math/components/lesson/g1/lesson15/ProblemList'
import G1Lesson15ProblemDetail from '@rosie/math/components/lesson/g1/lesson15/ProblemDetail'
import { PROBLEMS as G1Lesson18PROBLEMS, TAG_STYLE as G1Lesson18TAG_STYLE } from '@rosie/math/utils/g1/lesson18-data'
import G1Lesson18Provider, { useG1Lesson18 } from '@rosie/math/components/lesson/g1/lesson18/G1Lesson18Provider'
import G1Lesson18HomePage from '@rosie/math/components/lesson/g1/lesson18/HomePage'
import G1Lesson18AppHeader from '@rosie/math/components/lesson/g1/lesson18/AppHeader'
import G1Lesson18Sidebar from '@rosie/math/components/lesson/g1/lesson18/Sidebar'
import G1Lesson18BottomNav from '@rosie/math/components/lesson/g1/lesson18/BottomNav'
import G1Lesson18FilterPanel from '@rosie/math/components/lesson/g1/lesson18/FilterPanel'
import G1Lesson18ProblemList from '@rosie/math/components/lesson/g1/lesson18/ProblemList'
import G1Lesson18ProblemDetail from '@rosie/math/components/lesson/g1/lesson18/ProblemDetail'
import { PROBLEMS as G1Lesson23PROBLEMS, TAG_STYLE as G1Lesson23TAG_STYLE } from '@rosie/math/utils/g1/lesson23-data'
import G1Lesson23Provider, { useG1Lesson23 } from '@rosie/math/components/lesson/g1/lesson23/G1Lesson23Provider'
import G1Lesson23HomePage from '@rosie/math/components/lesson/g1/lesson23/HomePage'
import G1Lesson23AppHeader from '@rosie/math/components/lesson/g1/lesson23/AppHeader'
import G1Lesson23Sidebar from '@rosie/math/components/lesson/g1/lesson23/Sidebar'
import G1Lesson23BottomNav from '@rosie/math/components/lesson/g1/lesson23/BottomNav'
import G1Lesson23FilterPanel from '@rosie/math/components/lesson/g1/lesson23/FilterPanel'
import G1Lesson23ProblemList from '@rosie/math/components/lesson/g1/lesson23/ProblemList'
import G1Lesson23ProblemDetail from '@rosie/math/components/lesson/g1/lesson23/ProblemDetail'
import { PROBLEMS as G1Lesson29PROBLEMS, TAG_STYLE as G1Lesson29TAG_STYLE } from '@rosie/math/utils/g1/lesson29-data'
import G1Lesson29Provider, { useG1Lesson29 } from '@rosie/math/components/lesson/g1/lesson29/G1Lesson29Provider'
import G1Lesson29HomePage from '@rosie/math/components/lesson/g1/lesson29/HomePage'
import G1Lesson29AppHeader from '@rosie/math/components/lesson/g1/lesson29/AppHeader'
import G1Lesson29Sidebar from '@rosie/math/components/lesson/g1/lesson29/Sidebar'
import G1Lesson29BottomNav from '@rosie/math/components/lesson/g1/lesson29/BottomNav'
import G1Lesson29FilterPanel from '@rosie/math/components/lesson/g1/lesson29/FilterPanel'
import G1Lesson29ProblemList from '@rosie/math/components/lesson/g1/lesson29/ProblemList'
import G1Lesson29ProblemDetail from '@rosie/math/components/lesson/g1/lesson29/ProblemDetail'
import { PROBLEMS as G1Lesson30PROBLEMS, TAG_STYLE as G1Lesson30TAG_STYLE } from '@rosie/math/utils/g1/lesson30-data'
import G1Lesson30Provider, { useG1Lesson30 } from '@rosie/math/components/lesson/g1/lesson30/G1Lesson30Provider'
import G1Lesson30HomePage from '@rosie/math/components/lesson/g1/lesson30/HomePage'
import G1Lesson30AppHeader from '@rosie/math/components/lesson/g1/lesson30/AppHeader'
import G1Lesson30Sidebar from '@rosie/math/components/lesson/g1/lesson30/Sidebar'
import G1Lesson30BottomNav from '@rosie/math/components/lesson/g1/lesson30/BottomNav'
import G1Lesson30FilterPanel from '@rosie/math/components/lesson/g1/lesson30/FilterPanel'
import G1Lesson30ProblemList from '@rosie/math/components/lesson/g1/lesson30/ProblemList'
import G1Lesson30ProblemDetail from '@rosie/math/components/lesson/g1/lesson30/ProblemDetail'
import { PROBLEMS as G1Lesson34PROBLEMS, TAG_STYLE as G1Lesson34TAG_STYLE } from '@rosie/math/utils/g1/lesson34-data'
import G1Lesson34Provider, { useG1Lesson34 } from '@rosie/math/components/lesson/g1/lesson34/G1Lesson34Provider'
import G1Lesson34HomePage from '@rosie/math/components/lesson/g1/lesson34/HomePage'
import G1Lesson34AppHeader from '@rosie/math/components/lesson/g1/lesson34/AppHeader'
import G1Lesson34Sidebar from '@rosie/math/components/lesson/g1/lesson34/Sidebar'
import G1Lesson34BottomNav from '@rosie/math/components/lesson/g1/lesson34/BottomNav'
import G1Lesson34FilterPanel from '@rosie/math/components/lesson/g1/lesson34/FilterPanel'
import G1Lesson34ProblemList from '@rosie/math/components/lesson/g1/lesson34/ProblemList'
import G1Lesson34ProblemDetail from '@rosie/math/components/lesson/g1/lesson34/ProblemDetail'
import { PROBLEMS as G1Lesson35PROBLEMS, TAG_STYLE as G1Lesson35TAG_STYLE } from '@rosie/math/utils/g1/lesson35-data'
import G1Lesson35Provider, { useG1Lesson35 } from '@rosie/math/components/lesson/g1/lesson35/G1Lesson35Provider'
import G1Lesson35HomePage from '@rosie/math/components/lesson/g1/lesson35/HomePage'
import G1Lesson35AppHeader from '@rosie/math/components/lesson/g1/lesson35/AppHeader'
import G1Lesson35Sidebar from '@rosie/math/components/lesson/g1/lesson35/Sidebar'
import G1Lesson35BottomNav from '@rosie/math/components/lesson/g1/lesson35/BottomNav'
import G1Lesson35FilterPanel from '@rosie/math/components/lesson/g1/lesson35/FilterPanel'
import G1Lesson35ProblemList from '@rosie/math/components/lesson/g1/lesson35/ProblemList'
import G1Lesson35ProblemDetail from '@rosie/math/components/lesson/g1/lesson35/ProblemDetail'
import { PROBLEMS as G1Lesson36PROBLEMS, TAG_STYLE as G1Lesson36TAG_STYLE } from '@rosie/math/utils/g1/lesson36-data'
import G1Lesson36Provider, { useG1Lesson36 } from '@rosie/math/components/lesson/g1/lesson36/G1Lesson36Provider'
import G1Lesson36HomePage from '@rosie/math/components/lesson/g1/lesson36/HomePage'
import G1Lesson36AppHeader from '@rosie/math/components/lesson/g1/lesson36/AppHeader'
import G1Lesson36Sidebar from '@rosie/math/components/lesson/g1/lesson36/Sidebar'
import G1Lesson36BottomNav from '@rosie/math/components/lesson/g1/lesson36/BottomNav'
import G1Lesson36FilterPanel from '@rosie/math/components/lesson/g1/lesson36/FilterPanel'
import G1Lesson36ProblemList from '@rosie/math/components/lesson/g1/lesson36/ProblemList'
import G1Lesson36ProblemDetail from '@rosie/math/components/lesson/g1/lesson36/ProblemDetail'
import { PROBLEMS as G1Lesson37PROBLEMS, TAG_STYLE as G1Lesson37TAG_STYLE } from '@rosie/math/utils/g1/lesson37-data'
import G1Lesson37Provider, { useG1Lesson37 } from '@rosie/math/components/lesson/g1/lesson37/G1Lesson37Provider'
import G1Lesson37HomePage from '@rosie/math/components/lesson/g1/lesson37/HomePage'
import G1Lesson37AppHeader from '@rosie/math/components/lesson/g1/lesson37/AppHeader'
import G1Lesson37Sidebar from '@rosie/math/components/lesson/g1/lesson37/Sidebar'
import G1Lesson37BottomNav from '@rosie/math/components/lesson/g1/lesson37/BottomNav'
import G1Lesson37FilterPanel from '@rosie/math/components/lesson/g1/lesson37/FilterPanel'
import G1Lesson37ProblemList from '@rosie/math/components/lesson/g1/lesson37/ProblemList'
import G1Lesson37ProblemDetail from '@rosie/math/components/lesson/g1/lesson37/ProblemDetail'
import { PROBLEMS as G1Lesson38PROBLEMS, TAG_STYLE as G1Lesson38TAG_STYLE } from '@rosie/math/utils/g1/lesson38-data'
import G1Lesson38Provider, { useG1Lesson38 } from '@rosie/math/components/lesson/g1/lesson38/G1Lesson38Provider'
import G1Lesson38HomePage from '@rosie/math/components/lesson/g1/lesson38/HomePage'
import G1Lesson38AppHeader from '@rosie/math/components/lesson/g1/lesson38/AppHeader'
import G1Lesson38Sidebar from '@rosie/math/components/lesson/g1/lesson38/Sidebar'
import G1Lesson38BottomNav from '@rosie/math/components/lesson/g1/lesson38/BottomNav'
import G1Lesson38FilterPanel from '@rosie/math/components/lesson/g1/lesson38/FilterPanel'
import G1Lesson38ProblemList from '@rosie/math/components/lesson/g1/lesson38/ProblemList'
import G1Lesson38ProblemDetail from '@rosie/math/components/lesson/g1/lesson38/ProblemDetail'
import { PROBLEMS as G1Lesson39PROBLEMS, TAG_STYLE as G1Lesson39TAG_STYLE } from '@rosie/math/utils/g1/lesson39-data'
import G1Lesson39Provider, { useG1Lesson39 } from '@rosie/math/components/lesson/g1/lesson39/G1Lesson39Provider'
import G1Lesson39HomePage from '@rosie/math/components/lesson/g1/lesson39/HomePage'
import G1Lesson39AppHeader from '@rosie/math/components/lesson/g1/lesson39/AppHeader'
import G1Lesson39Sidebar from '@rosie/math/components/lesson/g1/lesson39/Sidebar'
import G1Lesson39BottomNav from '@rosie/math/components/lesson/g1/lesson39/BottomNav'
import G1Lesson39FilterPanel from '@rosie/math/components/lesson/g1/lesson39/FilterPanel'
import G1Lesson39ProblemList from '@rosie/math/components/lesson/g1/lesson39/ProblemList'
import G1Lesson39ProblemDetail from '@rosie/math/components/lesson/g1/lesson39/ProblemDetail'
import { PROBLEMS as G1Lesson40PROBLEMS, TAG_STYLE as G1Lesson40TAG_STYLE } from '@rosie/math/utils/g1/lesson40-data'
import G1Lesson40Provider, { useG1Lesson40 } from '@rosie/math/components/lesson/g1/lesson40/G1Lesson40Provider'
import G1Lesson40HomePage from '@rosie/math/components/lesson/g1/lesson40/HomePage'
import G1Lesson40AppHeader from '@rosie/math/components/lesson/g1/lesson40/AppHeader'
import G1Lesson40Sidebar from '@rosie/math/components/lesson/g1/lesson40/Sidebar'
import G1Lesson40BottomNav from '@rosie/math/components/lesson/g1/lesson40/BottomNav'
import G1Lesson40FilterPanel from '@rosie/math/components/lesson/g1/lesson40/FilterPanel'
import G1Lesson40ProblemList from '@rosie/math/components/lesson/g1/lesson40/ProblemList'
import G1Lesson40ProblemDetail from '@rosie/math/components/lesson/g1/lesson40/ProblemDetail'
import { PROBLEMS as G1Lesson41PROBLEMS, TAG_STYLE as G1Lesson41TAG_STYLE } from '@rosie/math/utils/g1/lesson41-data'
import G1Lesson41Provider, { useG1Lesson41 } from '@rosie/math/components/lesson/g1/lesson41/G1Lesson41Provider'
import G1Lesson41HomePage from '@rosie/math/components/lesson/g1/lesson41/HomePage'
import G1Lesson41AppHeader from '@rosie/math/components/lesson/g1/lesson41/AppHeader'
import G1Lesson41Sidebar from '@rosie/math/components/lesson/g1/lesson41/Sidebar'
import G1Lesson41BottomNav from '@rosie/math/components/lesson/g1/lesson41/BottomNav'
import G1Lesson41FilterPanel from '@rosie/math/components/lesson/g1/lesson41/FilterPanel'
import G1Lesson41ProblemList from '@rosie/math/components/lesson/g1/lesson41/ProblemList'
import G1Lesson41ProblemDetail from '@rosie/math/components/lesson/g1/lesson41/ProblemDetail'
import { PROBLEMS as G1Lesson42PROBLEMS, TAG_STYLE as G1Lesson42TAG_STYLE } from '@rosie/math/utils/g1/lesson42-data'
import G1Lesson42Provider, { useG1Lesson42 } from '@rosie/math/components/lesson/g1/lesson42/G1Lesson42Provider'
import G1Lesson42HomePage from '@rosie/math/components/lesson/g1/lesson42/HomePage'
import G1Lesson42AppHeader from '@rosie/math/components/lesson/g1/lesson42/AppHeader'
import G1Lesson42Sidebar from '@rosie/math/components/lesson/g1/lesson42/Sidebar'
import G1Lesson42BottomNav from '@rosie/math/components/lesson/g1/lesson42/BottomNav'
import G1Lesson42FilterPanel from '@rosie/math/components/lesson/g1/lesson42/FilterPanel'
import G1Lesson42ProblemList from '@rosie/math/components/lesson/g1/lesson42/ProblemList'
import G1Lesson42ProblemDetail from '@rosie/math/components/lesson/g1/lesson42/ProblemDetail'
import { PROBLEMS as G1Lesson43PROBLEMS, TAG_STYLE as G1Lesson43TAG_STYLE } from '@rosie/math/utils/g1/lesson43-data'
import G1Lesson43Provider, { useG1Lesson43 } from '@rosie/math/components/lesson/g1/lesson43/G1Lesson43Provider'
import G1Lesson43HomePage from '@rosie/math/components/lesson/g1/lesson43/HomePage'
import G1Lesson43AppHeader from '@rosie/math/components/lesson/g1/lesson43/AppHeader'
import G1Lesson43Sidebar from '@rosie/math/components/lesson/g1/lesson43/Sidebar'
import G1Lesson43BottomNav from '@rosie/math/components/lesson/g1/lesson43/BottomNav'
import G1Lesson43FilterPanel from '@rosie/math/components/lesson/g1/lesson43/FilterPanel'
import G1Lesson43ProblemList from '@rosie/math/components/lesson/g1/lesson43/ProblemList'
import G1Lesson43ProblemDetail from '@rosie/math/components/lesson/g1/lesson43/ProblemDetail'
import { PROBLEMS as G1Lesson44PROBLEMS, TAG_STYLE as G1Lesson44TAG_STYLE } from '@rosie/math/utils/g1/lesson44-data'
import G1Lesson44Provider, { useG1Lesson44 } from '@rosie/math/components/lesson/g1/lesson44/G1Lesson44Provider'
import G1Lesson44HomePage from '@rosie/math/components/lesson/g1/lesson44/HomePage'
import G1Lesson44AppHeader from '@rosie/math/components/lesson/g1/lesson44/AppHeader'
import G1Lesson44Sidebar from '@rosie/math/components/lesson/g1/lesson44/Sidebar'
import G1Lesson44BottomNav from '@rosie/math/components/lesson/g1/lesson44/BottomNav'
import G1Lesson44FilterPanel from '@rosie/math/components/lesson/g1/lesson44/FilterPanel'
import G1Lesson44ProblemList from '@rosie/math/components/lesson/g1/lesson44/ProblemList'
import G1Lesson44ProblemDetail from '@rosie/math/components/lesson/g1/lesson44/ProblemDetail'
import { PROBLEMS as G1Lesson46PROBLEMS, TAG_STYLE as G1Lesson46TAG_STYLE } from '@rosie/math/utils/g1/lesson46-data'
import G1Lesson46Provider, { useG1Lesson46 } from '@rosie/math/components/lesson/g1/lesson46/G1Lesson46Provider'
import G1Lesson46HomePage from '@rosie/math/components/lesson/g1/lesson46/HomePage'
import G1Lesson46AppHeader from '@rosie/math/components/lesson/g1/lesson46/AppHeader'
import G1Lesson46Sidebar from '@rosie/math/components/lesson/g1/lesson46/Sidebar'
import G1Lesson46BottomNav from '@rosie/math/components/lesson/g1/lesson46/BottomNav'
import G1Lesson46FilterPanel from '@rosie/math/components/lesson/g1/lesson46/FilterPanel'
import G1Lesson46ProblemList from '@rosie/math/components/lesson/g1/lesson46/ProblemList'
import G1Lesson46ProblemDetail from '@rosie/math/components/lesson/g1/lesson46/ProblemDetail'
import { PROBLEMS as G1Lesson47PROBLEMS, TAG_STYLE as G1Lesson47TAG_STYLE } from '@rosie/math/utils/g1/lesson47-data'
import G1Lesson47Provider, { useG1Lesson47 } from '@rosie/math/components/lesson/g1/lesson47/G1Lesson47Provider'
import G1Lesson47HomePage from '@rosie/math/components/lesson/g1/lesson47/HomePage'
import G1Lesson47AppHeader from '@rosie/math/components/lesson/g1/lesson47/AppHeader'
import G1Lesson47Sidebar from '@rosie/math/components/lesson/g1/lesson47/Sidebar'
import G1Lesson47BottomNav from '@rosie/math/components/lesson/g1/lesson47/BottomNav'
import G1Lesson47FilterPanel from '@rosie/math/components/lesson/g1/lesson47/FilterPanel'
import G1Lesson47ProblemList from '@rosie/math/components/lesson/g1/lesson47/ProblemList'
import G1Lesson47ProblemDetail from '@rosie/math/components/lesson/g1/lesson47/ProblemDetail'
import { PROBLEMS as G2Lesson1PROBLEMS, TAG_STYLE as G2Lesson1TAG_STYLE } from '@rosie/math/utils/g2/lesson1-data'
import G2Lesson1Provider, { useG2Lesson1 } from '@rosie/math/components/lesson/g2/lesson1/G2Lesson1Provider'
import G2Lesson1HomePage from '@rosie/math/components/lesson/g2/lesson1/HomePage'
import G2Lesson1AppHeader from '@rosie/math/components/lesson/g2/lesson1/AppHeader'
import G2Lesson1Sidebar from '@rosie/math/components/lesson/g2/lesson1/Sidebar'
import G2Lesson1BottomNav from '@rosie/math/components/lesson/g2/lesson1/BottomNav'
import G2Lesson1FilterPanel from '@rosie/math/components/lesson/g2/lesson1/FilterPanel'
import G2Lesson1ProblemList from '@rosie/math/components/lesson/g2/lesson1/ProblemList'
import G2Lesson1ProblemDetail from '@rosie/math/components/lesson/g2/lesson1/ProblemDetail'
import { PROBLEMS as G2Lesson2PROBLEMS, TAG_STYLE as G2Lesson2TAG_STYLE } from '@rosie/math/utils/g2/lesson2-data'
import G2Lesson2Provider, { useG2Lesson2 } from '@rosie/math/components/lesson/g2/lesson2/G2Lesson2Provider'
import G2Lesson2HomePage from '@rosie/math/components/lesson/g2/lesson2/HomePage'
import G2Lesson2AppHeader from '@rosie/math/components/lesson/g2/lesson2/AppHeader'
import G2Lesson2Sidebar from '@rosie/math/components/lesson/g2/lesson2/Sidebar'
import G2Lesson2BottomNav from '@rosie/math/components/lesson/g2/lesson2/BottomNav'
import G2Lesson2FilterPanel from '@rosie/math/components/lesson/g2/lesson2/FilterPanel'
import G2Lesson2ProblemList from '@rosie/math/components/lesson/g2/lesson2/ProblemList'
import G2Lesson2ProblemDetail from '@rosie/math/components/lesson/g2/lesson2/ProblemDetail'
import { PROBLEMS as G2Lesson3PROBLEMS, TAG_STYLE as G2Lesson3TAG_STYLE } from '@rosie/math/utils/g2/lesson3-data'
import G2Lesson3Provider, { useG2Lesson3 } from '@rosie/math/components/lesson/g2/lesson3/G2Lesson3Provider'
import G2Lesson3HomePage from '@rosie/math/components/lesson/g2/lesson3/HomePage'
import G2Lesson3AppHeader from '@rosie/math/components/lesson/g2/lesson3/AppHeader'
import G2Lesson3Sidebar from '@rosie/math/components/lesson/g2/lesson3/Sidebar'
import G2Lesson3BottomNav from '@rosie/math/components/lesson/g2/lesson3/BottomNav'
import G2Lesson3FilterPanel from '@rosie/math/components/lesson/g2/lesson3/FilterPanel'
import G2Lesson3ProblemList from '@rosie/math/components/lesson/g2/lesson3/ProblemList'
import G2Lesson3ProblemDetail from '@rosie/math/components/lesson/g2/lesson3/ProblemDetail'
import { PROBLEMS as G2Lesson4PROBLEMS, TAG_STYLE as G2Lesson4TAG_STYLE } from '@rosie/math/utils/g2/lesson4-data'
import G2Lesson4Provider, { useG2Lesson4 } from '@rosie/math/components/lesson/g2/lesson4/G2Lesson4Provider'
import G2Lesson4HomePage from '@rosie/math/components/lesson/g2/lesson4/HomePage'
import G2Lesson4AppHeader from '@rosie/math/components/lesson/g2/lesson4/AppHeader'
import G2Lesson4Sidebar from '@rosie/math/components/lesson/g2/lesson4/Sidebar'
import G2Lesson4BottomNav from '@rosie/math/components/lesson/g2/lesson4/BottomNav'
import G2Lesson4FilterPanel from '@rosie/math/components/lesson/g2/lesson4/FilterPanel'
import G2Lesson4ProblemList from '@rosie/math/components/lesson/g2/lesson4/ProblemList'
import G2Lesson4ProblemDetail from '@rosie/math/components/lesson/g2/lesson4/ProblemDetail'
import { PROBLEMS as G2Lesson5PROBLEMS, TAG_STYLE as G2Lesson5TAG_STYLE } from '@rosie/math/utils/g2/lesson5-data'
import G2Lesson5Provider, { useG2Lesson5 } from '@rosie/math/components/lesson/g2/lesson5/G2Lesson5Provider'
import G2Lesson5HomePage from '@rosie/math/components/lesson/g2/lesson5/HomePage'
import G2Lesson5AppHeader from '@rosie/math/components/lesson/g2/lesson5/AppHeader'
import G2Lesson5Sidebar from '@rosie/math/components/lesson/g2/lesson5/Sidebar'
import G2Lesson5BottomNav from '@rosie/math/components/lesson/g2/lesson5/BottomNav'
import G2Lesson5FilterPanel from '@rosie/math/components/lesson/g2/lesson5/FilterPanel'
import G2Lesson5ProblemList from '@rosie/math/components/lesson/g2/lesson5/ProblemList'
import G2Lesson5ProblemDetail from '@rosie/math/components/lesson/g2/lesson5/ProblemDetail'
import { PROBLEMS as G2Lesson6PROBLEMS, TAG_STYLE as G2Lesson6TAG_STYLE } from '@rosie/math/utils/g2/lesson6-data'
import G2Lesson6Provider, { useG2Lesson6 } from '@rosie/math/components/lesson/g2/lesson6/G2Lesson6Provider'
import G2Lesson6HomePage from '@rosie/math/components/lesson/g2/lesson6/HomePage'
import G2Lesson6AppHeader from '@rosie/math/components/lesson/g2/lesson6/AppHeader'
import G2Lesson6Sidebar from '@rosie/math/components/lesson/g2/lesson6/Sidebar'
import G2Lesson6BottomNav from '@rosie/math/components/lesson/g2/lesson6/BottomNav'
import G2Lesson6FilterPanel from '@rosie/math/components/lesson/g2/lesson6/FilterPanel'
import G2Lesson6ProblemList from '@rosie/math/components/lesson/g2/lesson6/ProblemList'
import G2Lesson6ProblemDetail from '@rosie/math/components/lesson/g2/lesson6/ProblemDetail'
import { PROBLEMS as G2Lesson7PROBLEMS, TAG_STYLE as G2Lesson7TAG_STYLE } from '@rosie/math/utils/g2/lesson7-data'
import G2Lesson7Provider, { useG2Lesson7 } from '@rosie/math/components/lesson/g2/lesson7/G2Lesson7Provider'
import G2Lesson7HomePage from '@rosie/math/components/lesson/g2/lesson7/HomePage'
import G2Lesson7AppHeader from '@rosie/math/components/lesson/g2/lesson7/AppHeader'
import G2Lesson7Sidebar from '@rosie/math/components/lesson/g2/lesson7/Sidebar'
import G2Lesson7BottomNav from '@rosie/math/components/lesson/g2/lesson7/BottomNav'
import G2Lesson7FilterPanel from '@rosie/math/components/lesson/g2/lesson7/FilterPanel'
import G2Lesson7ProblemList from '@rosie/math/components/lesson/g2/lesson7/ProblemList'
import G2Lesson7ProblemDetail from '@rosie/math/components/lesson/g2/lesson7/ProblemDetail'

export type LessonModule = {
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
  '1-12': {
    PROBLEMS: G1Lesson12PROBLEMS,
    TAG_STYLE: G1Lesson12TAG_STYLE,
    Provider: G1Lesson12Provider,
    useLesson: useG1Lesson12,
    HomePage: G1Lesson12HomePage,
    AppHeader: G1Lesson12AppHeader,
    Sidebar: G1Lesson12Sidebar,
    BottomNav: G1Lesson12BottomNav,
    FilterPanel: G1Lesson12FilterPanel,
    ProblemList: G1Lesson12ProblemList,
    ProblemDetail: G1Lesson12ProblemDetail,
    layoutBgClass: 'bg-orange-50',
  },
  '1-13': {
    PROBLEMS: G1Lesson13PROBLEMS,
    TAG_STYLE: G1Lesson13TAG_STYLE,
    Provider: G1Lesson13Provider,
    useLesson: useG1Lesson13,
    HomePage: G1Lesson13HomePage,
    AppHeader: G1Lesson13AppHeader,
    Sidebar: G1Lesson13Sidebar,
    BottomNav: G1Lesson13BottomNav,
    FilterPanel: G1Lesson13FilterPanel,
    ProblemList: G1Lesson13ProblemList,
    ProblemDetail: G1Lesson13ProblemDetail,
    layoutBgClass: 'bg-green-50',
  },
  '1-15': {
    PROBLEMS: G1Lesson15PROBLEMS,
    TAG_STYLE: G1Lesson15TAG_STYLE,
    Provider: G1Lesson15Provider,
    useLesson: useG1Lesson15,
    HomePage: G1Lesson15HomePage,
    AppHeader: G1Lesson15AppHeader,
    Sidebar: G1Lesson15Sidebar,
    BottomNav: G1Lesson15BottomNav,
    FilterPanel: G1Lesson15FilterPanel,
    ProblemList: G1Lesson15ProblemList,
    ProblemDetail: G1Lesson15ProblemDetail,
    layoutBgClass: 'bg-sky-50',
  },
  '1-18': {
    PROBLEMS: G1Lesson18PROBLEMS,
    TAG_STYLE: G1Lesson18TAG_STYLE,
    Provider: G1Lesson18Provider,
    useLesson: useG1Lesson18,
    HomePage: G1Lesson18HomePage,
    AppHeader: G1Lesson18AppHeader,
    Sidebar: G1Lesson18Sidebar,
    BottomNav: G1Lesson18BottomNav,
    FilterPanel: G1Lesson18FilterPanel,
    ProblemList: G1Lesson18ProblemList,
    ProblemDetail: G1Lesson18ProblemDetail,
    layoutBgClass: 'bg-purple-50',
  },
  '1-23': {
    PROBLEMS: G1Lesson23PROBLEMS,
    TAG_STYLE: G1Lesson23TAG_STYLE,
    Provider: G1Lesson23Provider,
    useLesson: useG1Lesson23,
    HomePage: G1Lesson23HomePage,
    AppHeader: G1Lesson23AppHeader,
    Sidebar: G1Lesson23Sidebar,
    BottomNav: G1Lesson23BottomNav,
    FilterPanel: G1Lesson23FilterPanel,
    ProblemList: G1Lesson23ProblemList,
    ProblemDetail: G1Lesson23ProblemDetail,
    layoutBgClass: 'bg-violet-50',
  },
  '1-29': {
    PROBLEMS: G1Lesson29PROBLEMS,
    TAG_STYLE: G1Lesson29TAG_STYLE,
    Provider: G1Lesson29Provider,
    useLesson: useG1Lesson29,
    HomePage: G1Lesson29HomePage,
    AppHeader: G1Lesson29AppHeader,
    Sidebar: G1Lesson29Sidebar,
    BottomNav: G1Lesson29BottomNav,
    FilterPanel: G1Lesson29FilterPanel,
    ProblemList: G1Lesson29ProblemList,
    ProblemDetail: G1Lesson29ProblemDetail,
    layoutBgClass: 'bg-rose-50',
  },
  '1-30': {
    PROBLEMS: G1Lesson30PROBLEMS,
    TAG_STYLE: G1Lesson30TAG_STYLE,
    Provider: G1Lesson30Provider,
    useLesson: useG1Lesson30,
    HomePage: G1Lesson30HomePage,
    AppHeader: G1Lesson30AppHeader,
    Sidebar: G1Lesson30Sidebar,
    BottomNav: G1Lesson30BottomNav,
    FilterPanel: G1Lesson30FilterPanel,
    ProblemList: G1Lesson30ProblemList,
    ProblemDetail: G1Lesson30ProblemDetail,
    layoutBgClass: 'bg-amber-50',
  },
  '1-34': {
    PROBLEMS: G1Lesson34PROBLEMS,
    TAG_STYLE: G1Lesson34TAG_STYLE,
    Provider: G1Lesson34Provider,
    useLesson: useG1Lesson34,
    HomePage: G1Lesson34HomePage,
    AppHeader: G1Lesson34AppHeader,
    Sidebar: G1Lesson34Sidebar,
    BottomNav: G1Lesson34BottomNav,
    FilterPanel: G1Lesson34FilterPanel,
    ProblemList: G1Lesson34ProblemList,
    ProblemDetail: G1Lesson34ProblemDetail,
    layoutBgClass: 'bg-[#fffbeb]',
    MagicPage: Lesson34MagicDemo,
  },
  '1-35': {
    PROBLEMS: G1Lesson35PROBLEMS,
    TAG_STYLE: G1Lesson35TAG_STYLE,
    Provider: G1Lesson35Provider,
    useLesson: useG1Lesson35,
    HomePage: G1Lesson35HomePage,
    AppHeader: G1Lesson35AppHeader,
    Sidebar: G1Lesson35Sidebar,
    BottomNav: G1Lesson35BottomNav,
    FilterPanel: G1Lesson35FilterPanel,
    ProblemList: G1Lesson35ProblemList,
    ProblemDetail: G1Lesson35ProblemDetail,
    layoutBgClass: 'bg-[#fef9f0]',
  },
  '1-36': {
    PROBLEMS: G1Lesson36PROBLEMS,
    TAG_STYLE: G1Lesson36TAG_STYLE,
    Provider: G1Lesson36Provider,
    useLesson: useG1Lesson36,
    HomePage: G1Lesson36HomePage,
    AppHeader: G1Lesson36AppHeader,
    Sidebar: G1Lesson36Sidebar,
    BottomNav: G1Lesson36BottomNav,
    FilterPanel: G1Lesson36FilterPanel,
    ProblemList: G1Lesson36ProblemList,
    ProblemDetail: G1Lesson36ProblemDetail,
    layoutBgClass: 'bg-[#f0f7ff]',
    MagicPage: WeekdayMagic,
  },
  '1-37': {
    PROBLEMS: G1Lesson37PROBLEMS,
    TAG_STYLE: G1Lesson37TAG_STYLE,
    Provider: G1Lesson37Provider,
    useLesson: useG1Lesson37,
    HomePage: G1Lesson37HomePage,
    AppHeader: G1Lesson37AppHeader,
    Sidebar: G1Lesson37Sidebar,
    BottomNav: G1Lesson37BottomNav,
    FilterPanel: G1Lesson37FilterPanel,
    ProblemList: G1Lesson37ProblemList,
    ProblemDetail: G1Lesson37ProblemDetail,
    layoutBgClass: 'bg-[#f0f7ff]',
  },
  '1-38': {
    PROBLEMS: G1Lesson38PROBLEMS,
    TAG_STYLE: G1Lesson38TAG_STYLE,
    Provider: G1Lesson38Provider,
    useLesson: useG1Lesson38,
    HomePage: G1Lesson38HomePage,
    AppHeader: G1Lesson38AppHeader,
    Sidebar: G1Lesson38Sidebar,
    BottomNav: G1Lesson38BottomNav,
    FilterPanel: G1Lesson38FilterPanel,
    ProblemList: G1Lesson38ProblemList,
    ProblemDetail: G1Lesson38ProblemDetail,
    layoutBgClass: 'bg-[#f5f3ff]',
    MagicPage: YibihaMagicBook,
  },
  '1-39': {
    PROBLEMS: G1Lesson39PROBLEMS,
    TAG_STYLE: G1Lesson39TAG_STYLE,
    Provider: G1Lesson39Provider,
    useLesson: useG1Lesson39,
    HomePage: G1Lesson39HomePage,
    AppHeader: G1Lesson39AppHeader,
    Sidebar: G1Lesson39Sidebar,
    BottomNav: G1Lesson39BottomNav,
    FilterPanel: G1Lesson39FilterPanel,
    ProblemList: G1Lesson39ProblemList,
    ProblemDetail: G1Lesson39ProblemDetail,
    layoutBgClass: 'bg-[#fffbeb]',
  },
  '1-40': {
    PROBLEMS: G1Lesson40PROBLEMS,
    TAG_STYLE: G1Lesson40TAG_STYLE,
    Provider: G1Lesson40Provider,
    useLesson: useG1Lesson40,
    HomePage: G1Lesson40HomePage,
    AppHeader: G1Lesson40AppHeader,
    Sidebar: G1Lesson40Sidebar,
    BottomNav: G1Lesson40BottomNav,
    FilterPanel: G1Lesson40FilterPanel,
    ProblemList: G1Lesson40ProblemList,
    ProblemDetail: G1Lesson40ProblemDetail,
    layoutBgClass: 'bg-[#f0fdf4]',
  },
  '1-41': {
    PROBLEMS: G1Lesson41PROBLEMS,
    TAG_STYLE: G1Lesson41TAG_STYLE,
    Provider: G1Lesson41Provider,
    useLesson: useG1Lesson41,
    HomePage: G1Lesson41HomePage,
    AppHeader: G1Lesson41AppHeader,
    Sidebar: G1Lesson41Sidebar,
    BottomNav: G1Lesson41BottomNav,
    FilterPanel: G1Lesson41FilterPanel,
    ProblemList: G1Lesson41ProblemList,
    ProblemDetail: G1Lesson41ProblemDetail,
    layoutBgClass: 'bg-[#f0f9ff]',
  },
  '1-42': {
    PROBLEMS: G1Lesson42PROBLEMS,
    TAG_STYLE: G1Lesson42TAG_STYLE,
    Provider: G1Lesson42Provider,
    useLesson: useG1Lesson42,
    HomePage: G1Lesson42HomePage,
    AppHeader: G1Lesson42AppHeader,
    Sidebar: G1Lesson42Sidebar,
    BottomNav: G1Lesson42BottomNav,
    FilterPanel: G1Lesson42FilterPanel,
    ProblemList: G1Lesson42ProblemList,
    ProblemDetail: G1Lesson42ProblemDetail,
    layoutBgClass: 'bg-rose-50',
  },
  '1-43': {
    PROBLEMS: G1Lesson43PROBLEMS,
    TAG_STYLE: G1Lesson43TAG_STYLE,
    Provider: G1Lesson43Provider,
    useLesson: useG1Lesson43,
    HomePage: G1Lesson43HomePage,
    AppHeader: G1Lesson43AppHeader,
    Sidebar: G1Lesson43Sidebar,
    BottomNav: G1Lesson43BottomNav,
    FilterPanel: G1Lesson43FilterPanel,
    ProblemList: G1Lesson43ProblemList,
    ProblemDetail: G1Lesson43ProblemDetail,
    layoutBgClass: 'bg-cyan-50',
  },
  '1-44': {
    PROBLEMS: G1Lesson44PROBLEMS,
    TAG_STYLE: G1Lesson44TAG_STYLE,
    Provider: G1Lesson44Provider,
    useLesson: useG1Lesson44,
    HomePage: G1Lesson44HomePage,
    AppHeader: G1Lesson44AppHeader,
    Sidebar: G1Lesson44Sidebar,
    BottomNav: G1Lesson44BottomNav,
    FilterPanel: G1Lesson44FilterPanel,
    ProblemList: G1Lesson44ProblemList,
    ProblemDetail: G1Lesson44ProblemDetail,
    layoutBgClass: 'bg-indigo-50',
  },
  '1-46': {
    PROBLEMS: G1Lesson46PROBLEMS,
    TAG_STYLE: G1Lesson46TAG_STYLE,
    Provider: G1Lesson46Provider,
    useLesson: useG1Lesson46,
    HomePage: G1Lesson46HomePage,
    AppHeader: G1Lesson46AppHeader,
    Sidebar: G1Lesson46Sidebar,
    BottomNav: G1Lesson46BottomNav,
    FilterPanel: G1Lesson46FilterPanel,
    ProblemList: G1Lesson46ProblemList,
    ProblemDetail: G1Lesson46ProblemDetail,
    layoutBgClass: 'bg-[#f0fdfa]',
  },
  '1-47': {
    PROBLEMS: G1Lesson47PROBLEMS,
    TAG_STYLE: G1Lesson47TAG_STYLE,
    Provider: G1Lesson47Provider,
    useLesson: useG1Lesson47,
    HomePage: G1Lesson47HomePage,
    AppHeader: G1Lesson47AppHeader,
    Sidebar: G1Lesson47Sidebar,
    BottomNav: G1Lesson47BottomNav,
    FilterPanel: G1Lesson47FilterPanel,
    ProblemList: G1Lesson47ProblemList,
    ProblemDetail: G1Lesson47ProblemDetail,
    layoutBgClass: 'bg-[#fdf4ff]',
  },
  '2-1': {
    PROBLEMS: G2Lesson1PROBLEMS,
    TAG_STYLE: G2Lesson1TAG_STYLE,
    Provider: G2Lesson1Provider,
    useLesson: useG2Lesson1,
    HomePage: G2Lesson1HomePage,
    AppHeader: G2Lesson1AppHeader,
    Sidebar: G2Lesson1Sidebar,
    BottomNav: G2Lesson1BottomNav,
    FilterPanel: G2Lesson1FilterPanel,
    ProblemList: G2Lesson1ProblemList,
    ProblemDetail: G2Lesson1ProblemDetail,
    layoutBgClass: 'bg-[#eef2ff]',
  },
  '2-2': {
    PROBLEMS: G2Lesson2PROBLEMS,
    TAG_STYLE: G2Lesson2TAG_STYLE,
    Provider: G2Lesson2Provider,
    useLesson: useG2Lesson2,
    HomePage: G2Lesson2HomePage,
    AppHeader: G2Lesson2AppHeader,
    Sidebar: G2Lesson2Sidebar,
    BottomNav: G2Lesson2BottomNav,
    FilterPanel: G2Lesson2FilterPanel,
    ProblemList: G2Lesson2ProblemList,
    ProblemDetail: G2Lesson2ProblemDetail,
    layoutBgClass: 'bg-[#f0fdfa]',
  },
  '2-3': {
    PROBLEMS: G2Lesson3PROBLEMS,
    TAG_STYLE: G2Lesson3TAG_STYLE,
    Provider: G2Lesson3Provider,
    useLesson: useG2Lesson3,
    HomePage: G2Lesson3HomePage,
    AppHeader: G2Lesson3AppHeader,
    Sidebar: G2Lesson3Sidebar,
    BottomNav: G2Lesson3BottomNav,
    FilterPanel: G2Lesson3FilterPanel,
    ProblemList: G2Lesson3ProblemList,
    ProblemDetail: G2Lesson3ProblemDetail,
    layoutBgClass: 'bg-[#ecfdf5]',
  },
  '2-4': {
    PROBLEMS: G2Lesson4PROBLEMS,
    TAG_STYLE: G2Lesson4TAG_STYLE,
    Provider: G2Lesson4Provider,
    useLesson: useG2Lesson4,
    HomePage: G2Lesson4HomePage,
    AppHeader: G2Lesson4AppHeader,
    Sidebar: G2Lesson4Sidebar,
    BottomNav: G2Lesson4BottomNav,
    FilterPanel: G2Lesson4FilterPanel,
    ProblemList: G2Lesson4ProblemList,
    ProblemDetail: G2Lesson4ProblemDetail,
    layoutBgClass: 'bg-[#f0f9ff]',
  },
  '2-5': {
    PROBLEMS: G2Lesson5PROBLEMS,
    TAG_STYLE: G2Lesson5TAG_STYLE,
    Provider: G2Lesson5Provider,
    useLesson: useG2Lesson5,
    HomePage: G2Lesson5HomePage,
    AppHeader: G2Lesson5AppHeader,
    Sidebar: G2Lesson5Sidebar,
    BottomNav: G2Lesson5BottomNav,
    FilterPanel: G2Lesson5FilterPanel,
    ProblemList: G2Lesson5ProblemList,
    ProblemDetail: G2Lesson5ProblemDetail,
    layoutBgClass: 'bg-[#f0f9ff]',
  },
  '2-6': {
    PROBLEMS: G2Lesson6PROBLEMS,
    TAG_STYLE: G2Lesson6TAG_STYLE,
    Provider: G2Lesson6Provider,
    useLesson: useG2Lesson6,
    HomePage: G2Lesson6HomePage,
    AppHeader: G2Lesson6AppHeader,
    Sidebar: G2Lesson6Sidebar,
    BottomNav: G2Lesson6BottomNav,
    FilterPanel: G2Lesson6FilterPanel,
    ProblemList: G2Lesson6ProblemList,
    ProblemDetail: G2Lesson6ProblemDetail,
    layoutBgClass: 'bg-[#f0fdfa]',
  },
  '2-7': {
    PROBLEMS: G2Lesson7PROBLEMS,
    TAG_STYLE: G2Lesson7TAG_STYLE,
    Provider: G2Lesson7Provider,
    useLesson: useG2Lesson7,
    HomePage: G2Lesson7HomePage,
    AppHeader: G2Lesson7AppHeader,
    Sidebar: G2Lesson7Sidebar,
    BottomNav: G2Lesson7BottomNav,
    FilterPanel: G2Lesson7FilterPanel,
    ProblemList: G2Lesson7ProblemList,
    ProblemDetail: G2Lesson7ProblemDetail,
    layoutBgClass: 'bg-[#f0f9ff]',
  },
}

export function lessonModuleByKey(lessonKey: string): LessonModule | undefined {
  return LESSON_MODULES[lessonKey]
}
