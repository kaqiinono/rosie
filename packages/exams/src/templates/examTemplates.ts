import type { ExamTemplate, ExamTemplateRef } from '../types/content'
import { KET_SCHOOLS_2020_TEMPLATE } from './ket-schools-2020-v1'
import { PET_SCHOOLS_2020_TEMPLATE } from './pet-schools-2020-v1'

const templates: readonly ExamTemplate[] = [KET_SCHOOLS_2020_TEMPLATE, PET_SCHOOLS_2020_TEMPLATE]

export function resolveExamTemplate(ref: ExamTemplateRef) {
  return templates.find(template => template.id === ref.id && template.version === ref.version)
}
