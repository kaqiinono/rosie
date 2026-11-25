'use client'

import { useEffect, useState } from 'react'
import { useAuth, supabase } from '@rosie/core'
import { LoadingOverlay, NavigationLink, PageBreadcrumb, StickerCard } from '@rosie/ui'
import { Badge, Button, Flex, Heading, Text } from '@rosie/ui/themes'
import { requestTheater } from '@/lib/theater/client'
import { theaterTime } from '@/lib/theater/subtitle-timeline'
import { theaterLanguageLabel, type TheaterFilm } from '@/lib/theater/types'

interface LibraryData { films: TheaterFilm[]; progress: Record<string, number> }

export default function TheaterLibrary() {
  const { user } = useAuth()
  return user ? <Library key={user.id} userId={user.id} /> : null
}

function Library({ userId }: { userId: string }) {
  const [data, setData] = useState<LibraryData | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const films = await requestTheater<TheaterFilm[]>(userId, '/api/theater', { signal: controller.signal })
        const result = films.length
          ? await supabase.from('theater_progress').select('film_id,position_ms').eq('user_id', userId)
            .abortSignal(controller.signal)
          : { data: [], error: null }
        if (controller.signal.aborted) return
        setData({ films, progress: Object.fromEntries(
          (result.data ?? []).map(item => [item.film_id, item.position_ms]),
        ) })
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : '暂时无法打开片库。')
      }
    }
    void load()
    return () => controller.abort()
  }, [attempt, userId])

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[1040px] flex-col gap-4 px-4 pb-8 pt-14 sm:px-6">
      <PageBreadcrumb variant="inline" />
      <Heading as="h1" size="7">电影剧场</Heading>
      {!data && !error && <div className="relative flex min-h-48 flex-1 flex-col"><LoadingOverlay visible placement="content" /></div>}
      {error && <StickerCard><Flex gap="3" align="center" wrap="wrap">
        <Text role="alert">{error}</Text>
        <Button onClick={() => { setError(''); setAttempt(value => value + 1) }}>重新读取</Button>
      </Flex></StickerCard>}
      {data && !data.films.length && <StickerCard><Text>片库暂时没有影片，家长上架后会出现在这里。</Text></StickerCard>}
      {data && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.films.map(film => {
          const position = data.progress[film.id] ?? 0
          return (
            <StickerCard key={film.id} asChild>
              <NavigationLink href={'/english/theater/' + film.id} className="block focus-visible:outline-2">
                <Flex direction="column" gap="2">
                  <Heading as="h2" size="4" className="break-words">{film.title}</Heading>
                  <Flex gap="2" wrap="wrap">
                    {film.languages.map(language => <Badge key={language}>{theaterLanguageLabel[language]}字幕</Badge>)}
                  </Flex>
                  <Text size="2" color="gray">{position > 0 ? '继续观看 · ' + theaterTime(position) : '开始观看'}</Text>
                </Flex>
              </NavigationLink>
            </StickerCard>
          )
        })}
      </div>}
    </main>
  )
}
