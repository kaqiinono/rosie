'use client'
import { materialProblemProjection } from './materialCatalogProjection'
import {
  CourseMaterialList,
  MaterialPicker,
  MaterialPreview,
  resolveMaterials,
  useMaterialData,
} from '@rosie/materials'
import type { TaskCatalogAdapter, TaskMaterialAdapter } from '@rosie/tasks'
export function TaskAssetList({ ids }: { ids: string[] }) {
  const api = useMaterialData()
  return (
    <div className="space-y-2">
      {ids.map((id) => {
        const a = api.data.assets.find((a) => a.id === id)
        return a ? (
          <div key={id} className="text-sm">
            <p>
              {a.title}
              {a.status === 'archived' ? '（已归档）' : ''}
            </p>
            <MaterialPreview asset={a} />
          </div>
        ) : null
      })}
    </div>
  )
}
export function useTaskMaterialsBridge() {
  const api = useMaterialData()
  const option = (a: (typeof api.data.assets)[number]) => ({
    id: a.id,
    title: a.title,
    kind: a.kind,
    preview_ref: `/materials?asset=${a.id}`,
  })
  const materials: TaskMaterialAdapter = {
    listForCourse: async (courseId, scope) =>
      api.data.links
        .filter(
          (l) =>
            l.course_id === courseId &&
            (scope.kind === 'all' || JSON.stringify(scope) === JSON.stringify(l.scope)),
        )
        .flatMap((l) => {
          const a = api.data.assets.find((a) => a.id === l.asset_id)
          return a ? [option(a)] : []
        }),
    pickAssets: async (subject, ids) =>
      api
        .listAssets({ subject })
        .filter((a) => !ids.length || ids.includes(a.id))
        .map(option),
    resolve: async (courseId, _scope, selector, content) => {
      if (!api.user) throw Error('请先登录')
      const data = await api.readyData()
      return resolveMaterials(api.user.id, courseId, selector, content, data.assets, data.links)
    },
  }
  const renderMaterialPicker: TaskCatalogAdapter['renderMaterialPicker'] = (props) => (
    <MaterialPicker {...props} />
  )
  const renderCourseMaterials: TaskCatalogAdapter['renderCourseMaterials'] = ({
    course,
    content,
    snapshot,
  }) => (
    <CourseMaterialList
      courseId={course.id}
      subject={course.subject}
      content={content}
      catalog={{
        lessons: snapshot?.ordered_lessons ?? [],
        segments: snapshot?.teaching_segments ?? [],
        problems: materialProblemProjection([
          ...new Set(snapshot?.teaching_segments.flatMap((s) => s.problem_keys) ?? []),
        ]),
      }}
    />
  )
  return {
    materials,
    renderMaterialPicker,
    renderCourseMaterials,
    renderTaskMaterials: (ids: string[]) => <TaskAssetList ids={ids} />,
  }
}
