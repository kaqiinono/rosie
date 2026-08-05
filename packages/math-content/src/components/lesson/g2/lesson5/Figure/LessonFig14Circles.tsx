import { CircleNum, figStroke } from './shared'

export default function LessonFig14Circles() {
  return (
    <svg viewBox="0 0 300 220" className="mx-auto h-auto w-full max-w-md">
      <circle cx={150} cy={70} r={36} fill="#eef2ff" stroke={figStroke} strokeWidth={2} />
      <text x={150} y={75} textAnchor="middle" fontSize={18} fontWeight="bold" fill="#1e1b4b">48</text>
      <CircleNum cx={150} cy={22} r={14} n={6} />
      <CircleNum cx={192} cy={52} r={14} n="?" blank />
      <CircleNum cx={118} cy={88} r={14} n={4} />
      <CircleNum cx={182} cy={88} r={14} n={1} />

      <circle cx={90} cy={165} r={36} fill="#eef2ff" stroke={figStroke} strokeWidth={2} />
      <text x={90} y={170} textAnchor="middle" fontSize={18} fontWeight="bold" fill="#1e1b4b">96</text>
      <CircleNum cx={90} cy={118} r={14} n={4} />
      <CircleNum cx={48} cy={165} r={14} n={3} />
      <CircleNum cx={48} cy={200} r={14} n={4} />
      <CircleNum cx={90} cy={210} r={14} n={1} />
      <CircleNum cx={132} cy={200} r={14} n={2} />

      <circle cx={210} cy={165} r={36} fill="#eef2ff" stroke={figStroke} strokeWidth={2} />
      <text x={210} y={170} textAnchor="middle" fontSize={18} fontWeight="bold" fill="#1e1b4b">120</text>
      <CircleNum cx={210} cy={118} r={14} n={1} />
      <CircleNum cx={168} cy={200} r={14} n={2} />
      <CircleNum cx={210} cy={210} r={14} n={5} />
      <CircleNum cx={252} cy={200} r={14} n={4} />
      <CircleNum cx={252} cy={165} r={14} n={3} />
    </svg>
  )
}
