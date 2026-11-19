import 'server-only'
import { createHash } from 'node:crypto'
import main from '../../../../packages/english/source-data/vocabulary-assessment/v2-pilot/main.json'
import diagnostic from '../../../../packages/english/source-data/vocabulary-assessment/v2-pilot/diagnostic.json'
import type { PilotBank } from '@rosie/english/assessment/adaptive'

export const pilotBank: PilotBank = { referenceVersion: main.referenceVersion, main: main.items, diagnostic: diagnostic.items }
export const pilotVersion = 'va2-' + createHash('sha256').update(JSON.stringify(pilotBank)).digest('hex')
