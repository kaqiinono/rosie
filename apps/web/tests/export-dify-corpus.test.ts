import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'vitest'
import { exportMathCorpus } from '../../../scripts/export-dify-corpus-lib'

const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/robot/corpus',
)

describe('export-dify-corpus', () => {
  it('writes math corpus files for Dify upload', () => {
    exportMathCorpus(OUT_DIR)
  })
})
