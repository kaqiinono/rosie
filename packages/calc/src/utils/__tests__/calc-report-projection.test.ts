import { describe, expect, it } from 'vitest'
import type { CalcProblemState } from '@rosie/core'
import { reportFieldsOf } from '../calc-report-facets'
import {
  reportBlockCoverage,
  reportConceptCoverage,
  reportRuleCoverage,
  reportReadScope,
  reportStructureCoverage,
} from '../calc-report-summary'
import { coverageUniverse } from '../calc-coverage'
import type { CalcReportSummaryResponse } from '../calc-server-read-contract'

function state(overrides: Partial<CalcProblemState> = {}): CalcProblemState {
  return {
    signature: 'add(18,7)',
    level: 2,
    proficiency: 2,
    attemptCount: 1,
    appearanceCount: 1,
    recentResults: [
      {
        correct: true,
        timeMs: 900,
        withinLimit: true,
        evidenceKind: 'independent',
        sessionNo: 1,
        date: '2026-09-07',
        presentationKey: 'standard',
      },
    ],
    status: 'active',
    consecutiveWrong: 0,
    consecutiveCorrect: 1,
    updatedAt: '2026-09-07T00:00:00.000Z',
    blockId: 'add:100b',
    ...overrides,
  }
}

function emptySummary(
  overrides: Partial<CalcReportSummaryResponse> = {},
): CalcReportSummaryResponse {
  return {
    revision: 3,
    projection: {
      version: 1,
      stateCount: 1,
      projectedStateCount: 1,
      expectedBlockCount: 16,
      projectedBlockCount: 16,
      complete: true,
    },
    blocks: [],
    concepts: [],
    structures: [],
    rules: [],
    repeatAudit: { questions: 0, repeats: 0, intentional: 0, accidental: 0, consecutive: 0 },
    detailSources: [],
    ...overrides,
  }
}

describe('calc report projection', () => {
  it('keeps the coverage tab on bounded server reads', () => {
    expect(reportReadScope('coverage')).toEqual({
      loadProblemStates: false,
      loadSessionDetails: false,
      loadMistakes: false,
    })
    expect(reportReadScope('weakness').loadProblemStates).toBe(true)
  })

  it('classifies static, mixed, concept and rule facets at write time', () => {
    const staticFields = reportFieldsOf(state())
    expect(staticFields.report_facets_version).toBe(1)
    expect(
      reportFieldsOf(state({ signature: 'add(3,4)', blockId: 'add:10' })).report_concept_key,
    ).toBeTruthy()
    expect(staticFields.report_structure_facets).toEqual([
      { modelId: 'add:100b', cellKeys: expect.arrayContaining(['carry:yes']) },
    ])
    expect(staticFields.report_covered).toBe(true)

    const mixed = reportFieldsOf(
      state({ signature: 'add(3,mul(4,5))', blockId: undefined, mixedOpId: 'mixed-a' }),
    )
    expect(mixed.report_structure_facets).toEqual([
      { modelId: 'mixed:mixed-a', cellKeys: ['root:addsub', 'depth:2'] },
    ])

    expect(reportFieldsOf(state({ signature: 'mul(8,1)' })).report_rule_key).toBe('mul-one')
  })

  it('reconstructs exact finite coverage from bounded bitmap summaries', () => {
    const universe = coverageUniverse('add:10')!
    const summary = emptySummary({
      blocks: [
        {
          blockId: universe.blockId,
          curriculumVersion: universe.version,
          universeSize: universe.size,
          coveredCount: 1,
          withinTargetCount: 1,
          fluentCount: 0,
          masteredCount: 0,
          reviewDueCount: 1,
          recentIndependentCorrect: 1,
          recentIndependentTotal: 1,
          stableCount: 0,
          tier: 'initial',
          ready: false,
          recovery: false,
          appliedRevision: 3,
          healthStatus: 'healthy',
          coveredBits: '01',
          withinTargetBits: '01',
          fluentBits: '00',
          masteredBits: '00',
        },
      ],
    })
    const block = reportBlockCoverage(summary).find((item) => item.blockId === 'add:10')!
    expect(block.covered).toBe(1)
    expect(block.withinTarget).toBe(1)
    expect(block.reviewDue).toBe(1)
    expect(block.missingSignatures).not.toContain(universe.signatureAt(0))
  })

  it('hydrates concepts, structures and rules without problem-state rows', () => {
    const summary = emptySummary({
      concepts: [
        {
          blockId: 'add:10',
          observedTotal: 1,
          covered: 1,
          withinTarget: 1,
          fluent: 0,
          mastered: 0,
          reviewDue: 0,
        },
      ],
      structures: [
        {
          modelId: 'add:100b',
          cellKey: 'carry:yes',
          covered: true,
          fluent: false,
          mastered: false,
          reviewDue: false,
          sampleSignatures: ['add(18,7)'],
        },
      ],
      rules: [{ ruleKey: 'mul-one', covered: 2, mastered: 1, sampleSignatures: ['mul(8,1)'] }],
      detailSources: [{ kind: 'block', id: 'add:100b', formulaCount: 52 }],
    })
    expect(reportConceptCoverage(summary).get('add:10')?.coveredConcepts).toBe(1)
    expect(
      reportStructureCoverage(summary, []).find((item) => item.id === 'add:100b')?.covered,
    ).toBe(1)
    expect(reportRuleCoverage(summary).find((item) => item.key === 'mul-one')).toMatchObject({
      covered: 2,
      mastered: 1,
    })
  })
})
