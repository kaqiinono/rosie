'use client'

import { useState } from 'react'
import type { WordEntry } from '@rosie/core'
import { AppDialog, StickerCard } from '@rosie/ui'
import { Badge, Button } from '@rosie/ui/themes'
import type { PetWordContent } from './types'
import { PET_PRIORITY_LABELS, petTopicLabel } from './topics'

type Props = { words: WordEntry[]; contentByWordId: Record<string, PetWordContent> }

export default function PetWordList({ words, contentByWordId }: Props) {
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<WordEntry | null>(null)
  const currentPage = Math.min(page, Math.max(0, Math.ceil(words.length / 20) - 1))
  const content = selected?.id ? contentByWordId[selected.id] : undefined

  return <>
    <StickerCard tone="accent">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">词汇与来源 · {words.length} 词</h2>
        <div className="flex items-center gap-2">
          <Button variant="soft" size="1" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</Button>
          <span className="text-sm">{currentPage + 1} / {Math.max(1, Math.ceil(words.length / 20))}</span>
          <Button variant="soft" size="1" disabled={(currentPage + 1) * 20 >= words.length} onClick={() => setPage(currentPage + 1)}>下一页</Button>
        </div>
      </div>
      {words.length === 0 ? <p className="text-sm">这个范围没有词汇，试试其他主题或关键词。</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {words.slice(currentPage * 20, (currentPage + 1) * 20).map((word) => <li key={word.id ?? `${word.unit}:${word.lesson}:${word.word}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold" lang="en">{word.word}</p>
                <p className="mt-1 text-sm">{word.chineseDef || word.explanation}</p>
              </div>
              <Button size="1" variant="soft" onClick={() => setSelected(word)} aria-label={`查看 ${word.word} 的义项和来源`}>详情</Button>
            </div>
          </li>)}
        </ul>
      )}
    </StickerCard>

    <AppDialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }} title={selected?.word ?? '词汇详情'} description="义项、例句与原始资料" size="form">
      {selected && <div className="flex flex-col gap-4">
        <p>{selected.ipa} {selected.partOfSpeech?.join(' / ')}</p>
        <p>{selected.explanation}</p>
        <p>{selected.chineseDef}</p>
        <div className="flex flex-wrap gap-2">
          {content?.topics.map((topic) => <Badge key={topic} color="green">{petTopicLabel(topic)}</Badge>)}
          {content?.priorities.map((priority) => <Badge key={priority} color="amber">{PET_PRIORITY_LABELS[priority] ?? priority}</Badge>)}
        </div>
        {content && content.aliases.length > 0 && <p className="text-sm">拼写变体：{content.aliases.join(' / ')}</p>}
        {content?.senses.map((sense) => <section key={sense.id}>
          <h3 className="font-bold">{sense.partOfSpeech.join(' / ')} {sense.definitionZh}</h3>
          <p className="mt-1" lang="en">{sense.definitionEn}</p>
          {sense.example && <p className="mt-2" lang="en">{sense.example}</p>}
          {sense.exampleZh && <p className="text-sm">{sense.exampleZh}</p>}
          {sense.collocations.length > 0 && <p className="mt-2 text-sm">搭配：{sense.collocations.join(' · ')}</p>}
          {sense.confusions && sense.confusions.length > 0 && <p className="mt-2 text-sm">辨析：{sense.confusions.join('；')}</p>}
        </section>)}
        {!content?.senses.length && selected.example && <p lang="en">{selected.example}</p>}
        <section>
          <h3 className="mb-2 font-bold">资料来源</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {content?.sources.map((source, index) => <li key={`${source.file}:${source.page}:${index}`}>
              {source.sourceTitle ?? source.file}{source.version ? `（${source.version}）` : ''} · 第 {source.page} 页{source.question ? ` · 第 ${source.question} 题` : ''}
              {source.rawHeadword && <span className="block">原词头：{source.rawHeadword}{source.topic ? ` · ${source.topic}` : ''}</span>}
            </li>)}
          </ul>
          {!content?.sources.length && <p className="text-sm">此词的来源信息尚未发布。</p>}
        </section>
      </div>}
    </AppDialog>
  </>
}
