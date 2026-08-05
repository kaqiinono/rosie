import { CellText } from './shared'

const rows: (string | number | '?')[][] = [
  ['10', '3', '14', '7', '18', '11', '22', '15', '?', '19', '?'],
  ['1', '12', '5', '16', '9', '20', '13', '24', '?', '?', '28'],
]

export default function HomeworkFig7Table() {
  const w = 28
  const h = 26
  return (
    <svg viewBox="0 0 340 70" className="mx-auto h-auto w-full max-w-lg overflow-x-auto">
      {rows.map((row, ri) =>
        row.map((c, ci) => (
          <CellText key={`${ri}-${ci}`} x={ci * w + 4} y={ri * h + 8} w={w} h={h} text={c} blank={c === '?'} />
        )),
      )}
    </svg>
  )
}
