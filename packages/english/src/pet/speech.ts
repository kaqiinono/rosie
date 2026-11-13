/** User-triggered speech with an observable failure path for listening questions. */
export function speakPetWord(text: string, signal?: AbortSignal): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !window.speechSynthesis ||
    typeof SpeechSynthesisUtterance === 'undefined' ||
    signal?.aborted
  ) return Promise.resolve(false)

  return new Promise((resolve) => {
    const synth = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-GB'
    utterance.rate = 0.85
    const voice = synth.getVoices().find((candidate) => candidate.lang === 'en-GB')
    if (voice) utterance.voice = voice
    let settled = false
    const finish = (played: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      utterance.onend = null
      utterance.onerror = null
      resolve(played)
    }
    const abort = () => {
      finish(false)
      synth.cancel()
    }
    const timeout = window.setTimeout(abort, 20_000)
    signal?.addEventListener('abort', abort, { once: true })
    utterance.onend = () => finish(true)
    utterance.onerror = () => finish(false)
    try {
      synth.cancel()
      synth.speak(utterance)
    } catch {
      finish(false)
    }
  })
}
