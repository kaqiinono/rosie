'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCalcSettings } from '@/hooks/useCalcSettings'
import { useCalcWallet } from '@/hooks/useCalcWallet'
import { useCalcMistakes } from '@/hooks/useCalcMistakes'
import CalcAppHeader from '@/components/calc/CalcAppHeader'
import QuickPracticeModal from '@/components/calc/QuickPracticeModal'
import TimeLimitsSection from '@/components/calc/TimeLimitsSection'
import { LEVELS, formatLevel, levelSpec } from '@/utils/calc-levels'
import { enabledLevels } from '@/utils/calc-helpers'
import type { CalcCategory, CalcLevel } from '@/utils/type'

interface ToggleRowProps {
  label: string
  description?: string
  value: boolean
  onChange: (v: boolean) => void
}

function ToggleRow({ label, description, value, onChange }: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-all"
      style={{
        background: value ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${value ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <div className="min-w-0">
        <div className="text-[14px] font-extrabold" style={{ color: value ? '#c4b5fd' : 'rgba(245,243,255,0.7)' }}>
          {label}
        </div>
        {description && (
          <div className="text-[11px] mt-0.5" style={{ color: 'rgba(245,243,255,0.35)' }}>
            {description}
          </div>
        )}
      </div>
      <span
        className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors"
        style={{ background: value ? '#7c3aed' : 'rgba(255,255,255,0.1)' }}
      >
        <span
          className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
          style={{ transform: value ? 'translateX(22px)' : 'translateX(4px)' }}
        />
      </span>
    </button>
  )
}

interface LevelChipProps {
  level: CalcLevel
  label: string
  selected: boolean
  onToggle: () => void
}

function LevelChip({ level, label, selected, onToggle }: LevelChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left transition-all"
      style={{
        background: selected ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${selected ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <div
        className="text-[12px] font-extrabold leading-none"
        style={{ color: selected ? '#c4b5fd' : 'rgba(245,243,255,0.55)' }}
      >
        {formatLevel(level)}
      </div>
      <div className="text-[10px] leading-tight" style={{ color: 'rgba(245,243,255,0.4)' }}>
        {label}
      </div>
    </button>
  )
}

const CATEGORY_LABELS: Record<CalcCategory, string> = {
  addsub: '加减法',
  muldiv: '乘除法',
  mixed: '混合运算',
}

export default function CalcSettingsPage() {
  const { user } = useAuth()
  const { settings, update, isLoading } = useCalcSettings(user)
  const wallet = useCalcWallet(user)
  const { mistakes } = useCalcMistakes(user)
  const [practiceOpen, setPracticeOpen] = useState(false)

  const numericLevels = useMemo(() => LEVELS.filter(l => l.level !== 'C'), [])
  const levelsByCategory = useMemo(() => {
    const groups: Record<CalcCategory, typeof LEVELS> = { addsub: [], muldiv: [], mixed: [] }
    for (const spec of LEVELS) groups[spec.category].push(spec)
    return groups
  }, [])

  const selectedSet = useMemo(
    () => new Set<CalcLevel>(settings.freeModeLevels),
    [settings.freeModeLevels],
  )

  const isLevelSelected = (level: CalcLevel) => selectedSet.has(level)

  const toggleLevel = (level: CalcLevel) => {
    const next = new Set(selectedSet)
    if (next.has(level)) next.delete(level)
    else next.add(level)
    update({ freeModeLevels: Array.from(next) })
  }

  /** True if every level in `category` is currently selected in freeModeLevels. */
  const categoryAllSelected = (cat: CalcCategory): boolean => {
    const levels = levelsByCategory[cat]
    if (levels.length === 0) return false
    return levels.every(l => selectedSet.has(l.level))
  }

  /** Bulk-add or bulk-remove all levels of a category from freeModeLevels. */
  const setCategorySelected = (cat: CalcCategory, on: boolean) => {
    const levels = levelsByCategory[cat]
    const next = new Set(selectedSet)
    if (on) for (const l of levels) next.add(l.level)
    else for (const l of levels) next.delete(l.level)
    update({ freeModeLevels: Array.from(next) })
  }

  /** Category toggle in normal mode = simple boolean setting. In free mode = bulk-select. */
  const getCategoryToggleValue = (cat: CalcCategory): boolean => {
    if (settings.freeMode) return categoryAllSelected(cat)
    if (cat === 'addsub') return settings.enableAddSub
    if (cat === 'muldiv') return settings.enableMulDiv
    return settings.enableMixed
  }
  const setCategoryToggle = (cat: CalcCategory, v: boolean) => {
    if (settings.freeMode) {
      setCategorySelected(cat, v)
      return
    }
    if (cat === 'addsub') update({ enableAddSub: v })
    else if (cat === 'muldiv') update({ enableMulDiv: v })
    else update({ enableMixed: v })
  }

  /** Enable free mode: pre-populate selection from currently enabled levels (Q3=b). */
  const handleFreeModeToggle = (on: boolean) => {
    if (on && settings.freeModeLevels.length === 0) {
      const initial = enabledLevels(settings, true)
      update({ freeMode: true, freeModeLevels: initial })
    } else {
      update({ freeMode: on })
    }
  }

  if (isLoading) {
    return (
      <>
        <CalcAppHeader
          balance={wallet.balance}
          soundEnabled={settings.soundEnabled}
          onToggleSound={() => update({ soundEnabled: !settings.soundEnabled })}
          title="设置"
          backHref="/calc"
          backLabel="口算"
        />
        <div
          className="mx-auto max-w-[640px] px-4 py-10 text-center text-[13px]"
          style={{ color: 'rgba(196,181,253,0.4)' }}
        >
          加载中…
        </div>
      </>
    )
  }

  const currentSpec = levelSpec(settings.currentLevel)
  const selectedCount = settings.freeModeLevels.length

  const selectStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1.5px solid rgba(139,92,246,0.3)',
    color: '#c4b5fd',
    borderRadius: '0.5rem',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 800,
    outline: 'none',
    width: '100%',
    appearance: 'auto' as const,
  }

  const practiceSubtitle = settings.freeMode
    ? `自由练习 · 已选 ${selectedCount} 种题型`
    : `Lv.${settings.currentLevel} · ${currentSpec.label}`

  return (
    <>
      <CalcAppHeader
        balance={wallet.balance}
        soundEnabled={settings.soundEnabled}
        onToggleSound={() => update({ soundEnabled: !settings.soundEnabled })}
        title="口算设置"
        backHref="/calc"
        backLabel="口算"
      />

      <main className="mx-auto max-w-[640px] px-4 pt-5 pb-12 space-y-5 relative">

        {/* Operation types — in free mode these become bulk-select shortcuts */}
        <section>
          <h2
            className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
            style={{ color: 'rgba(196,181,253,0.45)' }}
          >
            运算类型
            {settings.freeMode && (
              <span className="ml-2 normal-case tracking-normal" style={{ color: 'rgba(196,181,253,0.3)' }}>
                · 点击 = 该类别全选 / 取消
              </span>
            )}
          </h2>
          <div className="space-y-2">
            <ToggleRow
              label="加减法"
              description="10 到 100 以内加减（档 1-5）"
              value={getCategoryToggleValue('addsub')}
              onChange={(v) => setCategoryToggle('addsub', v)}
            />
            <ToggleRow
              label="乘除法"
              description="乘法口诀 · 除法 · ×10-19 拓展（档 6-14, 16, 18）"
              value={getCategoryToggleValue('muldiv')}
              onChange={(v) => setCategoryToggle('muldiv', v)}
            />
            <ToggleRow
              label="混合运算"
              description="两运算符 + 三运算符挑战题（档 15, 17, 挑战）"
              value={getCategoryToggleValue('mixed')}
              onChange={(v) => setCategoryToggle('mixed', v)}
            />
          </div>
        </section>

        {/* Difficulty / mode */}
        <section>
          <h2
            className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
            style={{ color: 'rgba(196,181,253,0.45)' }}
          >
            难度
          </h2>
          <div
            className="rounded-xl p-4 space-y-3"
            style={{
              background: 'rgba(139,92,246,0.06)',
              border: '1px solid rgba(139,92,246,0.15)',
            }}
          >
            <ToggleRow
              label="自由练习"
              description="自选题型混合出题；关闭则按进度推进（带 A/B/C 评估与自适应升档）"
              value={settings.freeMode}
              onChange={handleFreeModeToggle}
            />

            {!settings.freeMode && (
              <>
                <div>
                  <div
                    className="text-[11px] font-bold mb-1"
                    style={{ color: 'rgba(196,181,253,0.5)' }}
                  >
                    当前难度
                  </div>
                  <select
                    value={settings.currentLevel}
                    onChange={(e) => update({ currentLevel: Number(e.target.value) })}
                    style={selectStyle}
                  >
                    {numericLevels.map(l => (
                      <option key={l.level as number} value={l.level as number}>
                        Lv.{l.level} · {l.label}
                      </option>
                    ))}
                  </select>
                  <div className="text-[10px] mt-1" style={{ color: 'rgba(245,243,255,0.3)' }}>
                    {currentSpec.label}
                  </div>
                </div>

                <ToggleRow
                  label="自适应升档"
                  description="最近 30 题正确率 >85% 时自动解锁下一档（最高 Lv.18）"
                  value={settings.adaptive}
                  onChange={(v) => update({ adaptive: v })}
                />
              </>
            )}

            {settings.freeMode && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div
                    className="text-[11px] font-bold"
                    style={{ color: 'rgba(196,181,253,0.5)' }}
                  >
                    挑选题型 · 已选 {selectedCount} 种
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => update({ freeModeLevels: LEVELS.map(l => l.level) })}
                      className="rounded-md px-2 py-1 text-[10px] font-extrabold"
                      style={{
                        background: 'rgba(139,92,246,0.15)',
                        border: '1px solid rgba(139,92,246,0.3)',
                        color: '#c4b5fd',
                      }}
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      onClick={() => update({ freeModeLevels: [] })}
                      className="rounded-md px-2 py-1 text-[10px] font-extrabold"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(245,243,255,0.55)',
                      }}
                    >
                      清空
                    </button>
                  </div>
                </div>

                {(['addsub', 'muldiv', 'mixed'] as const).map((cat) => {
                  const levels = levelsByCategory[cat]
                  if (levels.length === 0) return null
                  return (
                    <div key={cat}>
                      <div
                        className="text-[10px] font-extrabold uppercase tracking-wider mb-1.5"
                        style={{ color: 'rgba(196,181,253,0.35)' }}
                      >
                        {CATEGORY_LABELS[cat]}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                        {levels.map((l) => (
                          <LevelChip
                            key={String(l.level)}
                            level={l.level}
                            label={l.label}
                            selected={isLevelSelected(l.level)}
                            onToggle={() => toggleLevel(l.level)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}

                {selectedCount === 0 && (
                  <div
                    className="rounded-lg px-3 py-2 text-[11px]"
                    style={{
                      background: 'rgba(244,114,182,0.1)',
                      border: '1px solid rgba(244,114,182,0.3)',
                      color: '#fbcfe8',
                    }}
                  >
                    至少选择一个题型，否则出题将退回到 Lv.1。
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Audio */}
        <section>
          <h2
            className="mb-2 text-[11px] font-extrabold tracking-widest uppercase"
            style={{ color: 'rgba(196,181,253,0.45)' }}
          >
            音效
          </h2>
          <ToggleRow
            label="开启答题音效"
            description="答对、答错、金币、挑战、升档等提示音"
            value={settings.soundEnabled}
            onChange={(v) => update({ soundEnabled: v })}
          />
        </section>

        {/* Time limits */}
        <TimeLimitsSection
          overrides={settings.timeLimitOverrides}
          onChange={(next) => update({ timeLimitOverrides: next })}
        />

        {/* Info */}
        <section
          className="rounded-xl px-4 py-3 text-[11px]"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            color: 'rgba(245,243,255,0.3)',
          }}
        >
          上次配置：题量 {settings.lastCount} 题 · 限时{' '}
          {settings.lastTimeLimit === 0 ? '不限' : `${settings.lastTimeLimit / 60} 分钟`}
        </section>

        {/* Try-out button */}
        <button
          type="button"
          onClick={() => setPracticeOpen(true)}
          className="w-full rounded-2xl px-5 py-3.5 text-[15px] font-black text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #db2777)',
            boxShadow: '0 6px 24px rgba(139,92,246,0.3)',
          }}
        >
          ✨ 用当前设置练一练！
        </button>
      </main>

      {practiceOpen && (
        <QuickPracticeModal
          title={settings.freeMode ? '试试自由练习' : '试试当前难度'}
          subtitle={practiceSubtitle}
          settings={settings}
          mistakes={mistakes}
          buildCount={settings.lastCount}
          soundEnabled={settings.soundEnabled}
          onClose={() => setPracticeOpen(false)}
          doneLabel="完成，回到设置 →"
        />
      )}
    </>
  )
}
