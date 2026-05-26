/** Speak an English word using the browser's built-in speechSynthesis API. */
export function speakWord(word: string, rate = 0.85): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(word)
  utt.lang = 'en-US'
  utt.rate = rate
  window.speechSynthesis.speak(utt)
}
