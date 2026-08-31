import { describe, expect, it } from 'vitest'
import {
  CALC_DETAILS_MAX_PAGE_SIZE,
  CALC_PREPARE_MAX_QUESTIONS,
  validateDetailsRequest,
  validatePreparedResponse,
  validatePrepareRequest,
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
          question: {} as never,
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
})
