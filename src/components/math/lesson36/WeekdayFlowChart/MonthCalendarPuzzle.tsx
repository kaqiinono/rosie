import { useState, useCallback, useEffect } from "react";

// 让胶囊输入框的 placeholder 显示为白色半透明
const weekdayInputStyle = `
  .weekday-input::placeholder { color: rgba(255,255,255,0.55); }
`;

// ─────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────

interface Props {
  /** 本月总天数，28 | 29 | 30 | 31 */
  totalDays?: 28 | 29 | 30 | 31;
}

// 每列（星期）的颜色主题
const COL_THEME = [
  { badge: "#9095a8", cell: "#d8dce8", light: "#eceef5" },
  { badge: "#8b7ec4", cell: "#d4cef0", light: "#eceaf8" },
  { badge: "#4a7ec8", cell: "#c4d8f4", light: "#e4edfb" },
  { badge: "#3f9e7c", cell: "#b8e0d0", light: "#daf0e8" },
  { badge: "#b89030", cell: "#e8d898", light: "#f6f0d4" },
  { badge: "#c88898", cell: "#f4d4dc", light: "#faeaee" },
  { badge: "#b0a070", cell: "#ede4c8", light: "#f7f3e4" },
];

// ─────────────────────────────────────────────────────────────
// Layout computation
// ─────────────────────────────────────────────────────────────

/**
 * 将 totalDays 个格子映射到网格位置。
 *
 * 网格共 5 行（row 0~4） × 7 列（col 0~6）。
 * - row 0：溢出行，只有最右边 extra 列有格子（extra = totalDays - 28）
 * - row 1~4：完整的 4×7 基础网格
 *
 * 格子按"日历真实顺序"编号（index 0 = 最左上角有格子的位置）：
 * 从左到右、从上到下扫描网格，依次给有格子的位置分配 index。
 */
function buildCellMap(totalDays: number): {
  cells: { row: number; col: number; index: number }[];
  extra: number;
} {
  const extra = totalDays - 28; // 0~3
  const cells: { row: number; col: number; index: number }[] = [];
  let idx = 0;

  for (let row = 0; row <= 4; row++) {
    for (let col = 0; col < 7; col++) {
      if (row === 0) {
        // 溢出行：只有右边 extra 列
        if (col >= 7 - extra) {
          cells.push({ row, col, index: idx++ });
        }
      } else {
        cells.push({ row, col, index: idx++ });
      }
    }
  }

  return { cells, extra };
}

// 标准星期名称表，用于识别和推导
const WEEKDAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

// 尝试从输入字符串识别是哪个星期（返回 0~6，识别不到返回 -1）
function parseWeekday(s: string): number {
  const trimmed = s.trim();
  // 精确匹配"周一"~"周日"
  const exact = WEEKDAY_NAMES.indexOf(trimmed);
  if (exact !== -1) return exact;
  // 兼容"一"~"日"单字
  const shorts = ["一", "二", "三", "四", "五", "六", "日"];
  const short = shorts.indexOf(trimmed);
  if (short !== -1) return short;
  // 兼容数字 1~7（1=周一 … 7=周日）
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 1 && num <= 7) return num - 1;
  return -1;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function MonthCalendarPuzzle({ totalDays = 31 }: Props) {
  const { cells, extra } = buildCellMap(totalDays);

  // 7个星期标题的输入值（初始全为空，用户自行填写"周几"）
  const [weekLabels, setWeekLabels] = useState<string[]>(() =>
    Array(7).fill("")
  );
  // 记录哪些胶囊是自动推导填入的（非用户主动输入），用于视觉区分
  const [weekAutoFilled, setWeekAutoFilled] = useState<boolean[]>(() =>
    Array(7).fill(false)
  );

  // values[index] = 用户输入的字符串（或自动填充的数字字符串）
  const [values, setValues] = useState<string[]>(() =>
    Array(totalDays).fill("")
  );

  // totalDays 变化时重置格子（不重置星期标题）
  useEffect(() => {
    setValues(Array(totalDays).fill(""));
  }, [totalDays]);

  const handleWeekLabel = useCallback((col: number, raw: string) => {
    const input = raw.slice(0, 3);

    if (input === "") {
      // 清空时重置所有
      setWeekLabels(Array(7).fill(""));
      setWeekAutoFilled(Array(7).fill(false));
      return;
    }

    const dayIndex = parseWeekday(input);

    if (dayIndex !== -1) {
      // 识别成功：推导全部7列
      const newLabels = Array(7).fill("");
      const newAutoFilled = Array(7).fill(true);
      for (let k = 0; k < 7; k++) {
        const offset = (k - col + 7) % 7;
        newLabels[k] = WEEKDAY_NAMES[(dayIndex + offset) % 7];
      }
      // 当前格是用户手动输入的，不标为自动
      newAutoFilled[col] = false;
      setWeekLabels(newLabels);
      setWeekAutoFilled(newAutoFilled);
    } else {
      // 输入了非标准内容（如自定义），只更新当前格，不推导
      setWeekLabels((prev) => {
        const next = [...prev];
        next[col] = input;
        return next;
      });
      setWeekAutoFilled((prev) => {
        const next = [...prev];
        next[col] = false;
        return next;
      });
    }
  }, []);

  // 当 index=0 的格子输入数字时，自动填充其余格子
  const handleChange = useCallback(
    (index: number, raw: string) => {
      const trimmed = raw.replace(/[^0-9]/g, "").slice(0, 2);
      setValues((prev) => {
        const next = [...prev];
        next[index] = trimmed;

        if (index === 0 && trimmed !== "") {
          const start = parseInt(trimmed, 10);
          if (!isNaN(start)) {
            for (let i = 1; i < totalDays; i++) {
              next[i] = String(start + i);
            }
          }
        }

        // 如果第0格被清空，清空所有自动填充的格子
        if (index === 0 && trimmed === "") {
          for (let i = 1; i < totalDays; i++) {
            next[i] = "";
          }
        }

        return next;
      });
    },
    [totalDays]
  );

  const handleReset = () => {
    setValues(Array(totalDays).fill(""));
    setWeekLabels(Array(7).fill(""));
    setWeekAutoFilled(Array(7).fill(false));
  };

  // ── 构建用于渲染的二维查找表：grid[row][col] = index | null
  const gridMap: (number | null)[][] = Array.from({ length: 5 }, () =>
    Array(7).fill(null)
  );
  for (const c of cells) {
    gridMap[c.row][c.col] = c.index;
  }

  // ── 计算每列的日期数字之和（只要该列有任意数字就显示）
  const colSums: (number | null)[] = Array.from({ length: 7 }, (_, col) => {
    let sum = 0;
    let hasAny = false;
    for (let row = 0; row <= 4; row++) {
      const index = gridMap[row][col];
      if (index !== null && values[index] !== "") {
        const n = parseInt(values[index], 10);
        if (!isNaN(n)) { sum += n; hasAny = true; }
      }
    }
    return hasAny ? sum : null;
  });

  return (
    <div className="flex flex-col items-center gap-4 select-none font-sans">
      <style>{weekdayInputStyle}</style>

      {/* ══ 日历卡片：星期胶囊 + 格子，是一个整体 ══ */}
      <div
        className="rounded-3xl bg-white/70 backdrop-blur-sm flex flex-col"
        style={{
          padding: "16px",
          gap: "0",
          boxShadow: "0 4px 24px 0 rgba(0,0,0,0.10), 0 1px 4px 0 rgba(0,0,0,0.06)",
        }}
      >
        {/* 星期标题行 */}
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

        {/* 胶囊与格子之间的间距 */}
        <div style={{ height: "12px" }} />

        {/* 日历格子区 */}
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, row) => {
            if (row === 0 && extra === 0) return null;
            return (
              <div key={row} className="flex gap-2">
                {Array.from({ length: 7 }, (_, col) => {
                  const index = gridMap[row][col];
                  if (index === null) {
                    return <div key={col} className="w-14 h-12" />;
                  }
                  return (
                    <CalendarCell
                      key={col}
                      col={col}
                      value={values[index]}
                      autoFilled={index > 0 && values[0] !== ""}
                      isFirst={index === 0}
                      onChange={(v) => handleChange(index, v)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ 分隔：各列之和属于另一个解题领域 ══ */}
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

      {/* ══ 求和行：独立在卡片外 ══ */}
      <div className="flex gap-2">
        {Array.from({ length: 7 }, (_, col) => (
          <SumCell key={col} col={col} sum={colSums[col]} />
        ))}
      </div>

      {/* ── 重置按钮 ── */}
      <button
        onClick={handleReset}
        className="mt-1 px-4 py-1.5 rounded-full text-xs font-semibold
          bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-400
          transition-colors border border-gray-200"
      >
        清空
      </button>

      {/* ── 提示 ── */}
      {values[0] === "" && (
        <p className="text-xs text-gray-400 -mt-1 text-center max-w-xs leading-relaxed">
          先填写顶部星期标题，再在第一格输入&nbsp;
          <span className="font-bold text-gray-500">1</span>
          &nbsp;自动填充日期
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function WeekdayInput({
  col,
  value,
  autoFilled,
  onChange,
}: {
  col: number;
  value: string;
  autoFilled: boolean;
  onChange: (v: string) => void;
}) {
  const theme = COL_THEME[col];

  return (
    <div
      className="w-14 h-10 rounded-full flex items-center justify-center
        border-2 shadow-sm transition-all overflow-hidden"
      style={{
        backgroundColor: theme.badge,
        borderColor: `color-mix(in srgb, ${theme.badge} 70%, black)`,
        // 自动填入的胶囊稍微透明，提示用户这是推导出来的，仍可点击修改
        opacity: autoFilled ? 0.72 : 1,
        transform: autoFilled ? "scale(0.95)" : "scale(1)",
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={3}
        placeholder="周?"
        className="weekday-input w-full h-full bg-transparent text-center font-bold text-sm
          outline-none transition-colors"
        style={{ color: "white", caretColor: "white" }}
      />
    </div>
  );
}

function SumCell({ col, sum }: { col: number; sum: number | null }) {
  const theme = COL_THEME[col];
  const hasValue = sum !== null;

  return (
    <div
      className="w-14 h-11 rounded-xl flex flex-col items-center justify-center
        border-2 transition-all"
      style={{
        backgroundColor: hasValue ? theme.badge : "#f3f4f6",
        borderColor: hasValue
          ? `color-mix(in srgb, ${theme.badge} 65%, black)`
          : "#e5e7eb",
        boxShadow: hasValue ? `0 2px 8px 0 ${theme.badge}55` : "none",
      }}
    >
      {hasValue ? (
        <span className="text-base font-black text-white leading-none">
          {sum}
        </span>
      ) : (
        <span className="text-sm font-bold text-gray-300">—</span>
      )}
    </div>
  );
}

function CalendarCell({
  col,
  value,
  autoFilled,
  isFirst,
  onChange,
}: {
  col: number;
  value: string;
  autoFilled: boolean;
  isFirst: boolean;
  onChange: (v: string) => void;
}) {
  const theme = COL_THEME[col];
  const bg = autoFilled ? theme.light : theme.cell;
  const ring = isFirst ? "ring-2 ring-offset-1 ring-amber-400" : "";

  return (
    <div
      className={`w-14 h-12 rounded-lg flex items-center justify-center
        border-2 border-white/80 shadow-sm transition-all ${ring}`}
      style={{ backgroundColor: bg }}
    >
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={autoFilled}
        maxLength={2}
        placeholder="?"
        className="w-full h-full bg-transparent text-center font-bold text-base
          text-gray-700 placeholder-gray-400/50 outline-none rounded-lg
          cursor-text"
        style={{ caretColor: COL_THEME[col].badge }}
      />
    </div>
  );
}
