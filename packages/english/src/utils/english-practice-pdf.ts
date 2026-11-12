import { lessonChipTag } from './english-helpers'
import type { EnglishPrintSection } from './english-practice-print-helpers'

// Draw with the device's fonts so Chinese definitions and IPA survive PDF export.
const width = 595.28
const height = 841.89
const margin = 36
const scale = 2.5

// Each A4 page contains one JPEG. Blob sizes give byte-accurate PDF stream
// lengths and cross-reference offsets without decoding all images into memory.
function assemblePdf(images: Blob[], pixelWidth: number, pixelHeight: number): Blob {
  const parts: BlobPart[] = []
  const offsets = [0]
  let size = 0
  function append(part: string | Blob) {
    parts.push(part)
    size += typeof part === 'string' ? part.length : part.size // PDF syntax is ASCII.
  }
  function object(body: string, stream?: Blob) {
    offsets.push(size)
    append(`${offsets.length - 1} 0 obj\n${body}\n`)
    if (stream) {
      append('stream\n')
      append(stream)
      append('\nendstream\n')
    }
    append('endobj\n')
  }

  append('%PDF-1.4\n')
  object('<< /Type /Catalog /Pages 2 0 R >>')
  const kids = images.map((_, i) => `${3 + i * 3} 0 R`).join(' ')
  object(`<< /Type /Pages /Count ${images.length} /Kids [${kids}] >>`)
  for (const image of images) {
    const id = offsets.length
    object(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`)
    object(`<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.size} >>`, image)
    const drawing = new Blob([`q ${width} 0 0 ${height} 0 0 cm /Im Do Q`])
    object(`<< /Length ${drawing.size} >>`, drawing)
  }
  const xref = size
  append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`)
  for (const offset of offsets.slice(1)) append(`${String(offset).padStart(10, '0')} 00000 n \n`)
  append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts, { type: 'application/pdf' })
}

export async function createPracticePdf(title: string, sections: EnglishPrintSection[]) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('Canvas unavailable')
  const ctx = context
  ctx.scale(scale, scale)
  ctx.textBaseline = 'top'
  const pages: Blob[] = []
  let y = margin
  function clearPage() {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale)
    ctx.fillStyle = '#171717'
    y = margin
  }
  async function finishPage() {
    ctx.font = '9px sans-serif'
    ctx.fillText(String(pages.length + 1), width / 2, height - 24)
    const jpeg = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(blob => blob?.type === 'image/jpeg' ? resolve(blob) : reject(new Error('JPEG unavailable')), 'image/jpeg', 0.93),
    )
    pages.push(jpeg)
    clearPage()
  }
  function wrap(text: string, font: string) {
    ctx.font = font
    const lines: string[] = []
    for (const paragraph of text.split(/\r?\n/)) {
      let line = ''
      for (const token of paragraph.match(/[A-Za-z0-9'’-]+|./gu) ?? []) {
        if (line && ctx.measureText(line + token).width > width - 2 * margin) {
          lines.push(line.trimEnd())
          line = ''
        }
        if (ctx.measureText(token).width <= width - 2 * margin) {
          line += line ? token : token.trimStart()
          continue
        }
        for (const ch of token) {
          if (!line && ch === ' ') continue
          if (ctx.measureText(line + ch).width > width - 2 * margin) {
            lines.push(line)
            line = ''
          }
          line += ch
        }
      }
      lines.push(line)
    }
    return lines
  }
  async function write(lines: string[], font: string, leading = 16) {
    for (const line of lines) {
      if (y + leading > height - margin) await finishPage()
      ctx.font = font
      ctx.fillText(line, margin, y)
      y += leading
    }
  }

  try {
    clearPage()
    const heading = 'bold 14px sans-serif'
    const body = '11px sans-serif'
    await write(wrap(title, heading), heading, 20)
    await write(['姓名：____________　　 日期：____________'], body)
    for (const section of sections) {
      y += 10
      for (const [index, question] of section.questions.entries()) {
        const { word } = question
        const tag = [word.vocabType, lessonChipTag(word.unit, word.lesson)].filter(Boolean).join(' · ')
        const prompt = wrap(`${question.num}. ${question.prompt}  [${tag}]`, body)
        const options = question.options.map(option => `${option.label}. ${option.text}`).join('     ')
        const details = [question.ipa, options].flatMap(text => text ? wrap(text, body) : [])
        const gridHeight = question.type === 'C' ? 36 : 0
        const needed = (index === 0 ? 22 : 0) + (prompt.length + details.length) * 16 + gridHeight
        if (y > margin && y + needed > height - margin) await finishPage()
        if (index === 0) await write([section.title], heading, 22)
        await write(prompt, body)
        await write(details, body)
        if (gridHeight) {
          if (y + gridHeight > height - margin) await finishPage()
          for (let i = 0; i < 4; i++) {
            ctx.fillStyle = i === 0 || i === 3 ? '#854d0e' : '#78716c'
            ctx.fillRect(margin, y + 4 + i * 9, width - margin * 2, 0.65)
          }
          ctx.fillStyle = '#171717'
          y += gridHeight
        }
        y += 8
      }
    }
    await finishPage()
    return assemblePdf(pages, canvas.width, canvas.height)
  } finally {
    canvas.width = canvas.height = 0
  }
}
