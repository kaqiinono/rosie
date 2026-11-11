'use client'

import { useState } from 'react'
import { PageShell, StickerCard } from '@rosie/ui'
import { Button, Flex, Text, TextField } from '@rosie/ui/themes'
import { defaultRules, type Rules } from '@/lib/time-tree/types'
import { TreeWait } from './StepPanel'
import { useTimeTree, type TreeController } from './useTimeTree'

function Form({ api, initial }: { api: TreeController; initial: Rules }) {
  const [rules, setRules] = useState(initial)
  const [pin, setPin] = useState('')
  const [notice, setNotice] = useState('')
  const labels = {
    chinese: '语文每果花数',
    math: '数学每果花数',
    english: '英语每果花数',
    wish: '兑换所需每色石头',
  }
  return (
    <StickerCard>
      <Flex direction="column" gap="3">
        <Text>修改从明天起生效，已结的果实与余花保留。</Text>
        {(Object.keys(defaultRules) as (keyof Rules)[]).map((k) => (
          <label key={k}>
            {labels[k]} · 当前 {api.tree!.rules[k]}
            <TextField.Root
              type="number"
              min={1}
              max={20}
              value={rules[k]}
              onChange={(e) => setRules({ ...rules, [k]: Number(e.target.value) })}
            />
          </label>
        ))}
        <label>
          家长密码
          <TextField.Root
            type="password"
            value={pin}
            maxLength={6}
            inputMode="numeric"
            onChange={(e) => setPin(e.target.value)}
          />
        </label>
        <Button
          loading={api.busy}
          disabled={pin.length !== 6}
          onClick={async () => {
            const tree = await api.run({ kind: 'settings', rules, pin })
            if (tree) {
              setNotice('已保存，将于 ' + tree.upcoming?.day + ' 生效。')
              setPin('')
            }
          }}
        >
          保存设置
        </Button>
        <Text role="status">
          {api.message ||
            notice ||
            (api.tree?.upcoming ? api.tree.upcoming.day + ' 起使用新设置' : '')}
        </Text>
      </Flex>
    </StickerCard>
  )
}
export default function TreeSettings() {
  const api = useTimeTree()
  return (
    <PageShell icon="🌳" title="生命树设置" backHref="/setting">
      {api.tree ? (
        <Form key={api.user?.id} api={api} initial={api.tree.upcoming?.rules ?? api.tree.rules} />
      ) : (
        <TreeWait api={api} />
      )}
    </PageShell>
  )
}
