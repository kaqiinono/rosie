import type { ReactNode } from 'react'

interface FigureProps {
  label: string
  width: number
  height: number
  children: ReactNode
}

function Figure({ label, width, height, children }: FigureProps) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="mx-auto h-auto max-w-full"
      fill="currentColor"
      fontSize="14"
    >
      {children}
    </svg>
  )
}

interface RoadGridProps {
  label: string
  columns: number
  rows: number
  children: ReactNode
}

function RoadGrid({ label, columns, rows, children }: RoadGridProps) {
  const right = 26 + columns * 26
  const bottom = 28 + rows * 26
  const horizontal = Array.from({ length: rows + 1 }, (_, row) => `M26 ${28 + row * 26}H${right}`)
  const vertical = Array.from({ length: columns + 1 }, (_, col) => `M${26 + col * 26} 28V${bottom}`)

  return (
    <Figure label={label} width={right + 26} height={bottom + 28}>
      <path d={[...horizontal, ...vertical].join(' ')} fill="none" stroke="currentColor" />
      {children}
    </Figure>
  )
}

export function FrogFigure() {
  return (
    <Figure label="A在上方，B在左下，C在右下，三个点两两相连。" width={164} height={152}>
      <path d="M82 28 22 128H142Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text x="82" y="20" textAnchor="middle">A</text>
      <text x="8" y="143">B</text>
      <text x="146" y="143">C</text>
    </Figure>
  )
}

export function SnailFigure() {
  return (
    <Figure
      label="上排A、E、D，下排B、F、C。相邻点由横线和竖线相连，另有AF、EC两条斜线。"
      width={220}
      height={116}
    >
      <path
        d="M30 30H190V86H30Z M110 30V86 M30 30L110 86 M110 30L190 86"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <g textAnchor="middle">
        <text x="30" y="23">A</text>
        <text x="110" y="23">E</text>
        <text x="190" y="23">D</text>
        <text x="30" y="104">B</text>
        <text x="110" y="104">F</text>
        <text x="190" y="104">C</text>
      </g>
    </Figure>
  )
}

export function ShortestGridFigure() {
  return (
    <RoadGrid label="3列3行方格，A在左下角，B在右上角。" columns={3} rows={3}>
      <text x="26" y="123" textAnchor="middle">A</text>
      <text x="104" y="20" textAnchor="middle">B</text>
    </RoadGrid>
  )
}

export function AvoidJunctionFigure() {
  return (
    <RoadGrid
      label="4列4行方格。A在左下角，D在右上角。B是中心路口，C是B右边相邻的路口。"
      columns={4}
      rows={4}
    >
      <text x="26" y="149" textAnchor="middle">A</text>
      <text x="82" y="95">B</text>
      <text x="108" y="95">C</text>
      <text x="130" y="20" textAnchor="middle">D</text>
    </RoadGrid>
  )
}

export function EitherJunctionFigure() {
  return (
    <RoadGrid
      label="8列6行方格。A在左下角，B在右上角。从A向右3格、向上4格到C，向右6格、向上2格到D。"
      columns={8}
      rows={6}
    >
      <text x="26" y="201" textAnchor="middle">A</text>
      <text x="234" y="20" textAnchor="middle">B</text>
      <text x="108" y="95">C</text>
      <text x="186" y="147">D</text>
    </RoadGrid>
  )
}

export function SchoolRoadFigure() {
  return (
    <Figure
      label="纳纳家在左上，学校在右下。四条竖路贯通，顶行和底行的横路贯通。第二行和第四行只连接中间两条竖路，第三行只连接左侧一对和右侧一对。"
      width={258}
      height={164}
    >
      <path
        d="M32 28H226V136H32Z M92 28V136 M166 28V136 M92 55H166 M32 82H92 M166 82H226 M92 109H166"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text x="32" y="20" textAnchor="middle">纳纳家</text>
      <text x="226" y="154" textAnchor="middle">学校</text>
    </Figure>
  )
}

export function LibraryRoadFigure() {
  return (
    <Figure
      label="P在街道图左上角。从P数格，A向右3格、向下6格，B向右3格、向下5格，C向右7格、向下3格，D向右2格、向下4格，E向右7格、向下2格。人工湖在E与C之间，湖中的两条竖路断开。"
      width={238}
      height={226}
    >
      <path
        d="M24 28H206V210H24Z M24 54H206 M24 80H206 M24 106H206 M24 132H206 M24 158H206 M24 184H206 M50 28V184 M76 28V210 M102 28V210 M128 28V210 M154 28V80 M154 106V210 M180 28V80 M180 106V210"
        fill="none"
        stroke="currentColor"
      />
      <text x="12" y="26">P</text>
      <g textAnchor="end">
        <text x="98" y="199">A</text>
        <text x="98" y="173">B</text>
        <text x="72" y="147">D</text>
      </g>
      <text x="211" y="110">C</text>
      <text x="211" y="84">E</text>
      <text x="167" y="98" textAnchor="middle" fontSize="13">人工湖</text>
      <text x="50" y="202" textAnchor="middle" fontSize="13">超市</text>
    </Figure>
  )
}
