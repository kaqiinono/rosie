'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { supabase, type WordEntry } from '@rosie/core'
import { AppDialog } from '@rosie/ui'
import { Button, Flex, Select, Text, TextArea, TextField } from '@rosie/ui/themes'

type Written = { partOfSpeech?: string[]; definitionEn?: string; definitionZh?: string }
type Sense = { id: string; written: Written; revision: number; cefr: string | null; cefr_source: string | null }
const NEW = 'new'
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export default function SharedWordSenseEditor({ word, onClose, onSaved }: {
  word: WordEntry
  onClose: () => void
  onSaved: () => void
}) {
  const [senses, setSenses] = useState<Sense[] | null>(null)
  const [selected, setSelected] = useState(NEW)
  const [partOfSpeech, setPartOfSpeech] = useState('')
  const [definitionEn, setDefinitionEn] = useState('')
  const [definitionZh, setDefinitionZh] = useState('')
  const [level, setLevel] = useState('')
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [requestId] = useState(() => crypto.randomUUID())
  const current = senses?.find((sense) => sense.id === selected)

  useEffect(() => {
    const headwordId = word.headwordId
    if (!headwordId) return
    const controller = new AbortController()
    void (async () => {
      const { data, error: readError } = await supabase.from('vocabulary_senses')
        .select('id,written,revision,cefr,cefr_source')
        .eq('headword_id', headwordId).eq('verified', true).order('id').abortSignal(controller.signal)
      if (controller.signal.aborted) return
      if (readError) setError(readError.message)
      else setSenses(data as Sense[])
    })()
    return () => controller.abort()
  }, [word.headwordId])

  function selectSense(id: string) {
    const sense = senses?.find((row) => row.id === id)
    setSelected(id)
    setPartOfSpeech(sense?.written.partOfSpeech?.join(', ') ?? '')
    setDefinitionEn(sense?.written.definitionEn ?? '')
    setDefinitionZh(sense?.written.definitionZh ?? '')
    setLevel(sense?.cefr ?? '')
    setSource(sense?.cefr_source ?? '')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!word.id || busy) return
    const written = {
      partOfSpeech: partOfSpeech.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
      definitionEn: definitionEn.trim(),
      definitionZh: definitionZh.trim(),
    }
    if (!written.partOfSpeech.length || (!written.definitionEn && !written.definitionZh) || (level && !source.trim())) {
      setError('请填写词性和释义。标等级时须注明依据。')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (current) {
        const { error: editError } = await supabase.rpc('revise_vocabulary_sense', {
          p_id: current.id, p_expected_revision: current.revision, p_written: written,
          p_cefr: level || null, p_cefr_source: level ? source.trim() : null,
        })
        if (editError) throw editError
      } else {
        const { error: publishError } = await supabase.rpc('publish_reviewed_vocabulary_position', {
          p_input: {
            source: { key: 'admin-sense', revision: '1', row: requestId },
            position: { id: word.id },
            senses: [{ ...written, cefr: level || null, cefrSource: level ? source.trim() : null }],
          },
        })
        if (publishError) throw publishError
      }
      onSaved()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : (failure as { message?: string }).message ?? '保存失败')
    } finally {
      setBusy(false)
    }
  }

  async function attach() {
    if (!current || !word.id || busy) return
    setBusy(true)
    setError('')
    try {
      const { error: publishError } = await supabase.rpc('publish_reviewed_vocabulary_position', {
        p_input: {
          source: { key: 'admin-sense', revision: '1', row: requestId },
          position: { id: word.id },
          senses: [{ senseId: current.id }],
        },
      })
      if (publishError) throw publishError
      onSaved()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : (failure as { message?: string }).message ?? '引用失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppDialog title={`共享义项 · ${word.word}`} open closeDisabled={busy} onOpenChange={(open) => { if (!open && !busy) onClose() }} size="form">
      <form onSubmit={(event) => void save(event)}>
        <Flex direction="column" gap="3">
          {senses === null ? <Text>读取义项中</Text> : (
            <Select.Root value={selected} onValueChange={selectSense} disabled={busy}>
              <Select.Trigger aria-label="选择义项" />
              <Select.Content>
                <Select.Item value={NEW}>新建义项</Select.Item>
                {senses.map((sense) => <Select.Item key={sense.id} value={sense.id}>
                  {sense.written.definitionZh || sense.written.definitionEn} · {sense.cefr || '待定'}
                </Select.Item>)}
              </Select.Content>
            </Select.Root>
          )}
          <label>词性<TextField.Root value={partOfSpeech} onChange={(event) => setPartOfSpeech(event.target.value)} placeholder="n., v." disabled={busy} /></label>
          <label>英文释义<TextArea value={definitionEn} onChange={(event) => setDefinitionEn(event.target.value)} disabled={busy} /></label>
          <label>中文释义<TextArea value={definitionZh} onChange={(event) => setDefinitionZh(event.target.value)} disabled={busy} /></label>
          <Select.Root value={level || 'pending'} onValueChange={(value) => setLevel(value === 'pending' ? '' : value)} disabled={busy}>
            <Select.Trigger aria-label="CEFR 等级" />
            <Select.Content>
              <Select.Item value="pending">等级待定</Select.Item>
              {LEVELS.map((value) => <Select.Item key={value} value={value}>{value}</Select.Item>)}
            </Select.Content>
          </Select.Root>
          {level && <label>分级依据<TextField.Root value={source} onChange={(event) => setSource(event.target.value)} disabled={busy} /></label>}
          {error && <Text color="red" role="alert">{error}</Text>}
          <Flex gap="2" justify="end" wrap="wrap">
            {current && !word.verifiedSenseIds?.includes(current.id) && (
              <Button type="button" variant="soft" disabled={busy} onClick={() => void attach()}>加入这节课</Button>
            )}
            <Button type="submit" loading={busy} disabled={!senses}>
              {current ? '更新共享义项' : '新建并加入这节课'}
            </Button>
          </Flex>
        </Flex>
      </form>
    </AppDialog>
  )
}
