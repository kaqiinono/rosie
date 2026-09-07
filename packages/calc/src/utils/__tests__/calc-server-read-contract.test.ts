import { describe, expect, it } from 'vitest'
import {
  CALC_DETAILS_MAX_PAGE_SIZE,
  CALC_PREPARE_MAX_QUESTIONS,
  validateDetailsRequest,
  validatePreparedResponse,
  validatePrepareRequest,
  validateReportSummary,
} from '../calc-server-read-contract'

describe('bounded calc server read contracts', () => {
  it('accepts a bounded prepare request', () => {
    expect(() =>
      validatePrepareRequest({
        blockIds: ['add:10'],
        mode: 'daily',
        count: 20,
        expectedRevision: 0,
      }),
    ).not.toThrow()
  })

  it('rejects duplicate blocks and oversized candidate responses', () => {
    expect(() =>
      validatePrepareRequest({
        blockIds: ['add:10', 'add:10'],
        mode: 'daily',
        count: 20,
        expectedRevision: 0,
      }),
    ).toThrow('invalid calc block selection')
    expect(() =>
      validatePreparedResponse({
        revision: 1,
        candidates: Array.from({ length: CALC_PREPARE_MAX_QUESTIONS + 1 }, () => ({
          state: {} as never,
          selectionReason: 'coverage',
        })),
        blocks: [],
      }),
    ).toThrow('exceeded candidate limit')
  })

  it('enforces cursor and page-size limits', () => {
    expect(() =>
      validateDetailsRequest({
        blockId: 'add:10',
        status: 'missing',
        limit: CALC_DETAILS_MAX_PAGE_SIZE,
      }),
    ).not.toThrow()
    expect(() =>
      validateDetailsRequest({
        blockId: 'add:10',
        status: 'missing',
        limit: CALC_DETAILS_MAX_PAGE_SIZE + 1,
      }),
    ).toThrow('invalid calc detail page size')
  })

  it('rejects incomplete or unbounded report projections', () => {
    expect(() =>
      validateReportSummary({
        revision: 1,
        projection: {
          version: 1,
          stateCount: 0,
          projectedStateCount: 0,
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
      }),
    ).not.toThrow()
    expect(() => validateReportSummary({ revision: 1 } as never)).toThrow(
      'unsupported calc report projection',
    )
  })
})
