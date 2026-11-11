// 全合成音效（WebAudio），来自 bubble-wish-tree 演示，不依赖任何音频文件。
// 浏览器要求先有一次用户手势，所以第一次点击页面时调用 ensure()。

type AudioContextCtor = typeof AudioContext

const MELODY = [76, 79, 81, 79, 76, 74, 76, 0, 72, 74, 76, 79, 76, 74, 72, 0]

class GardenAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfx: GainNode | null = null
  private music: GainNode | null = null
  private nextNote = 0
  private noteIdx = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private on = true

  ensure(): boolean {
    if (!this.ctx) {
      const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
      const AC = w.AudioContext ?? w.webkitAudioContext
      if (!AC) return false
      const ctx = new AC()
      this.ctx = ctx
      this.master = ctx.createGain()
      this.master.gain.value = this.on ? 0.9 : 0
      this.master.connect(ctx.destination)
      this.sfx = ctx.createGain()
      this.sfx.gain.value = 0.55
      this.sfx.connect(this.master)
      this.music = ctx.createGain()
      this.music.gain.value = 0.16
      this.music.connect(this.master)
      this.nextNote = ctx.currentTime + 0.1
      this.timer = setInterval(() => this.scheduleMusic(), 200)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return true
  }

  setSound(on: boolean): void {
    this.on = on
    if (this.master && this.ctx) this.master.gain.linearRampToValueAtTime(on ? 0.9 : 0, this.ctx.currentTime + 0.15)
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.ctx) void this.ctx.close()
    this.ctx = null
    this.master = null
    this.sfx = null
    this.music = null
  }

  private midi(m: number): number {
    return 440 * Math.pow(2, (m - 69) / 12)
  }

  private tone(
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType = 'sine',
    vol = 0.3,
    dest: GainNode | null = null,
    slideTo: number | null = null,
  ): void {
    const ctx = this.ctx
    const target = dest ?? this.sfx
    if (!ctx || !target) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(target)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private noise(t: number, dur: number, vol = 0.3, freq = 1800): void {
    const ctx = this.ctx
    if (!ctx || !this.sfx) return
    const len = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = 0.8
    const g = ctx.createGain()
    g.gain.value = vol
    src.connect(f)
    f.connect(g)
    g.connect(this.sfx)
    src.start(t)
  }

  private scheduleMusic(): void {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const ahead = ctx.currentTime + 0.6
    while (this.nextNote < ahead) {
      const m = MELODY[this.noteIdx % MELODY.length]
      if (m) {
        this.tone(this.midi(m), this.nextNote, 1.4, 'sine', 0.5, this.music)
        this.tone(this.midi(m) * 2, this.nextNote, 0.7, 'sine', 0.12, this.music)
        if (this.noteIdx % 8 === 0) this.tone(this.midi(m - 12), this.nextNote, 2.2, 'triangle', 0.18, this.music)
      }
      this.noteIdx += 1
      this.nextNote += 0.42
    }
  }

  private play(fn: (t: number) => void): void {
    if (!this.on || !this.ctx || this.ctx.state !== 'running') return
    fn(this.ctx.currentTime)
  }

  pop(): void {
    this.play((t) => {
      this.noise(t, 0.09, 0.5, 2400)
      this.tone(520, t, 0.13, 'triangle', 0.4, null, 170)
    })
  }
  bloom(): void {
    this.play((t) => [72, 76, 79, 84].forEach((m, i) => this.tone(this.midi(m), t + i * 0.07, 0.9, 'sine', 0.22)))
  }
  ripen(): void {
    this.play((t) => [79, 84, 88].forEach((m, i) => this.tone(this.midi(m), t + i * 0.08, 0.8, 'sine', 0.24)))
  }
  water(): void {
    this.play((t) => {
      this.tone(880, t, 0.1, 'sine', 0.25, null, 430)
      this.tone(660, t + 0.1, 0.12, 'sine', 0.2, null, 330)
    })
  }
  pick(): void {
    this.play((t) => {
      this.tone(620, t, 0.12, 'triangle', 0.32, null, 990)
      this.tone(1320, t + 0.09, 0.25, 'sine', 0.18)
    })
  }
  reward(): void {
    this.play((t) => [72, 76, 79, 84, 88].forEach((m, i) => this.tone(this.midi(m), t + i * 0.09, 0.7, 'triangle', 0.26)))
  }
  magic(): void {
    this.play((t) => {
      this.tone(300, t, 0.55, 'sine', 0.22, null, 1400)
      ;[84, 88, 91, 96].forEach((m, i) => this.tone(this.midi(m), t + 0.15 + i * 0.08, 0.8, 'sine', 0.16))
    })
  }
  midnight(): void {
    this.play((t) => [88, 84, 79, 76, 72].forEach((m, i) => this.tone(this.midi(m), t + i * 0.12, 0.9, 'sine', 0.2)))
  }
  click(): void {
    this.play((t) => this.tone(1150, t, 0.045, 'sine', 0.12))
  }
}

export const gardenAudio = new GardenAudio()
