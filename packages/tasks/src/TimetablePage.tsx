'use client'

import { useState } from 'react'
import { LoadingOverlay, PageBreadcrumb } from '@rosie/ui'
import { Button, Flex, Text } from '@rosie/ui/themes'
import { useTimetableData } from './useTimetableData'
import CourseReminders from './components/timetable/CourseReminders'
import Timetable from './components/Timetable'
import { TimetableContext } from './components/shared'

export default function TimetablePage() {
  const api = useTimetableData()
  const { error, user, isLoading, refresh } = api
  const [message, notify] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function reload() {
    setRefreshing(true)
    setRefreshError('')
    try {
      await refresh()
    } catch {
      setRefreshError('刷新失败，请重试。')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <h1 className="sr-only">课程表</h1>
      <Flex
        direction="column"
        gap="3"
        flexGrow="1"
        width="100%"
        maxWidth="1280px"
        mx="auto"
        px={{ initial: '3', sm: '5' }}
        pt="3"
        pb="5"
      >
        <Flex>
          <PageBreadcrumb variant="inline" />
        </Flex>
        <Flex role="main" direction="column" gap="3" flexGrow="1">
          {message && (
            <Text role="status" size="2">
              {message}
            </Text>
          )}
          {refreshError && (
            <Text role="alert" color="red">
              {refreshError}
            </Text>
          )}
          {!user ? (
            <Text>请先登录。</Text>
          ) : isLoading ? (
            <LoadingOverlay visible placement="content" />
          ) : error ? (
            <Flex role="alert" align="center" gap="3">
              <Text color="red">课表读取失败。</Text>
              <Button variant="soft" loading={refreshing} onClick={reload}>
                重试
              </Button>
            </Flex>
          ) : (
            <TimetableContext.Provider value={{ api, notify }}>
              <CourseReminders data={api.data} />
              <Timetable />
            </TimetableContext.Provider>
          )}
        </Flex>
      </Flex>
    </div>
  )
}
