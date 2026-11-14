import type { PracticeContentBlock, PracticeEntryRow } from '@rosie/tasks'
import type { Catalog, CatalogGroup, CatalogKind } from './catalog'
import { readAll } from './catalogData'

interface Lesson { lesson_key: string; grade: number; semester: string; unit: number; lesson: number; lesson_kind: string; lesson_title: string; sort_order: number; recall_phrases: string[] | null }
interface LessonChar { lesson_key: string; char_key: string; track: string; sort_order: number; pinyin_in_lesson: string | null }
interface Char { char_key: string; char: string; pinyin: string; phrases: string[] }

export async function chineseCatalog(kind: CatalogKind): Promise<Catalog> {
  const { CHINESE_BOOKS, getBookLessonPassages, getBookPoems, getBookAccumulation, getBookPinyinWriteWords } = await import('@rosie/chinese')
  const groups: CatalogGroup[] = []
  if (kind === 'chinesePoems' || kind === 'chineseAccumulation') {
    for (const book of CHINESE_BOOKS.filter((b) => b.isOpen)) {
      for (const unit of book.units) {
        const rows: PracticeEntryRow[] = kind === 'chinesePoems'
          ? getBookPoems(book.slug).filter((poem) => poem.unit === unit.unit).map((poem) => ({
            id: `poem:${book.slug}:${poem.id}`, label: `${book.label} · ${poem.title}`,
            values: { bookSlug: book.slug, poemId: poem.id, unit: String(unit.unit) },
            content: [{ title: poem.title, text: `${poem.dynasty} · ${poem.author}\n${poem.lines.join('\n')}` }],
          }))
          : getBookAccumulation(book.slug).filter((item) => item.unit === unit.unit).map((item, index) => ({
            id: `accumulation:${book.slug}:${unit.unit}:${index}`, label: `${book.label} · 第${unit.unit}单元日积月累`,
            values: { bookSlug: book.slug, unit: String(unit.unit) },
            content: [{ title: '日积月累', text: item.items.map((line) => [line.text, line.answer, line.source].filter(Boolean).join(' ')).join('\n') }],
          }))
        if (kind === 'chineseAccumulation') {
          rows.push(...getBookPoems(book.slug).filter((poem) => poem.unit === unit.unit && poem.source === 'garden').map((poem) => ({
            id: `accumulation-poem:${book.slug}:${poem.id}`, label: `${book.label} · 第${unit.unit}单元日积月累 · ${poem.title}`,
            values: { bookSlug: book.slug, unit: String(unit.unit) },
            content: [{ title: poem.title, text: `${poem.dynasty} · ${poem.author}\n${poem.lines.join('\n')}` }],
          })))
        }
        if (rows.length) groups.push({ id: `${book.slug}:${unit.unit}`, label: `${book.label} · ${unit.title}`, rows: rows.map((row) => ({ ...row, selectionPath: [{ level: '教材', id: book.slug, label: book.label }, { level: '单元', id: String(unit.unit), label: unit.title }] })) })
      }
    }
    return { subject: 'chinese', path: kind === 'chinesePoems' ? '/chinese/{bookSlug}/poems/{poemId}' : '/chinese/{bookSlug}/accumulation?unit={unit}', groups }
  }
  const [lessons, lessonChars, chars] = await Promise.all([
    readAll<Lesson>('chinese_lessons', 'lesson_key,grade,semester,unit,lesson,lesson_kind,lesson_title,sort_order,recall_phrases', 'lesson_key'),
    readAll<LessonChar>('chinese_lesson_chars', 'lesson_key,char_key,track,sort_order,pinyin_in_lesson', 'lesson_key,sort_order,char_key,track'),
    readAll<Char>('chinese_char_entries', 'char_key,char,pinyin,phrases', 'char_key'),
  ])
  const byChar = new Map(chars.map((c) => [c.char_key, c]))
  for (const book of CHINESE_BOOKS.filter((b) => b.isOpen)) {
    const passages = new Map(getBookLessonPassages(book.slug).map((p) => [p.lessonKey, p]))
    for (const unit of book.units) {
      const rows: PracticeEntryRow[] = []
      const unitLessons = lessons.filter(l => l.grade === book.grade && l.semester === book.semester && l.unit === unit.unit)
      const localLessonKey = (item: typeof unit.lessons[number]) => item.kind === 'garden' ? `u${unit.unit}-garden` : item.kind === 'happy_reading' ? `u${unit.unit}-happy-reading` : `u${unit.unit}-l${item.lesson}`
      const orderedLessons: Lesson[] = kind === 'chineseCourse' ? unit.lessons.map((item, index) => {
        const key = localLessonKey(item)
        return unitLessons.find(lesson => lesson.lesson_key.split('::').pop() === key) ?? {
          lesson_key: `${book.slug}::${key}`, grade: book.grade, semester: book.semester,
          unit: unit.unit, lesson: item.lesson, lesson_kind: item.kind ?? 'lesson',
          lesson_title: item.title, sort_order: index, recall_phrases: null,
        }
      }) : unitLessons.sort((a, b) => a.sort_order - b.sort_order || a.lesson_key.localeCompare(b.lesson_key))
      for (const lesson of orderedLessons) {
        const localKey = lesson.lesson_key.split('::').pop()!
        const links = lessonChars.filter((c) => c.lesson_key === lesson.lesson_key)
        const recognize = links.filter((c) => c.track === 'recognize')
        const content: PracticeContentBlock[] = []
        if (kind === 'chineseCourse') {
          const renderChars = (track: string) => links.filter(link => link.track === track).flatMap(link => {
            const char = byChar.get(link.char_key)
            return char ? [char.char] : []
          })
          const recognizeChars = renderChars('recognize')
          const writeChars = renderChars('write')
          if (recognizeChars.length) content.push({ title: '会认字', text: recognizeChars.join('　') })
          if (writeChars.length) content.push({ title: '会写字', text: writeChars.join('　') })
          const words = getBookPinyinWriteWords(book.slug).filter(word => word.lessonKey.split('::').pop() === localKey).map(word => word.word)
          if (words.length) content.push({ title: '词语', text: [...new Set(words)].join('　') })
          if (lesson.recall_phrases?.length) content.push({ title: '读一读，记一记', text: lesson.recall_phrases.join('　') })
          const poems = getBookPoems(book.slug).filter(poem => poem.unit === lesson.unit &&
            (poem.source === 'garden' ? lesson.lesson_kind === 'garden' : poem.lesson === lesson.lesson))
          for (const poem of poems) content.push({ title: `${poem.title}${poem.requiresRecite ? ' · 需背诵' : ''}`, text: `${poem.dynasty} · ${poem.author}\n${poem.lines.join('\n')}` })
          const metadata = unit.lessons.find(item => localLessonKey(item) === localKey)
          const passage = passages.get(localKey)
          if (metadata?.requiresRecite && !poems.length && passage) content.push({ title: '需背诵 · 课文', text: passage.paragraphs.join('\n\n') })
          if (lesson.lesson_kind === 'garden') for (const item of getBookAccumulation(book.slug).filter(item => item.unit === lesson.unit))
            content.push({ title: '日积月累', text: item.items.map(line => [line.text, line.answer, line.source].filter(Boolean).join(' ')).join('\n') })
        } else if (kind === 'chineseReading') {
          const passage = passages.get(localKey)
          if (!passage) continue
          content.push({ title: lesson.lesson_title, text: passage.paragraphs.join('\n\n') })
        } else {
          if (kind === 'chineseRecognize' && !recognize.length) continue
          const characters = recognize.flatMap((link) => {
            const char = byChar.get(link.char_key)
            return char ? [`${char.char}（${link.pinyin_in_lesson || char.pinyin}）`] : []
          })
          const words = getBookPinyinWriteWords(book.slug).filter((word) => word.lessonKey.split('::').pop() === localKey).map((word) => word.word)
          const phrases = [...new Set(links.flatMap((link) => byChar.get(link.char_key)?.phrases ?? []))]
          if (kind !== 'chineseWords' && characters.length) content.push({ title: '会认字', text: characters.join('　') })
          if (words.length) content.push({ title: '本课词语', text: [...new Set(words)].join('　') })
          if (lesson.recall_phrases?.length) content.push({ title: '读一读，记一记', text: lesson.recall_phrases.join('\n') })
          if (phrases.length) content.push({ title: '生字组词', text: phrases.join('　') })
          if (!content.length) continue
          if (kind === 'chineseWords' && !words.length && !phrases.length && !lesson.recall_phrases?.length) continue
          if (kind === 'chineseChars' && !links.length) continue
          for (const poem of getBookPoems(book.slug).filter((p) => p.unit === lesson.unit &&
            (p.source === 'garden' ? lesson.lesson_kind === 'garden' : p.lesson === lesson.lesson)))
            content.push({ title: poem.title, text: `${poem.dynasty} · ${poem.author}\n${poem.lines.join('\n')}` })
          if (lesson.lesson_kind === 'garden') for (const item of getBookAccumulation(book.slug).filter((a) => a.unit === lesson.unit))
            content.push({ title: '日积月累', text: item.items.map((line) => [line.text, line.answer, line.source].filter(Boolean).join(' ')).join('\n') })
        }
        rows.push({ id: `${kind}:${lesson.lesson_key}`, label: `${book.label} · ${lesson.lesson_title}`,
          values: { bookSlug: book.slug, lessonKey: localKey, unit: String(lesson.unit), ...(kind === 'chineseCourse' ? { contentType: 'chinese-course', grade: String(book.grade), courseOrder: String(lesson.sort_order), requiresRecite: String(content.some(block => block.title.includes('需背诵')) ? true : unit.lessons.find(item => localLessonKey(item) === localKey)?.requiresRecite ?? 'unknown') } : {}) }, content })
      }
      if (rows.length) groups.push({ id: `${book.slug}:${unit.unit}`, label: `${book.label} · ${unit.title}`, rows: rows.map((row) => ({ ...row, selectionPath: [...(kind === 'chineseCourse' ? [{ level: '年级', id: String(book.grade), label: `${book.grade}年级` }] : []), { level: '教材', id: book.slug, label: book.label }, { level: '单元', id: String(unit.unit), label: unit.title }] })) })
    }
  }
  return { subject: 'chinese', path: kind === 'chineseCourse' ? '/chinese/{bookSlug}/units/{unit}?lesson={lessonKey}' : kind === 'chineseReading' ? '/chinese/{bookSlug}/reading/{lessonKey}' : '/chinese/{bookSlug}/chars/practice?lessons={lessonKey}', groups }
}
