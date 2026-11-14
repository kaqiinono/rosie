export default function GardenTriangle() {
  return (
    <svg
      role="img"
      aria-label="街心花园示意图：大等边三角形三边的中点两两相连，分出四个相同的小等边三角形。"
      viewBox="0 0 200 176"
      width="200"
      height="176"
      className="mx-auto max-w-full"
    >
      <g stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M100 10 L190 166 H10 Z" fill="none" />
        <path d="M55 88 H145 L100 166 Z" fill="none" />
      </g>
      <g fill="currentColor">
        <circle cx="100" cy="10" r="3" />
        <circle cx="55" cy="88" r="3" />
        <circle cx="145" cy="88" r="3" />
        <circle cx="10" cy="166" r="3" />
        <circle cx="100" cy="166" r="3" />
        <circle cx="190" cy="166" r="3" />
      </g>
    </svg>
  )
}
