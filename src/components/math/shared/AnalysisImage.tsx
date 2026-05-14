'use client'

interface AnalysisImageProps {
  src: string
  alt?: string
}

export default function AnalysisImage({ src, alt = '题解图' }: AnalysisImageProps) {
  return (
    <div className="mt-2.5 flex justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="w-full max-w-md rounded-lg border border-sky-200 bg-white"
      />
    </div>
  )
}