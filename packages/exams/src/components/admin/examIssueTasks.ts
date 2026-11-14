import type { MediaSlot, QuestionGroup } from '../../types/content'
import type { Question } from '../../types/questions'
import type { ExamDraftInput, ValidationIssue } from '../../validation/contracts'

export type IssueAction = 'content' | 'words' | 'raw' | 'images' | 'media' | 'review'
export type ExamIssueTask = {
  key: string
  location: string
  message: string
  reason?: string
  action: IssueAction
  issues: ValidationIssue[]
}

const MESSAGES: Record<string, string> = {
  review_blocked: '此项已标记为阻断，需先解决来源或内容冲突。',
  review_pending: '请对照原书确认此项内容和来源。',
  source_missing: '请补充原书页码和来源位置。',
  groups_missing: '尚未添加完整题组。',
  material_empty: '请补充阅读材料或题组共用内容。',
  material_ungrouped: '请将这份材料关联到对应题组。',
  questions_missing: '此题组尚未添加题目。',
  ambiguous_pool_labels: '选项池存在同名选项，请确认并修正。',
  pool_combinations_review_required: '共用选项不能重复使用，请核对各题允许的答案组合。',
  answer_missing: '请补充标准答案或人工评阅指导。',
  explanation_missing: '请补充并审核题目解析。',
  evidence_missing: '请补充解析依据及对应原书位置。',
  writing_sample_missing: '请补充并审核写作范文。',
  writing_guidance_missing: '请补充本题的写作指导。',
  rubric_incomplete: '请补全主观题评分维度与分值范围。',
  rubric_descriptors_unverified: '请核对评分档位说明与评阅流程，完成评分量表审核。',
  section_coverage_incomplete: '试卷题数或任务数与考试模板不一致，请核对完整性。',
  part_missing: '试卷还有部分未添加题组，请按考试模板补齐。',
  media_binding_missing: '整份内容尚未保存媒体绑定，请先绑定所需图片和音频。',
  media_availability_unverified: '资源尚未确认可用，请核对文件绑定、授权和审核状态。',
  publication_media_unverified: '资源尚未确认可用，请核对文件绑定、授权和审核状态。',
  playback_unconfigured: '请设置并确认音频播放次数、停顿时间及原音频是否已包含重复。',
  listening_media_missing: '请添加听力音频及完整播放程序。',
  publication_review_required: '当前版本还没有审核记录。这不影响发布，需要时可以再核对。',
  publication_material_family_required: '请关联有原书依据的材料，并补充用于识别同源材料的标识。',
  publication_readiness_limit: '待办过多，当前报告尚未列全。请处理已列事项后保存并重新读取。',
  exam_invalid_vocabulary_reference: '关联词条与当前词库不一致，请重新选择词条。',
  exam_media_unavailable: '暂时无法确认媒体可用性，请查看共享网盘授权与资源绑定后重新读取。',
}
const SECTION_NAMES: Record<string, string> = { reading_writing: '阅读与写作', listening: '听力', speaking: '口语' }
const REVIEW_NAMES: Record<string, string> = { exam: '题面与标准答案审核', explanations: '完整解析与来源审核', rubric: '评分量表审核' }

function groupLabel(group: QuestionGroup): string {
  return `${SECTION_NAMES[group.sectionId] ?? '题组'} · Part ${group.partNumber}`
}

function questionLabel(question: Question, draft: ExamDraftInput): string {
  const group = draft.content.groups.find(item => item.questions.some(value => value.id === question.id))
  return `${group ? groupLabel(group) : '题目'} · 原题号 ${question.location.questionNumber}`
}

function slotLabel(slot: MediaSlot, index: number, draft: ExamDraftInput): string {
  const group = draft.content.groups.find(item => item.id === slot.target.id)
  const question = draft.content.groups.flatMap(item => item.questions).find(item => item.id === slot.target.id
    || item.prompt.some(block => (block.kind === 'image' || block.kind === 'audio') && block.mediaSlotId === slot.id)
    || ((item.answerType === 'single_choice' || item.answerType === 'multiple_choice') && item.options.some(option => option.imageSlotId === slot.id)))
  const source = slot.provenance.sources[0]
  const image = slot.purpose.endsWith('image') || slot.purpose === 'source_page'
  const imageBlock = [...draft.content.materials.flatMap(material => material.blocks),
    ...draft.content.groups.flatMap(item => [...item.instructions, ...item.questions.flatMap(value => value.prompt)]),
  ].find(block => block.kind === 'image' && block.mediaSlotId === slot.id)
  const imageLabel = imageBlock?.kind === 'image' ? imageBlock.alt : undefined
  return [question ? questionLabel(question, draft) : group ? groupLabel(group) : '共用资源',
    imageLabel || (slot.sourceTrackLabel ? `音轨 ${slot.sourceTrackLabel}` : `${image ? '图片' : '音频'} ${index + 1}`),
    source ? `PDF 第 ${source.pdfPage} 页${source.printedPage ? `（书页 ${source.printedPage}）` : ''}` : '',
  ].filter(Boolean).join(' · ')
}

function locate(path: string, draft: ExamDraftInput | null): { label: string; slot?: MediaSlot } {
  const review = /^\$\.reviews\.(exam|explanations|rubric)$/.exec(path)
  if (review) return { label: REVIEW_NAMES[review[1]] }
  if (!draft) return { label: '内容包' }
  const choice = /^\$\.content\.groups\[(\d+)\]\.activities\[(\d+)\]\.choicePresentation\.options\[(\d+)\]\.label$/.exec(path)
  if (choice) {
    const group = draft.content.groups[Number(choice[1])]
    const activity = group?.activities?.[Number(choice[2])]
    const option = activity?.choicePresentation?.options[Number(choice[3])]
    if (group && activity) return { label: `${groupLabel(group)} · ${activity.title || `活动 ${Number(choice[2]) + 1}`} · 选项 ${option?.value || Number(choice[3]) + 1}` }
  }
  const media = /^\$\.(content|solutions)\.mediaSlots\[(\d+)\]/.exec(path)
  if (media) {
    const index = Number(media[2])
    const slot = draft[media[1] === 'content' ? 'content' : 'solutions'].mediaSlots[index]
    if (slot) return { label: slotLabel(slot, index, draft), slot }
  }
  const groupMatch = /^\$\.content\.groups\[(\d+)\](?:\.questions\[(\d+)\])?/.exec(path)
  if (groupMatch) {
    const group = draft.content.groups[Number(groupMatch[1])]
    const question = group?.questions[Number(groupMatch[2])]
    if (question) return { label: `${questionLabel(question, draft)}${path.includes('.classification') ? ' · 题目分类' : ''}` }
    if (group) return { label: groupLabel(group) }
  }
  const solution = /^\$\.solutions\.solutions\[(\d+)\]/.exec(path)
  if (solution) {
    const id = draft.solutions.solutions[Number(solution[1])]?.questionId
    const question = draft.content.groups.flatMap(group => group.questions).find(item => item.id === id)
    if (question) return { label: `${questionLabel(question, draft)} · 解答` }
  }
  const material = /^\$\.content\.materials\[(\d+)\]/.exec(path)
  if (material) return { label: draft.content.materials[Number(material[1])]?.title || '共用材料' }
  if (path.startsWith('$.content.vocabularyLinks')) return { label: '词条关联' }
  if (path.startsWith('$.solutions.teacherNotes')) return { label: '教师材料与听力原文' }
  if (path.startsWith('$.content.guidance')) return { label: '学习指导' }
  if (path.startsWith('$.content.readiness.explanations')) return { label: '整份解析' }
  if (path.startsWith('$.content.media')) return { label: '整份内容的媒体资源' }
  return { label: '整份内容' }
}

/** Read only the indicated review reason, never evaluate paths or expose answer payloads. */
function blockedReason(path: string, draft: ExamDraftInput | null): string | undefined {
  if (!draft || !/^\$(?:\.[A-Za-z][A-Za-z0-9]*|\[\d+\])+$/.test(path)) return
  let value: unknown = draft
  for (const part of path.slice(2).replace(/\[(\d+)\]/g, '.$1').split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) return
    value = (value as Record<string, unknown>)[part]
  }
  if (value && typeof value === 'object' && 'status' in value && value.status === 'blocked'
    && 'reason' in value && typeof value.reason === 'string') return value.reason
}

export function examIssueTasks(issues: readonly ValidationIssue[], draft: ExamDraftInput | null): ExamIssueTask[] {
  const tasks = new Map<string, ExamIssueTask>()
  for (const issue of issues) {
    const location = locate(issue.path, draft)
    const invalidChoiceLabel = issue.code === 'invalid_string' && /\.choicePresentation\.options\[\d+\]\.label$/.test(issue.path)
    const message = invalidChoiceLabel ? '选项文字不能为空或仅为空格，且不能超过 50000 个字符。请在共用选项中补全后保存。'
      : MESSAGES[issue.code] ?? '此处内容未通过校验，请核对内容格式；技术详情可用于进一步定位。'
    const reason = issue.code === 'review_blocked' ? blockedReason(issue.path, draft) : undefined
    const action: IssueAction = issue.code === 'publication_review_required' || issue.code.startsWith('rubric_') ? 'review'
      : location.slot?.purpose === 'question_image' && ['media_availability_unverified', 'publication_media_unverified'].includes(issue.code) ? 'images'
      : location.slot || ['media_binding_missing', 'listening_media_missing', 'exam_media_unavailable'].includes(issue.code) ? 'media'
      : issue.path.startsWith('$.content.vocabularyLinks') ? 'words'
      : invalidChoiceLabel || MESSAGES[issue.code] ? 'content' : 'raw'
    // Merge only duplicate diagnostics for the same underlying location; keep every raw issue.
    const normalizedCode = issue.code === 'publication_media_unverified' ? 'media_availability_unverified' : issue.code
    const key = `${issue.path}:${normalizedCode}`
    const existing = tasks.get(key)
    if (existing) existing.issues.push(issue)
    else tasks.set(key, { key, location: location.label, message, reason, action, issues: [issue] })
  }
  const priority = (task: ExamIssueTask) => task.issues.some(issue => issue.code === 'publication_readiness_limit') ? 0
    : task.issues.some(issue => issue.code === 'review_blocked') ? 1 : 2
  return [...tasks.values()].sort((a, b) => priority(a) - priority(b))
}
