import { CellText } from './shared'

const W = 44
const H = 36

export default function LessonFig8Grid() {
  const cells: (string | number | '?')[][] = [
    ['2', '8', '10', '?'],
    ['4', '6', '12', '…'],
    ['18', '16', '14', '?'],
    ['20', '?', '', ''],
  ]
  return (
    <svg viewBox="0 0 200 170" className="mx-auto h-auto w-full max-w-xs">
      {cells.map((row, ri) =>
        row.map((c, ci) => (
          <CellText
            key={`${ri}-${ci}`}
            x={ci * W + 8}
            y={ri * H + 8}
            w={W}
            h={H}
            text={c === '' ? undefined : c}
            blank={c === '?' || c === ''}
          />
        )),
      )}
    </svg>
  )
}
