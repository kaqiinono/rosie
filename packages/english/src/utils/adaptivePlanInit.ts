import { isGraduated, type WordMasteryInfo } from '@rosie/core'
import type { PlanWordInit } from './adaptivePlanTypes'

/** §5.2.1; forceChallenge remaps would-be MASTERED words to PENDING + Box 3. */
export function mapWordToPlanInit(
  wordKey: string,
  mastery: WordMasteryInfo | undefined,
  forceChallenge: boolean,
): PlanWordInit {
  const stage = mastery?.stage ?? 0
  const graduated = mastery ? isGraduated(mastery) : false

  if (graduated || stage >= 5) {
    if (forceChallenge) {
      return { word_key: wordKey, status: 'LEARNING_PENDING', target_box: 3 }
    }
    return { word_key: wordKey, status: 'MASTERED', target_box: null }
  }
  if (!mastery || stage === 0) {
    return { word_key: wordKey, status: 'NOT_STARTED', target_box: null }
  }
  if (stage <= 2) {
    return { word_key: wordKey, status: 'LEARNING_PENDING', target_box: 1 }
  }
  return { word_key: wordKey, status: 'LEARNING_PENDING', target_box: 3 }
}

/** True when every init row is MASTERED and the list is non-empty (§4.2.1 guard). */
export function allWordsMastered(inits: PlanWordInit[]): boolean {
  return inits.length > 0 && inits.every(init => init.status === 'MASTERED')
}
