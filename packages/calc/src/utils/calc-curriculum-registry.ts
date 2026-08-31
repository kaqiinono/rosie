import { finiteCoverageUniverses } from './calc-coverage'
import { structureCoverageModels } from './calc-structure-coverage'

export type CurriculumCoverageKind = 'formula' | 'structure'

export interface CurriculumRegistrySource {
  blockId: string
  version: string
  coverageKind: CurriculumCoverageKind
  members: string[]
}

/** Canonical code-owned curriculum registry input, ordered by block id. */
export function curriculumRegistrySources(): CurriculumRegistrySource[] {
  const formula: CurriculumRegistrySource[] = finiteCoverageUniverses().map((universe) => ({
    blockId: universe.blockId,
    version: universe.version,
    coverageKind: 'formula',
    members: Array.from({ length: universe.size }, (_, index) => universe.signatureAt(index)),
  }))
  const structure: CurriculumRegistrySource[] = structureCoverageModels().map((model) => ({
    blockId: model.id,
    version: model.version,
    coverageKind: 'structure',
    members: model.cells.map((cell) => cell.key),
  }))
  return [...formula, ...structure].sort((a, b) => a.blockId.localeCompare(b.blockId))
}

/** Stable SHA-256 input. Index prefixes make member reordering an explicit version change. */
export function curriculumHashInput(source: CurriculumRegistrySource): string {
  return [
    'rosie-calc-curriculum-v1',
    source.coverageKind,
    source.blockId,
    source.version,
    String(source.members.length),
    ...source.members.map((member, index) => `${index}\t${member}`),
  ].join('\n')
}
