import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { transcribeAudio } from '../packages/ai/src/server/transcribe.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { language: { type: 'string', default: 'en' }, out: { type: 'string' } },
})
if (!values.out || !positionals.length) throw new Error('Usage: pnpm audio:transcribe --out DIR [--language en] AUDIO...')
const seconds = 45
async function transcribeTrack(path) {
  const hash = createHash('sha256')
  for await (const data of createReadStream(path)) hash.update(data)
  hash.update(JSON.stringify([values.language, seconds, process.env.AI_STT_MODEL ?? 'whisper-1']))
  const folder = resolve(values.out, basename(path) + '-' + hash.digest('hex').slice(0, 16))
  await mkdir(folder, { recursive: true })
  const temp = await mkdtemp(join(tmpdir(), 'rosie-audio-'))
  try {
    execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', [
      '-loglevel', 'error', '-i', path, '-map', '0:a:0', '-ac', '1', '-ar', '16000',
      '-c:a', 'pcm_s16le', '-f', 'segment', '-segment_time', String(seconds), join(temp, '%06d.wav'),
    ])
    const transcript = []
    for (const name of (await readdir(temp)).sort()) {
      const index = Number.parseInt(name, 10)
      const target = join(folder, name.replace('.wav', '.txt'))
      let text
      try {
        text = await readFile(target, 'utf8')
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
        console.log(basename(path), index * seconds + 's')
        const audio = new File([await readFile(join(temp, name))], name, { type: 'audio/wav' })
        ;({ text } = await transcribeAudio(audio, values.language))
        const draft = join(folder, name + '.' + process.pid + '.tmp')
        await writeFile(draft, text)
        await rename(draft, target)
      }
      transcript.push('[' + index * seconds + 's] ' + text)
    }
    const draft = join(folder, 'transcript.' + process.pid + '.tmp')
    await writeFile(draft, transcript.join('\n\n') + '\n')
    await rename(draft, join(folder, 'transcript.txt'))
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}
for (const path of positionals) await transcribeTrack(path)
