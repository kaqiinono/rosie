export type ProblemNav = {
  prevHref: string | null
  nextHref: string | null
  positionLabel: string
}

export function getProblemNav(
  basePath: string,
  section: string,
  id1Based: number,
  total: number,
): ProblemNav {
  const prevHref = id1Based > 1 ? `${basePath}/${section}/${id1Based - 1}` : null
  const nextHref = id1Based < total ? `${basePath}/${section}/${id1Based + 1}` : null
  const positionLabel = `${id1Based} / ${total}`
  return { prevHref, nextHref, positionLabel }
}
