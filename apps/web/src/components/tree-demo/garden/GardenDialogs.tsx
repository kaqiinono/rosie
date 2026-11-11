'use client'

import { AppDialog, FormSelect } from '@rosie/ui'
import { Badge, Button, Flex, Text } from '@rosie/ui/themes'
import {
  CORE_SUBJECTS,
  K_RANGE,
  N_RANGE,
  SUBJECTS,
  addDaysKey,
  capacityOf,
  dayLoad,
  flowersOfBud,
  shortDate,
  weekdayLabel,
  type Bud,
  type CoreSubject,
  type DiaryEntry,
  type GardenState,
  type Settings,
  type SubjectKey,
} from './model'

export const SUBJECT_BADGE: Record<SubjectKey, 'red' | 'amber' | 'blue' | 'green'> = {
  chinese: 'red',
  math: 'amber',
  english: 'blue',
  life: 'green',
}

// ---------- 挑哪一天 ----------
type DayPickerProps = {
  state: GardenState
  bud: Bud
  locked: boolean
  allowParked: boolean
  onMove: (dateKey: string | null) => void
}

export function DayPicker({ state, bud, locked, allowParked, onMove }: DayPickerProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(state.today, i))
  return (
    <Flex gap="2" wrap="wrap">
      {days.map((key, i) => {
        const current = bud.dateKey === key && !bud.overdue
        const full = !current && dayLoad(state, key) + flowersOfBud(bud) > capacityOf(key)
        return (
          <Button
            key={key}
            size="2"
            variant={current ? 'solid' : 'soft'}
            disabled={locked || full}
            onClick={() => onMove(key)}
          >
            {i === 0 ? '今天' : weekdayLabel(key)} {shortDate(key)}
            {full ? '（满）' : ''}
          </Button>
        )
      })}
      {allowParked && (
        <Button
          size="2"
          color="gray"
          variant={bud.dateKey === null ? 'solid' : 'soft'}
          disabled={locked}
          onClick={() => onMove(null)}
        >
          先不做
        </Button>
      )}
    </Flex>
  )
}

// ---------- 花苞卡片 ----------
type BudDialogProps = {
  bud: Bud | null
  state: GardenState
  canBubble: boolean
  onClose: () => void
  onAddBubble: () => void
  onMove: (dateKey: string | null) => void
}

export function BudDialog({ bud, state, canBubble, onClose, onAddBubble, onMove }: BudDialogProps) {
  const meta = bud ? SUBJECTS[bud.subject] : null
  const n = bud ? flowersOfBud(bud) : 0
  const inAir = bud ? state.bubbles.includes(bud.id) : false
  const eligible = bud ? (bud.dateKey === state.today && !bud.overdue) || bud.overdue : false
  return (
    <AppDialog
      open={bud !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={bud?.name ?? '花苞'}
      icon={meta?.emoji}
      description={bud && meta ? `${meta.label} · ${bud.minutes} 分钟 · 开 ${n} 朵花` : undefined}
    >
      {bud && meta && (
        <Flex direction="column" gap="3">
          <Flex gap="2" wrap="wrap">
            <Badge color={SUBJECT_BADGE[bud.subject]} variant="soft" radius="full">
              {meta.label}
            </Badge>
            <Badge color={bud.overdue ? 'gray' : bud.dateKey === null ? 'brown' : 'green'} variant="soft" radius="full">
              {bud.overdue
                ? '灰色花苞：过了计划那天'
                : bud.dateKey === null
                  ? '在「先不做」里'
                  : `计划在 ${weekdayLabel(bud.dateKey)} ${shortDate(bud.dateKey)}`}
            </Badge>
            {inAir && (
              <Badge color="sky" variant="soft" radius="full">
                已经飘在空中
              </Badge>
            )}
          </Flex>
          {bud.overdue && (
            <Text size="2" color="gray">
              补做会在今天开花，结的苹果挂在今天的叶区里，也不占今天的容量。
            </Text>
          )}
          {canBubble ? (
            <Button size="3" onClick={onAddBubble}>
              🫧 放进泡泡
            </Button>
          ) : (
            <Text size="2" color="gray">
              {inAir
                ? '它已经是泡泡了，戳破它就能开花。'
                : eligible
                  ? state.afterSchool
                    ? '空中已经有 4 个泡泡，戳破一个再放新的。'
                    : '点「放学了」之后，才能把它放进泡泡。'
                  : '只有今天的花苞和灰色花苞可以放进泡泡。'}
            </Text>
          )}
          <Text size="2" weight="bold">
            改到哪一天
          </Text>
          <DayPicker state={state} bud={bud} locked={inAir} allowParked onMove={onMove} />
          <Text size="1" color="gray">
            每片叶区按当天计划开的花数算容量：平日 14 朵，周末 18 朵。原型里用点按代替拖动。
          </Text>
        </Flex>
      )}
    </AppDialog>
  )
}

// ---------- 泡泡卡片 ----------
type BubbleDialogProps = {
  bud: Bud | null
  onClose: () => void
  onPop: () => void
  onPutBack: () => void
}

export function BubbleDialog({ bud, onClose, onPop, onPutBack }: BubbleDialogProps) {
  const meta = bud ? SUBJECTS[bud.subject] : null
  const n = bud ? flowersOfBud(bud) : 0
  const water = 1 + (n >= 3 ? 1 : 0)
  return (
    <AppDialog
      open={bud !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={bud?.name ?? '泡泡'}
      icon={meta?.emoji}
      description={bud && meta ? `${meta.label} · 预计 ${bud.minutes} 分钟` : undefined}
    >
      {bud && meta && (
        <Flex direction="column" gap="3">
          <Text size="3" weight="bold">
            完成可得：☀️+{n * 2} 💧+{water}，树上开出 {n} 朵{meta.label}花
          </Text>
          <Text size="2" color="gray">
            认真做完，再来戳破它。{bud.overdue ? '这是补做，花会开在今天。' : ''}
          </Text>
          <Button size="3" onClick={onPop}>
            🫧 做完啦，戳破它！
          </Button>
          <Button size="2" variant="soft" color="gray" onClick={onPutBack}>
            还没做，先放回花苞
          </Button>
        </Flex>
      )}
    </AppDialog>
  )
}

// ---------- 先不做 ----------
type ParkedDialogProps = {
  open: boolean
  state: GardenState
  onClose: () => void
  onMove: (budId: string, dateKey: string | null) => void
}

export function ParkedDialog({ open, state, onClose, onMove }: ParkedDialogProps) {
  const parked = state.buds.filter((b) => b.dateKey === null)
  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title="先不做"
      icon="📦"
      description="放不下、休息日收回、或还在七天之外的事，先放在这里。选一天就能放回树上。"
    >
      {parked.length === 0 ? (
        <Text size="2" color="gray">
          这里是空的。
        </Text>
      ) : (
        <Flex direction="column" gap="4">
          {parked.map((bud) => (
            <Flex key={bud.id} direction="column" gap="2">
              <Flex align="center" gap="2">
                <Badge color={SUBJECT_BADGE[bud.subject]} variant="soft" radius="full">
                  {SUBJECTS[bud.subject].label}
                </Badge>
                <Text size="3" weight="bold">
                  {bud.name}
                </Text>
                <Text size="1" color="gray">
                  {bud.minutes} 分钟 · {flowersOfBud(bud)} 朵花
                </Text>
              </Flex>
              <DayPicker state={state} bud={bud} locked={false} allowParked={false} onMove={(key) => onMove(bud.id, key)} />
            </Flex>
          ))}
        </Flex>
      )}
    </AppDialog>
  )
}

// ---------- 成长日记 ----------
function fmtTime(t: number): string {
  const d = new Date(t)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type DiaryDialogProps = {
  open: boolean
  entries: DiaryEntry[]
  totalPops: number
  rings: number
  exchanges: number
  onClose: () => void
}

export function DiaryDialog({ open, entries, totalPops, rings, exchanges, onClose }: DiaryDialogProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title="成长日记"
      icon="📔"
      description={`戳过 ${totalPops} 个泡泡 · 树干 ${rings} 圈年轮 · 兑换 ${exchanges} 次`}
    >
      {entries.length === 0 ? (
        <Text size="2" color="gray">
          还没有记录，去戳第一个泡泡吧。
        </Text>
      ) : (
        <Flex direction="column" gap="2">
          {entries.map((e) => (
            <Flex key={e.id} align="start" gap="3">
              <span className="text-xl leading-none" aria-hidden="true">
                {e.icon}
              </span>
              <Text size="2" className="min-w-0 flex-1">
                {e.text}
              </Text>
              <Text size="1" color="gray" className="whitespace-nowrap">
                {fmtTime(e.t)}
              </Text>
            </Flex>
          ))}
        </Flex>
      )}
    </AppDialog>
  )
}

// ---------- 彩虹果 ----------
export type RainbowStage = { step: 'assign' } | { step: 'box'; prize: string; subject: CoreSubject }

type RainbowDialogProps = {
  stage: RainbowStage | null
  state: GardenState
  onAssign: (subject: CoreSubject) => void
  onClose: () => void
}

export function RainbowDialog({ stage, state, onAssign, onClose }: RainbowDialogProps) {
  const lowest = CORE_SUBJECTS.reduce((a, b) => (state.stones[b] < state.stones[a] ? b : a))
  return (
    <AppDialog
      open={stage !== null}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      closeDisabled={stage?.step === 'assign'}
      title={stage?.step === 'box' ? '盲盒打开啦' : '彩虹果！'}
      icon="🌈"
      description={
        stage?.step === 'assign' ? '它变成了一颗彩虹石，你想把它放进哪一堆？' : '盲盒不会抽到惩罚，也不扣石头。'
      }
    >
      {stage?.step === 'assign' && (
        <Flex direction="column" gap="2">
          {CORE_SUBJECTS.map((c) => (
            <Button
              key={c}
              size="3"
              variant={c === lowest ? 'solid' : 'soft'}
              color={SUBJECT_BADGE[c]}
              onClick={() => onAssign(c)}
            >
              {SUBJECTS[c].stone}（现在 {state.stones[c]} 颗）{c === lowest ? ' · 最缺这一堆' : ''}
            </Button>
          ))}
        </Flex>
      )}
      {stage?.step === 'box' && (
        <Flex direction="column" gap="3">
          <Text size="5" weight="bold" align="center">
            🎁 {stage.prize}
          </Text>
          <Text size="2" color="gray" align="center">
            彩虹石已放进{SUBJECTS[stage.subject].stone}那一堆。这里是示例奖励，真实版复用首页「幸运抽奖」的奖励池。
          </Text>
          <Button size="3" onClick={onClose}>
            收下
          </Button>
        </Flex>
      )}
    </AppDialog>
  )
}

// ---------- 兑换确认 ----------
type ExchangeDialogProps = {
  open: boolean
  n: number
  onConfirm: () => void
  onClose: () => void
}

export function ExchangeDialog({ open, n, onConfirm, onClose }: ExchangeDialogProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title="换一份心愿"
      icon="🎁"
      description={`红玛瑙、黄水晶、蓝宝石各扣 ${n} 颗，多出来的留在原堆。心愿在线下由爸爸妈妈兑现。`}
    >
      <Flex gap="2" justify="end">
        <Button variant="soft" color="gray" onClick={onClose}>
          再想想
        </Button>
        <Button onClick={onConfirm}>确认兑换</Button>
      </Flex>
    </AppDialog>
  )
}

// ---------- 家长设置（预览） ----------
type ParentDialogProps = {
  open: boolean
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
}

function rangeOptions([lo, hi]: readonly [number, number]): { value: string; label: string }[] {
  return Array.from({ length: hi - lo + 1 }, (_, i) => ({ value: String(lo + i), label: String(lo + i) }))
}

export function ParentDialog({ open, settings, onChange, onClose }: ParentDialogProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title="时间树设置（预览）"
      icon="🔒"
      description="真实版放在「用户配置」里，需要家长密码，修改从下一个 0 点生效。原型里直接生效，方便试玩。"
    >
      <Flex direction="column" gap="4">
        <Flex align="center" justify="between" gap="3">
          <Flex direction="column">
            <Text size="3" weight="bold">
              几朵花结一个苹果（K）
            </Text>
            <Text size="1" color="gray">
              越大，苹果越难得
            </Text>
          </Flex>
          <FormSelect
            ariaLabel="几朵花结一个苹果"
            value={String(settings.k)}
            options={rangeOptions(K_RANGE)}
            onValueChange={(v) => onChange({ k: Number(v) })}
          />
        </Flex>
        <Flex align="center" justify="between" gap="3">
          <Flex direction="column">
            <Text size="3" weight="bold">
              每种石头兑换所需颗数（N）
            </Text>
            <Text size="1" color="gray">
              红、黄、蓝都要够
            </Text>
          </Flex>
          <FormSelect
            ariaLabel="每种石头兑换所需颗数"
            value={String(settings.n)}
            options={rangeOptions(N_RANGE)}
            onValueChange={(v) => onChange({ n: Number(v) })}
          />
        </Flex>
        <Text size="1" color="gray">
          按 Rosie 现在的作业量（一周 92 朵花），K = 2、N = 8 时，瓶颈是数学，约一周换一份。
        </Text>
      </Flex>
    </AppDialog>
  )
}

// ---------- 怎么玩 + 图例 + 预览控制 ----------
type LegendColor = 'green' | 'sky' | 'pink' | 'red' | 'amber' | 'blue' | 'violet' | 'gray' | 'brown'

const LEGEND: { color: LegendColor; name: string; note: string }[] = [
  { color: 'green', name: '花苞', note: '青绿色，长在某一天的叶区里，顶上的小点是学科色' },
  { color: 'sky', name: '泡泡', note: '放学以后飘在树旁边，同时最多 4 个' },
  { color: 'pink', name: '鲜花', note: '戳破泡泡后开在今天的叶区，点一下浇水，越浇越大' },
  { color: 'red', name: '红苹果', note: '语文，摘下变红玛瑙' },
  { color: 'amber', name: '黄苹果', note: '数学，摘下变黄水晶' },
  { color: 'blue', name: '蓝苹果', note: '英语，摘下变蓝宝石' },
  { color: 'green', name: '绿苹果', note: '生活事项，摘下变绿松石，不参与兑换' },
  { color: 'violet', name: '彩虹果', note: '彩虹条纹加金色虚线圈，摘下选一堆放彩虹石，再开盲盒' },
  { color: 'gray', name: '灰色花苞', note: '过了计划那天没做完的事，留在原叶区，可补做' },
  { color: 'brown', name: '年轮', note: '树干上的圈，是已经收起的空历史叶区' },
]

const HOW_TO = [
  '点「放学了」，今天的花苞和灰色花苞变成泡泡，同时最多 4 个。',
  '点泡泡，做完后戳破，树上今天的叶区开出 1 到 4 朵花，得到阳光和水滴。',
  '点开花的花浇水，花会越长越大；阳光魔法让所有花一起长大。浇水不影响苹果数量。',
  '点树上的花苞，可以放进泡泡，或改到别的一天、放进「先不做」。',
  '点「模拟过 0 点」：当天的花按学科每 K 朵结一个苹果，没做完的花苞变灰，叶区向前滚动一天。',
  '点苹果摘下来，掉同色石头；彩虹果让你选一堆放彩虹石，再开盲盒。红、黄、蓝都够 N 颗，才能换心愿。',
]

type HelpDialogProps = {
  open: boolean
  skyValue: string
  skyOptions: { value: string; label: string }[]
  onSkyChange: (value: string) => void
  pity: number
  k: number
  n: number
  onReset: () => void
  onClose: () => void
}

export function HelpDialog({ open, skyValue, skyOptions, onSkyChange, pity, k, n, onReset, onClose }: HelpDialogProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
      title="怎么玩"
      icon="❓"
      description="可玩原型：假数据，只在浏览器内存里运行，刷新就回到初始样例。"
    >
      <Flex direction="column" gap="4">
        <ol className="flex list-decimal flex-col gap-1.5 pl-5">
          {HOW_TO.map((line) => (
            <li key={line}>
              <Text size="2">{line}</Text>
            </li>
          ))}
        </ol>
        <Flex direction="column" gap="2">
          <Text size="3" weight="bold">
            图例
          </Text>
          {LEGEND.map((item) => (
            <Flex key={item.name} align="start" gap="2">
              <Badge color={item.color} variant="soft" radius="full" className="shrink-0">
                {item.name}
              </Badge>
              <Text size="2" color="gray">
                {item.note}
              </Text>
            </Flex>
          ))}
        </Flex>
        <Flex align="center" gap="3" wrap="wrap">
          <Text size="2" weight="bold">
            预览控制
          </Text>
          <FormSelect ariaLabel="天空" value={skyValue} options={skyOptions} onValueChange={onSkyChange} />
          <Button variant="soft" color="gray" onClick={onReset}>
            重置样例
          </Button>
          <Text size="1" color="gray">
            K = {k}，N = {n}（在「家长」里调）· 彩虹保底 {pity}/20
          </Text>
        </Flex>
      </Flex>
    </AppDialog>
  )
}
