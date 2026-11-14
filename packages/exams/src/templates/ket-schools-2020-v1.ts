import type { ExamTemplate } from '../types/content'

/** Structure from the approved KET plan; no published papers or runtime exam policies. */
export const KET_SCHOOLS_2020_TEMPLATE = {
  id: 'ket-schools-2020-v1',
  version: 1,
  examType: 'ket',
  title: 'A2 Key for Schools · 2020',
  sections: [
    {
      id: 'reading_writing',
      label: '阅读与写作',
      objectiveQuestionCount: 30,
      writingTaskCount: 2,
      speakingPartCount: 0,
      timing: { kind: 'fixed_duration', seconds: 3600 },
      parts: [
        { number: 1, label: '短信息', domains: ['reading'], questionTypeId: 'short_messages', answerTypes: ['single_choice'] },
        { number: 2, label: '多文本匹配', domains: ['reading'], questionTypeId: 'multiple_text_matching', answerTypes: ['matching'] },
        { number: 3, label: '长文选择', domains: ['reading'], questionTypeId: 'long_text_choice', answerTypes: ['single_choice'] },
        { number: 4, label: '选词填空', domains: ['reading'], questionTypeId: 'multiple_choice_cloze', answerTypes: ['single_choice'] },
        { number: 5, label: '开放填空', domains: ['reading'], questionTypeId: 'open_cloze', answerTypes: ['gap_fill'] },
        { number: 6, label: '邮件／便条', domains: ['writing'], questionTypeId: 'email_note', answerTypes: ['writing'] },
        { number: 7, label: '三图故事', domains: ['writing'], questionTypeId: 'picture_story', answerTypes: ['writing'] },
      ],
    },
    {
      id: 'listening',
      label: '听力',
      objectiveQuestionCount: 25,
      writingTaskCount: 0,
      speakingPartCount: 0,
      timing: { kind: 'reviewed_audio_program' },
      parts: [
        { number: 1, label: '图片选择', domains: ['listening'], questionTypeId: 'picture_choice', answerTypes: ['single_choice'] },
        { number: 2, label: '信息填空', domains: ['listening'], questionTypeId: 'information_gap_fill', answerTypes: ['gap_fill'] },
        { number: 3, label: '长对话选择', domains: ['listening'], questionTypeId: 'long_dialogue_choice', answerTypes: ['single_choice'] },
        { number: 4, label: '短对话选择', domains: ['listening'], questionTypeId: 'short_dialogue_choice', answerTypes: ['single_choice'] },
        { number: 5, label: '配对', domains: ['listening'], questionTypeId: 'listening_matching', answerTypes: ['matching'] },
      ],
    },
    {
      id: 'speaking',
      label: '口语',
      objectiveQuestionCount: 0,
      writingTaskCount: 0,
      speakingPartCount: 2,
      timing: { kind: 'record_elapsed' },
      parts: [
        { number: 1, label: '访谈', domains: ['speaking'], questionTypeId: 'interview', answerTypes: ['speaking'] },
        { number: 2, label: '图片讨论', domains: ['speaking'], questionTypeId: 'picture_discussion', answerTypes: ['speaking'] },
      ],
    },
  ],
  rubrics: [
    {
      id: 'ket-writing-v1',
      domain: 'writing',
      dimensions: [
        { id: 'content', label: '内容', range: { min: 0, max: 5 } },
        { id: 'organisation', label: '组织', range: { min: 0, max: 5 } },
        { id: 'language', label: '语言', range: { min: 0, max: 5 } },
      ],
    },
    {
      id: 'ket-speaking-v1',
      domain: 'speaking',
      // Cambridge A2 Key for Schools handbook, printed pp. 50–51 (PDF pp. 52–53).
      // Numeric scales are not a claim of examiner certification or a combined score.
      dimensions: [
        { id: 'grammar_vocabulary', label: '语法与词汇', range: { min: 0, max: 5 } },
        { id: 'pronunciation', label: '发音', range: { min: 0, max: 5 } },
        { id: 'interactive_communication', label: '互动交流', range: { min: 0, max: 5 } },
        { id: 'global_achievement', label: '整体表现', range: { min: 0, max: 5 } },
      ],
    },
  ],
} as const satisfies ExamTemplate
