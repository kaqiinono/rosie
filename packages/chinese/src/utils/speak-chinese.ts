/** Speak Chinese text using the browser speechSynthesis API. */
export function speakChinese(text: string, rate = 0.9): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'zh-CN'
  utt.rate = rate
  window.speechSynthesis.speak(utt)
}
