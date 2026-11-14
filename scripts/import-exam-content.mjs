#!/usr/bin/env node

import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { createJiti } from 'jiti'

const HELP = `Usage:
  pnpm exams:content extract --input <pdf> --source <id> --test <n> --role <exam|training> [--map <json>] [--output <directory>] [--resume]
  pnpm exams:content validate --bundle <directory>
  pnpm exams:content import-draft --bundle <directory>
  pnpm exams:content import-draft --bundle <directory> --apply --base-url <origin> [--resume | --update-existing]

validate and import-draft without --apply only read local files.
--apply requires EXAMS_ADMIN_ACCESS_TOKEN in the environment.
--resume replays an unfinished request with its original identity and input.
--update-existing replaces only a draft with a successful local import receipt.
extract writes private local page images/text and a recovery manifest, not a finished question bundle.
Publication is not a command of this tool.
`

function parseCommand(args) {
  let parsed
  try {
    parsed = parseArgs({
      args, strict: true, allowPositionals: true, tokens: true,
      options: {
        bundle: { type: 'string' },
        'base-url': { type: 'string' },
        apply: { type: 'boolean' },
        resume: { type: 'boolean' },
        'update-existing': { type: 'boolean' },
        input: { type: 'string' },
        source: { type: 'string' },
        test: { type: 'string' },
        role: { type: 'string' },
        map: { type: 'string' },
        output: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    })
  } catch {
    return null
  }
  const names = parsed.tokens.filter(token => token.kind === 'option').map(token => token.name)
  if (new Set(names).size !== names.length) return null
  const { values, positionals } = parsed
  if (values.help && positionals.length <= 1 && names.length === 1 &&
      (!positionals.length || ['extract', 'validate', 'import-draft'].includes(positionals[0]))) return { help: true }
  if (values.help || positionals.length !== 1 || !['extract', 'validate', 'import-draft'].includes(positionals[0])) return null
  if (positionals[0] === 'extract') {
    if (names.some(name => !['input', 'source', 'test', 'role', 'map', 'output', 'resume'].includes(name)) ||
        !values.input?.trim() || !values.source?.trim() || !/^[1-9][0-9]*$/.test(values.test ?? '') ||
        !Number.isSafeInteger(Number(values.test)) || !['exam', 'training'].includes(values.role) ||
        (values.map !== undefined && !values.map.trim()) || (values.output !== undefined && !values.output.trim())) return null
    return { command: 'extract', values }
  }
  if (!values.bundle?.trim()) return null
  if (positionals[0] === 'validate' && names.some(name => name !== 'bundle')) return null
  if (positionals[0] === 'import-draft') {
    if (names.some(name => !['bundle', 'base-url', 'apply', 'resume', 'update-existing'].includes(name))) return null
    if (!values.apply && (values['base-url'] !== undefined || values.resume || values['update-existing'])) return null
    if (values.apply && !values['base-url']?.trim()) return null
    if (values.resume && values['update-existing']) return null
  }
  return { command: positionals[0], values }
}

async function main() {
  const options = parseCommand(process.argv.slice(2))
  if (!options) {
    console.error('exam_invalid_arguments\nUse --help for command syntax.')
    process.exitCode = 2
    return
  }
  if (options.help) {
    console.log(HELP)
    return
  }
  // Loading TS must not create transpilation artifacts during an offline validate.
  const jiti = createJiti(import.meta.url, { fsCache: false })
  let ExamImportError
  try {
    const bundleModule = await jiti.import('./lib/exams/bundle.ts')
    ExamImportError = bundleModule.ExamImportError
    if (options.command === 'extract') {
      const { loadExamSourceMap, selectExamSourceGroups } = await jiti.import('./lib/exams/sourceMap.ts')
      const { extractExamSource } = await jiti.import('./lib/exams/extractSource.ts')
      const mapPath = options.values.map ? resolve(options.values.map) : fileURLToPath(new URL('./exams-source-map.json', import.meta.url))
      const map = await loadExamSourceMap(mapPath)
      const selection = selectExamSourceGroups(map, {
        sourceId: options.values.source, testNumber: Number(options.values.test), role: options.values.role,
      })
      const output = options.values.output ? resolve(options.values.output) : fileURLToPath(new URL(
        `../output/exams/${selection.source.id}/test-${Number(options.values.test)}-${options.values.role}/extraction/`, import.meta.url,
      ))
      const result = await extractExamSource(selection, { input: resolve(options.values.input), output, resume: options.values.resume ?? false })
      console.log(JSON.stringify({
        mode: 'extract', sourceId: result.sourceId, sourceSha256: result.sourceSha256,
        selectedPages: result.selectedPages, renderedPages: result.renderedPages,
        reusedPages: result.reusedPages, warnings: result.warnings,
      }))
      return
    }
    const bundle = await bundleModule.loadExamBundle(resolve(options.values.bundle))
    const summary = {
      contentSetId: bundle.draft.contentSet.id,
      contentRevisionId: bundle.draft.content.id,
      revision: bundle.draft.content.revision,
      groups: bundle.draft.content.groups.length,
      questions: bundle.draft.content.groups.reduce((total, group) => total + group.questions.length, 0),
      readiness: { exam: bundle.readiness.exam.length, explanations: bundle.readiness.explanations.length },
      bundleHash: bundle.bundleHash,
    }
    if (options.command === 'validate' || !options.values.apply) {
      console.log(JSON.stringify({ mode: options.command === 'validate' ? 'validate' : 'preview', ...summary }))
      return
    }
    const accessToken = process.env.EXAMS_ADMIN_ACCESS_TOKEN
    if (!accessToken?.trim() || /\s/.test(accessToken)) throw new ExamImportError('exam_admin_token_required', 2)
    const { importExamDraft } = await jiti.import('./lib/exams/importDraft.ts')
    const result = await importExamDraft(bundle, {
      baseUrl: options.values['base-url'], accessToken,
      stateDirectory: fileURLToPath(new URL('../output/exams/import-state/', import.meta.url)),
      resume: options.values.resume ?? false,
      updateExisting: options.values['update-existing'] ?? false,
    })
    console.log(JSON.stringify({ mode: 'apply', status: result.status, ...summary, version: result.receipt.version }))
  } catch (error) {
    // Never print stack traces, HTTP bodies, local document contents or credentials.
    if (ExamImportError && error instanceof ExamImportError) {
      console.error(JSON.stringify({ error: error.code, ...(error.issues ? { issues: error.issues } : {}) }))
      process.exitCode = error.exitCode
    } else {
      console.error(JSON.stringify({ error: 'exam_import_failed' }))
      process.exitCode = 1
    }
  }
}

await main()
