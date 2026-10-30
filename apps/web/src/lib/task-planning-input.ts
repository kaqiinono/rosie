import { buildPlanningInput, type UserPlanningSnapshot } from '@rosie/tasks/planning'
import { resolveMaterials } from '../../../../packages/materials/src/resolution'
import type { CourseMaterialLink, MaterialAsset } from '../../../../packages/materials/src/types'
/** Assets must come from the authenticated, readable shared-material catalog (server RLS
 * or owner-verified service read). Never accept arbitrary client-supplied readiness. */
export type ApplicationPlanningSnapshot = Omit<UserPlanningSnapshot, 'resolve_materials'> & {
  material_assets: MaterialAsset[]
  material_links: CourseMaterialLink[]
}
/** Both browser coordinator and server worker use this exact adapter and fixed now. */
export function buildTaskPlanningInput(snapshot: ApplicationPlanningSnapshot, now: string) {
  return buildPlanningInput(
    {
      ...snapshot,
      resolve_materials: (course, activity) =>
        resolveMaterials(
          snapshot.user_id,
          course.id,
          activity.material_selector,
          activity.target_snapshot,
          snapshot.material_assets,
          snapshot.material_links,
        ),
    },
    now,
  )
}
