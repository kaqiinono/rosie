import type { ExamTemplate } from '../types/content'

const b1Band = { min: 0, max: 5 }

export const PET_SCHOOLS_2020_TEMPLATE = {
  id: 'pet-schools-2020-v1',
  version: 1,
  examType: 'pet',
  title: 'B1 Preliminary for Schools · 2020',
  sections: [
    {
      id: 'reading', label: '阅读', objectiveQuestionCount: 32, writingTaskCount: 0, speakingPartCount: 0,
      timing: { kind: 'fixed_duration', seconds: 2700 },
      parts: [
        { number: 1, label: '短信息', domains: ['reading'], questionTypeId: 'short_messages', answerTypes: ['single_choice'] },
        { number: 2, label: '多文本匹配', domains: ['reading'], questionTypeId: 'multiple_text_matching', answerTypes: ['matching'] },
        { number: 3, label: '长文选择', domains: ['reading'], questionTypeId: 'long_text_choice', answerTypes: ['single_choice'] },
        { number: 4, label: '阅读补句', domains: ['reading'], questionTypeId: 'gapped_text', answerTypes: ['gap_fill'] },
        { number: 5, label: '选词填空', domains: ['reading'], questionTypeId: 'multiple_choice_cloze', answerTypes: ['single_choice'] },
        { number: 6, label: '开放填空', domains: ['reading'], questionTypeId: 'open_cloze', answerTypes: ['gap_fill'] },
      ],
    },
    {
      id: 'writing', label: '写作', objectiveQuestionCount: 0, writingTaskCount: 2, speakingPartCount: 0,
      timing: { kind: 'fixed_duration', seconds: 2700 },
      parts: [
        { number: 1, label: '回复邮件', domains: ['writing'], questionTypeId: 'email_note', answerTypes: ['writing'] },
        { number: 2, label: '文章／故事二选一', domains: ['writing'], questionTypeId: 'article_or_story', answerTypes: ['writing'], writingChoice: true },
      ],
    },
    {
      id: 'listening', label: '听力', objectiveQuestionCount: 25, writingTaskCount: 0, speakingPartCount: 0,
      timing: { kind: 'reviewed_audio_program' },
      parts: [
        { number: 1, label: '图片选择', domains: ['listening'], questionTypeId: 'picture_choice', answerTypes: ['single_choice'] },
        { number: 2, label: '短对话选择', domains: ['listening'], questionTypeId: 'short_dialogue_choice', answerTypes: ['single_choice'] },
        { number: 3, label: '信息填空', domains: ['listening'], questionTypeId: 'information_gap_fill', answerTypes: ['gap_fill'] },
        { number: 4, label: '访谈选择', domains: ['listening'], questionTypeId: 'interview_choice', answerTypes: ['single_choice'] },
      ],
    },
    {
      id: 'speaking', label: '口语', objectiveQuestionCount: 0, writingTaskCount: 0, speakingPartCount: 4,
      timing: { kind: 'record_elapsed' },
      parts: [
        { number: 1, label: '访谈', domains: ['speaking'], questionTypeId: 'interview', answerTypes: ['speaking'] },
        { number: 2, label: '照片描述', domains: ['speaking'], questionTypeId: 'extended_turn', answerTypes: ['speaking'], speakingCandidatePhotos: true },
        { number: 3, label: '情境讨论', domains: ['speaking'], questionTypeId: 'picture_discussion', answerTypes: ['speaking'] },
        { number: 4, label: '延伸对话', domains: ['speaking'], questionTypeId: 'general_conversation', answerTypes: ['speaking'] },
      ],
    },
  ],
  // Scales in the Cambridge B1 Preliminary for Schools teachers' handbook.
  rubrics: [
    { id: 'pet-writing-v1', domain: 'writing', dimensions: [
      { id: 'content', label: '内容', range: b1Band },
      { id: 'communicative_achievement', label: '交际达成', range: b1Band },
      { id: 'organisation', label: '组织', range: b1Band },
      { id: 'language', label: '语言', range: b1Band },
    ] },
    { id: 'pet-speaking-v1', domain: 'speaking', dimensions: [
      { id: 'grammar_vocabulary', label: '语法与词汇', range: b1Band },
      { id: 'discourse_management', label: '语篇管理', range: b1Band },
      { id: 'pronunciation', label: '发音', range: b1Band },
      { id: 'interactive_communication', label: '互动交流', range: b1Band },
      { id: 'global_achievement', label: '整体表现', range: b1Band },
    ] },
  ],
} as const satisfies ExamTemplate
