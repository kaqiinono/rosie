import type { ComponentPropsWithRef } from 'react'

/** Original Storage scans/crops have variable intrinsic dimensions. The crop editor
 * also uses the original pixel coordinates for its selection and canvas export. */
export function GrammarScanImage({ alt, ...props }: ComponentPropsWithRef<'img'> & { alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- Preserve the original scan and browser-measured dimensions.
  return <img decoding="async" {...props} alt={alt} />
}
