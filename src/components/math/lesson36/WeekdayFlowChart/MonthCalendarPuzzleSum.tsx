import { useState, useCallback, useEffect } from "react";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const weekdayInputStyle = `
  .weekday-input::placeholder { color: rgba(255,255,255,0.55); }
`;

interface Props {
  /** 本月总天数，28 | 29 | 30 | 31 */
  totalDays?: 28 | 29 | 30 | 31;
}

const COL_THEME = [
  { badge: "#9095a8", cell: "#d8dce8", light: "#eceef5", faded: "#f4f5f8" },
  { badge: "#8b7ec4", cell: "#d4cef0", light: "#eceaf8", faded: "#f5f3fb" },
  { badge: "#4a7ec8", cell: "#c4d8f4", light: "#e4edfb", faded: "#f0f5fd" },
  { badge: "#3f9e7c", cell: "#b8e0d0", light: "#daf0e8", faded: "#eef8f4" },
  { badge: "#b89030", cell: "#e8d898", light: "#f6f0d4", faded: "#faf7ec" },
  { badge: "#c88898", cell: "#f4d4dc", light: "#faeaee", faded: "#fdf4f6" },
  { badge: "#b0a070", cell: "#ede4c8", light: "#f7f3e4", faded: "#faf8f2" },
];

const WEEKDAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function parseWeekday(s: string): number {
  const t = s.trim();
  const exact = WEEKDAY_NAMES.indexOf(t);
  if (exact !== -1) return exact;
  const shorts = ["一", "二", "三", "四", "五", "六", "日"];
  const short = shorts.indexOf(t);
  if (short !== -1) return short;
  const num = parseInt(t, 10);
  if (!isNaN(num) && num >= 1 && num <= 7) return num - 1;
  return -1;
}

// ─────────────────────────────────────────────────────────────
// Grid helpers
// ─────────────────────────────────────────────────────────────

/**
 * 从第一行的7个字符串输入中找到第一个有效数字作锚点，
 * 推导出完整第一行数字（允许 ≤0 或 >totalDays，后续网格计算时过滤）。
 */
function deriveFirstRow(inputs: string[]): (number | null)[] {
  let anchorCol = -1;
  let anchorVal = -1;
  for (let col = 0; col < 7; col++) {
    const n = parseInt(inputs[col], 10);
    if (!isNaN(n) && n >= 1) {
      anchorCol = col;
      anchorVal = n;
      break;
    }
  }
  if (anchorCol === -1) return Array(7).fill(null);
  return Array.from({ length: 7 }, (_, col) => anchorVal + (col - anchorCol));
}

/**
 * 以第一行为基础，向下每行 +7，超出 totalDays 或 <1 则为 null。
 */
function computeGrid(
  firstRow: (number | null)[],
  totalDays: number
): (number | null)[][] {
  return Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 7 }, (_, col) => {
      const base = firstRow[col];
      if (base === null) return null;
      const val = base + row * 7;
      return val >= 1 && val <= totalDays ? val : null;
    })
  );
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function MonthCalendarPuzzle({ totalDays = 31 }: Props) {
  // 星期胶囊
  const [weekLabels, setWeekLabels] = useState<string[]>(() => Array(7).fill(""));
  const [weekAutoFilled, setWeekAutoFilled] = useState<boolean[]>(() => Array(7).fill(false));

  // 第一行7个格子的用户输入
  const [firstRowInputs, setFirstRowInputs] = useState<string[]>(() => Array(7).fill(""));

  useEffect(() => {
    setFirstRowInputs(Array(7).fill(""));
  }, [totalDays]);

  // 推导网格
  const firstRow = deriveFirstRow(firstRowInputs);
  const grid = computeGrid(firstRow, totalDays);

  // 各列之和
  const colSums: (number | null)[] = Array.from({ length: 7 }, (_, col) => {
    let sum = 0;
    let hasAny = false;
    for (let row = 0; row < 5; row++) {
      const v = grid[row][col];
      if (v !== null) { sum += v; hasAny = true; }
    }
    return hasAny ? sum : null;
  });

  // 星期胶囊
  const handleWeekLabel = useCallback((col: number, raw: string) => {
    const input = raw.slice(0, 3);
    if (input === "") {
      setWeekLabels(Array(7).fill(""));
      setWeekAutoFilled(Array(7).fill(false));
      return;
    }
    const dayIndex = parseWeekday(input);
    if (dayIndex !== -1) {
      const newLabels = Array.from({ length: 7 }, (_, k) =>
        WEEKDAY_NAMES[(dayIndex + (k - col + 7)) % 7]
      );
      const newAuto = Array(7).fill(true);
      newAuto[col] = false;
      setWeekLabels(newLabels);
      setWeekAutoFilled(newAuto);
    } else {
      setWeekLabels((prev) => { const n = [...prev]; n[col] = input; return n; });
      setWeekAutoFilled((prev) => { const n = [...prev]; n[col] = false; return n; });
    }
  }, []);

  // 第一行格子输入
  const handleFirstRowInput = useCallback((col: number, raw: string) => {
    const trimmed = raw.replace(/[^0-9]/g, "").slice(0, 2);
    setFirstRowInputs((prev) => {
      const next = [...prev];
      next[col] = trimmed;
      return next;
    });
  }, []);

  const handleReset = () => {
    setFirstRowInputs(Array(7).fill(""));
    setWeekLabels(Array(7).fill(""));
    setWeekAutoFilled(Array(7).fill(false));
  };

  const hasAnyInput = firstRowInputs.some((v) => v !== "");

  return (
    <div className="flex flex-col items-center gap-4 select-none font-sans">
      <style>{weekdayInputStyle}</style>

      {/* ══ 日历卡片 ══ */}
      <div
        className="rounded-3xl bg-white/70 backdrop-blur-sm flex flex-col"
        style={{
          padding: "16px",
          boxShadow: "0 4px 24px 0 rgba(0,0,0,0.10), 0 1px 4px 0 rgba(0,0,0,0.06)",
        }}
      >
        {/* 星期胶囊 */}
        <div className="flex gap-2">
          {Array.from({ length: 7 }, (_, col) => (
            <WeekdayInput
              key={col}
              col={col}
              value={weekLabels[col]}
              autoFilled={weekAutoFilled[col]}
              onChange={(v) => handleWeekLabel(col, v)}
            />
          ))}
        </div>

        <div style={{ height: "12px" }} />

        {/* 5×7 格子 */}
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, row) => (
            <div key={row} className="flex gap-2">
              {Array.from({ length: 7 }, (_, col) => {
                const computed = grid[row][col];

                if (row === 0) {
                  // 第一行：可输入
                  const userTyped = firstRowInputs[col] !== "";
                  return (
                    <CalendarCell
                      key={col}
                      col={col}
                      displayValue={
                        userTyped
                          ? firstRowInputs[col]
                          : computed !== null
                          ? String(computed)
                          : ""
                      }
                      state={userTyped ? "user" : computed !== null ? "derived" : "empty"}
                      editable
                      onChange={(v) => handleFirstRowInput(col, v)}
                    />
                  );
                }

                // row 1~4：只读
                return (
                  <CalendarCell
                    key={col}
                    col={col}
                    displayValue={computed !== null ? String(computed) : ""}
                    state={computed !== null ? "filled" : "faded"}
                    editable={false}
                    onChange={() => {}}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ══ 分隔 ══ */}
      <div className="flex items-center gap-2 w-full px-1">
        <div className="flex-1 border-t-2 border-dashed border-gray-300/80" />
        <span
          className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ color: "#a0aab4", background: "#eef0f3" }}
        >
          各列之和
        </span>
        <div className="flex-1 border-t-2 border-dashed border-gray-300/80" />
      </div>

      {/* ══ 求和行 ══ */}
      <div className="flex gap-2">
        {Array.from({ length: 7 }, (_, col) => (
          <SumCell key={col} col={col} sum={colSums[col]} />
        ))}
      </div>

      {/* ── 重置 ── */}
      <button
        onClick={handleReset}
        className="mt-1 px-4 py-1.5 rounded-full text-xs font-semibold
          bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400
          transition-colors border border-gray-200"
      >
        清空
      </button>

      {!hasAnyInput && (
        <p className="text-xs text-gray-400 -mt-1 text-center max-w-xs leading-relaxed">
          在第一行任意格输入日期，同列和同行自动推算
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function WeekdayInput({
  col, value, autoFilled, onChange,
}: {
  col: number; value: string; autoFilled: boolean; onChange: (v: string) => void;
}) {
  const theme = COL_THEME[col];
  return (
    <div
      className="w-14 h-10 rounded-full flex items-center justify-center border-2 shadow-sm overflow-hidden"
      style={{
        backgroundColor: theme.badge,
        borderColor: `color-mix(in srgb, ${theme.badge} 70%, black)`,
        opacity: autoFilled ? 0.72 : 1,
        transform: autoFilled ? "scale(0.95)" : "scale(1)",
        transition: "opacity 0.2s, transform 0.2s",
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={3}
        placeholder="周?"
        className="weekday-input w-full h-full bg-transparent text-center font-bold text-sm outline-none"
        style={{ color: "white", caretColor: "white" }}
      />
    </div>
  );
}

type CellState = "user" | "derived" | "empty" | "filled" | "faded";

function CalendarCell({
  col, displayValue, state, editable, onChange,
}: {
  col: number;
  displayValue: string;
  state: CellState;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  const theme = COL_THEME[col];

  // 背景色
  const bg: Record<CellState, string> = {
    user: theme.cell,       // 用户主动输入 → 饱和色
    derived: theme.light,   // 第一行推导 → 浅色
    empty: theme.cell,      // 第一行空格 → 同饱和色（待填）
    filled: theme.light,    // 下方行已知值 → 浅色
    faded: theme.faded,     // 超出当月 → 极浅，几乎消失
  };

  // 文字颜色 & 透明度
  const textColor: Record<CellState, string> = {
    user: "#1f2937",
    derived: theme.badge,
    empty: "#9ca3af",
    filled: "#374151",
    faded: theme.badge,
  };
  const textOpacity: Record<CellState, number> = {
    user: 1, derived: 0.9, empty: 1, filled: 0.65, faded: 0.18,
  };

  return (
    <div
      className="w-14 h-12 rounded-lg flex items-center justify-center border-2 border-white/80 shadow-sm"
      style={{ backgroundColor: bg[state], transition: "background-color 0.2s" }}
    >
      {editable ? (
        <input
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          maxLength={2}
          placeholder="?"
          className="w-full h-full bg-transparent text-center font-bold text-base outline-none rounded-lg placeholder-gray-300"
          style={{
            color: textColor[state],
            opacity: textOpacity[state],
            caretColor: theme.badge,
          }}
        />
      ) : (
        <span
          className="font-bold text-base"
          style={{ color: textColor[state], opacity: textOpacity[state] }}
        >
          {displayValue}
        </span>
      )}
    </div>
  );
}

function SumCell({ col, sum }: { col: number; sum: number | null }) {
  const theme = COL_THEME[col];
  const hasValue = sum !== null;
  return (
    <div
      className="w-14 h-11 rounded-xl flex items-center justify-center border-2 transition-all"
      style={{
        backgroundColor: hasValue ? theme.badge : "#f3f4f6",
        borderColor: hasValue ? `color-mix(in srgb, ${theme.badge} 65%, black)` : "#e5e7eb",
        boxShadow: hasValue ? `0 2px 8px 0 ${theme.badge}55` : "none",
      }}
    >
      {hasValue ? (
        <span className="text-base font-black text-white leading-none">{sum}</span>
      ) : (
        <span className="text-sm font-bold text-gray-300">—</span>
      )}
    </div>
  );
}
