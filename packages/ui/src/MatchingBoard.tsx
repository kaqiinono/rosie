'use client'

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Badge, Button, Flex, Grid, Text } from './themes'

export type MatchingBoardItem = {
  id: string
  label: string
  /** Position in the illustration, as percentages. */
  position?: { x: number; y: number }
}
export type MatchingBoardProps = {
  items: readonly MatchingBoardItem[]
  options: readonly { id: string; label: string }[]
  value: Readonly<Record<string, string>>
  onValueChange: (value: Record<string, string>) => void
  allowReuse?: boolean
  readOnly?: boolean
  /** Opt-in text matching layout; illustrations retain their original layout. */
  layout?: 'stacked' | 'columns'
  illustration?: { src: string; width: number; height: number; alt: string; displayWidth?: number; fit?: 'responsive' | 'scroll' }
  onIllustrationPreview?: (event: MouseEvent<HTMLButtonElement>) => void
}

/** Several prompts beside a similarly tall option list keep the connectors readable. */
function prefersSideBySide(itemCount: number, optionCount: number) {
  return itemCount >= 2 && optionCount <= Math.max(itemCount + 1, Math.ceil(itemCount * 1.6))
}

/** Two taps connect an item and an option. No grading or persistence. */
export function MatchingBoard({ items, options, value, onValueChange, allowReuse = false, readOnly = false, illustration, onIllustrationPreview, layout = 'stacked' }: MatchingBoardProps) {
  const paper = layout === 'columns' && !illustration
  // One prompt, or a much taller option list, stacks the word bank underneath.
  const columns = paper && prefersSideBySide(items.length, options.length)
  const [selected, setSelected] = useState(items[0]?.id ?? '')
  const [connection, setConnection] = useState<string | null>(null)
  const [path, setPath] = useState('')
  const [paths, setPaths] = useState<{ id: string; d: string }[]>([])
  const [announcement, setAnnouncement] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const illustrationViewport = useRef<HTMLDivElement>(null)
  const sources = useRef(new Map<string, HTMLButtonElement>())
  const questionRows = useRef(new Map<string, HTMLDivElement>())
  const destinations = useRef(new Map<string, HTMLButtonElement>())
  const current = items.find(item => item.id === selected) ?? items[0]
  const completed = items.filter(item => value[item.id]).length

  const updateLine = useCallback(() => {
    const board = root.current
    if (columns) {
      if (!board) return
      const origin = board.getBoundingClientRect()
      setPaths(items.flatMap(item => {
        const from = sources.current.get(item.id)
        const to = destinations.current.get(value[item.id])
        if (!from || !to) return []
        const a = from.getBoundingClientRect(), b = to.getBoundingClientRect()
        const x1 = a.right - origin.left, y1 = a.top + a.height / 2 - origin.top
        const x2 = b.left - origin.left, y2 = b.top + b.height / 2 - origin.top
        const middle = (x1 + x2) / 2
        return [{ id: item.id, d: `M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}` }]
      }))
      return
    }
    const from = connection ? sources.current.get(connection) : undefined
    const to = connection && value[connection] ? destinations.current.get(value[connection]) : undefined
    if (!board || !from || !to) { setPath(''); return }
    const origin = board.getBoundingClientRect()
    const a = from.getBoundingClientRect()
    const b = to.getBoundingClientRect()
    const viewport = illustrationViewport.current?.getBoundingClientRect()
    const x = a.left + a.width / 2
    if (viewport && (x < viewport.left || x > viewport.right)) { setPath(''); return }
    const x1 = x - origin.left
    const y1 = a.bottom - origin.top
    const x2 = b.left + b.width / 2 - origin.left
    const y2 = b.top - origin.top
    setPath(`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`)
  }, [columns, items, connection, value])

  useEffect(() => {
    const observer = new ResizeObserver(updateLine)
    if (root.current) observer.observe(root.current)
    sources.current.forEach(node => observer.observe(node))
    questionRows.current.forEach(node => observer.observe(node))
    destinations.current.forEach(node => observer.observe(node))
    const frame = requestAnimationFrame(updateLine)
    window.addEventListener('resize', updateLine)
    window.addEventListener('scroll', updateLine, true)
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateLine)
      window.removeEventListener('scroll', updateLine, true)
    }
  }, [updateLine])

  const select = (id: string) => { setSelected(id); setConnection(value[id] ? id : null) }
  const connect = (optionId: string) => {
    if (readOnly || !current || (!allowReuse && items.some(item => item.id !== current.id && value[item.id] === optionId))) return
    const next = { ...value, [current.id]: optionId }
    onValueChange(next)
    setConnection(current.id)
    const index = items.findIndex(item => item.id === current.id)
    const remaining = [...items.slice(index + 1), ...items.slice(0, index)].find(item => !next[item.id])
    if (remaining) setSelected(remaining.id)
    const label = options.find(option => option.id === optionId)?.label ?? optionId
    setAnnouncement(`${current.label} 已连接 ${label}。${remaining ? `接下来填写 ${remaining.label}。` : '全部完成，可以提交或点编号修改。'}`)
  }
  const numberButton = (item: MatchingBoardItem) => <Button
    ref={node => { if (node) sources.current.set(item.id, node); else sources.current.delete(item.id) }}
    size={columns ? '3' : '4'} variant={current?.id === item.id ? 'solid' : 'soft'}
    aria-pressed={current?.id === item.id} aria-label={`${item.label}${value[item.id] ? `，已选 ${value[item.id]}` : '，未填写'}`}
    onClick={() => select(item.id)}
  >{item.id}{value[item.id] ? ' ✓' : ''}</Button>

  return <Flex direction="column" gap="3">
    {illustration && onIllustrationPreview && <Flex><Button variant="soft" onClick={onIllustrationPreview}>放大题图与作答</Button></Flex>}
    <Flex justify={paper ? 'end' : 'between'} align="center" wrap="wrap" gap="2">{!paper && <Text>点编号，再点词语。填好后自动跳到下一空。</Text>}<Badge variant="soft">已完成 {completed}/{items.length}</Badge></Flex>
    <div ref={root} className="relative">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">{columns
        ? paths.map(line => <path key={line.id} d={line.d} fill="none" stroke="var(--accent-9)" strokeWidth={line.id === connection ? 3 : 2} opacity={line.id === connection ? 1 : 0.45} strokeLinecap="round" />)
        : <path d={path} fill="none" stroke="var(--accent-9)" strokeWidth="3" strokeLinecap="round" />}</svg>
      <Grid
        columns={columns ? '2' : '1'}
        style={columns ? { display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', columnGap: 'clamp(3.5rem, 8vw, 6rem)' } : undefined}
        gapX={columns ? undefined : { initial: '5', sm: '8' }} gapY="5" align="start"
      >
        {illustration ? <div ref={illustrationViewport} className="min-w-0 overflow-x-auto pb-2" aria-label={illustration.fit === 'responsive' ? '题图' : '题图，小屏可左右滑动'}>
          <div className={illustration.fit === 'responsive' ? 'relative w-full' : illustration.displayWidth === undefined ? 'relative min-w-[520px]' : 'relative max-w-full'} style={{ ...(illustration.fit === 'responsive' ? { maxWidth: illustration.displayWidth } : { width: illustration.displayWidth }), aspectRatio: `${illustration.width} / ${illustration.height}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated exam media URL */}
            <img src={illustration.src} alt={illustration.alt} width={illustration.width} height={illustration.height} className="block h-auto w-full" onLoad={updateLine} />
            {items.map(item => item.position && <div key={item.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${item.position.x}%`, top: `${item.position.y}%` }}>{numberButton(item)}</div>)}
          </div>
        </div> : <Flex direction="column" align="start" gap="3">
          {paper && <Text size="2" weight="bold">题目</Text>}
          <Flex direction={paper && !columns ? 'row' : 'column'} align="start" gap={columns ? '4' : '2'} wrap="wrap" className="w-full">
          {items.map(item => paper
            ? <div key={item.id} ref={node => { if (node) questionRows.current.set(item.id, node); else questionRows.current.delete(item.id) }} className="min-w-0">
              <Button
                ref={node => { if (node) sources.current.set(item.id, node); else sources.current.delete(item.id) }}
                size="3" variant={current?.id === item.id ? 'solid' : 'soft'}
                className="w-fit max-w-full h-auto min-h-11 whitespace-normal text-left"
                style={{ maxWidth: 'min(100%, 28rem)' }}
                aria-pressed={current?.id === item.id}
                aria-label={`${item.id}. ${item.label}${value[item.id] ? `，已选 ${value[item.id]}` : '，未填写'}`}
                onClick={() => select(item.id)}
              >
                <Flex as="span" align="center" gap="2" minWidth="0" py="2">
                  <Text as="span" weight="regular" color={current?.id === item.id ? undefined : 'gray'} wrap="nowrap">{item.id}{value[item.id] ? ' ✓' : ''}</Text>
                  <Text as="span" size="3" weight="regular" wrap="wrap" lang="en" className="min-w-0 break-words">{item.label}</Text>
                </Flex>
              </Button>
            </div>
            : <Flex key={item.id} align="center" gap="3">{numberButton(item)}<Text size="3" weight="regular" lang="en">{item.label}</Text></Flex>)}
          </Flex>
        </Flex>}
        <Flex direction="column" align="start" gap="3">
          <Flex align="center" gap="3">
            <Text size={paper ? '2' : undefined} weight="bold">{paper ? '选项' : readOnly ? '点编号查看连线' : `正在填写：${current?.label ?? ''}`}</Text>
            {paper && <Button variant="ghost" size="2" disabled={readOnly || !current || !value[current.id]} onClick={() => {
              if (!current) return
              const next = { ...value }; delete next[current.id]; onValueChange(next); setConnection(null)
              setAnnouncement(`已清除 ${current.label}，词语已放回词库。`)
            }}>清除连线</Button>}
          </Flex>
          <Flex direction={columns ? 'column' : 'row'} align="start" gap={columns ? '4' : '2'} wrap="wrap" aria-label="共享词库" className="w-full">
              {options.map(option => {
                const owners = items.filter(item => value[item.id] === option.id)
                const usedElsewhere = !allowReuse && owners.some(item => item.id !== current?.id)
                return <Button key={option.id} ref={node => { if (node) destinations.current.set(option.id, node); else destinations.current.delete(option.id) }}
                  size="3" variant={value[current?.id ?? ''] === option.id ? 'solid' : 'soft'}
                  className={paper ? 'w-fit max-w-full h-auto min-h-11 whitespace-normal break-words' : undefined}
                  style={paper ? { maxWidth: 'min(100%, 28rem)' } : undefined}
                  disabled={readOnly || usedElsewhere} aria-pressed={value[current?.id ?? ''] === option.id}
                  onClick={() => connect(option.id)}><Text as="span" size="3" weight="regular" wrap={paper ? 'wrap' : undefined}>{option.label}{owners.length ? ` · ${owners.map(item => item.id).join(', ')}` : ''}</Text></Button>
              })}
            </Flex>
            {!paper && <Button variant="ghost" size="2" disabled={readOnly || !current || !value[current.id]} onClick={() => {
              if (!current) return
              const next = { ...value }; delete next[current.id]; onValueChange(next); setConnection(null)
              setAnnouncement(`已清除 ${current.label}，词语已放回词库。`)
            }}>清除当前答案</Button>}
        </Flex>
      </Grid>
    </div>
    <Flex gap="2" wrap="wrap" aria-label="已填答案">{items.filter(item => value[item.id]).map(item => <Button key={item.id} variant="soft" size="2" onClick={() => {
      select(item.id)
      sources.current.get(item.id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }}>{item.id} · {options.find(option => option.id === value[item.id])?.label ?? value[item.id]}</Button>)}</Flex>
    {paper
      ? <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      : <Text size="2" color="gray" role="status" aria-live="polite">{announcement || (allowReuse ? '选项可以重复使用。' : '每个词语只能使用一次；点击已填编号可修改。')}</Text>}
  </Flex>
}
