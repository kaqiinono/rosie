'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingOverlay, PageBreadcrumb, StickerCard } from '@rosie/ui'
import { Button, Flex, Tabs, Text } from '@rosie/ui/themes'
import { useHomeworkData } from './useHomeworkData'
import HomeworkManager from './components/homework/HomeworkManager'
import { TASK_SECTIONS, sectionHref, type TaskSection } from './components/taskSections'

export default function HomeworkPage({ children }: { children?: ReactNode }) {
  const router = useRouter()
  const api = useHomeworkData()
  const { user, isLoading, error, refresh } = api
  const [message, notify] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')

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
      <h1 className="sr-only">作业管理</h1>
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
              <Text color="red">作业读取失败。</Text>
              <Button variant="soft" loading={refreshing} onClick={reload}>
                重试
              </Button>
            </Flex>
          ) : (
            <StickerCard
              as="section"
              size="none"
              elevation="lg"
              className="min-w-0 overflow-hidden"
              aria-label="作业管理"
            >
              <Tabs.Root
                value="homework"
                onValueChange={(value) => {
                  if (value !== 'homework') router.push(sectionHref(value as TaskSection))
                }}
              >
                <div className="px-3 pt-1 sm:px-5">
                  <Tabs.List size="2" aria-label="课程安排模块">
                    {TASK_SECTIONS.map(([value, label]) => (
                      <Tabs.Trigger key={value} value={value}>
                        {label}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                </div>
                <Tabs.Content value="homework">
                  {children}
                  <HomeworkManager api={api} notify={notify} />
                </Tabs.Content>
              </Tabs.Root>
            </StickerCard>
          )}
        </Flex>
      </Flex>
    </div>
  )
}
