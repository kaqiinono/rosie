'use client'
import { materialProblemProjection } from './materialCatalogProjection'
import { DirectoryImport, MaterialUpload, MaterialsPage } from '@rosie/materials'
import { useTaskData } from '@rosie/tasks'
export default function MaterialsHost() {
  const tasks = useTaskData()
  const courses = tasks.data.courses
    .filter((c) => !c.archived_at)
    .map((c) => {
      const s = tasks.data.catalog_snapshots.find((s) => s.id === c.catalog_snapshot_id)
      return {
        id: c.id,
        title: c.name,
        subject: c.subject,
        catalog: {
          lessons: s?.ordered_lessons ?? [],
          segments: s?.teaching_segments ?? [],
          problems: materialProblemProjection(
            s?.teaching_segments.flatMap((x) => x.problem_keys) ?? [],
          ),
        },
      }
    })
  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <MaterialUpload courses={courses} />
        <DirectoryImport
          courses={tasks.data.courses
            .filter((c) => !c.archived_at)
            .map((c) => {
              const s = tasks.data.catalog_snapshots.find((s) => s.id === c.catalog_snapshot_id)
              return {
                id: c.id,
                title: c.name,
                subject: c.subject,
                catalog: {
                  lessons: s?.ordered_lessons ?? [],
                  segments: s?.teaching_segments ?? [],
                  problems: materialProblemProjection(
                    s?.teaching_segments.flatMap((x) => x.problem_keys) ?? [],
                  ),
                },
              }
            })}
        />
      </div>
      <MaterialsPage />
    </>
  )
}
