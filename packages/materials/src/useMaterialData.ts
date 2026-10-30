'use client'
import { createUserSessionStore, supabase, useAuth } from '@rosie/core'
import type { CourseMaterialLink, MaterialAsset, MaterialFilters } from './types'
async function loadRows(table: string, user?: string) {
  const rows: unknown[] = []
  for (let offset = 0; offset < 50000; offset += 500) {
    let request = supabase
      .from(table)
      .select('*')
      .order('id')
      .range(offset, offset + 499)
    if (user) request = request.eq('user_id', user)
    const { data, error } = await request
    if (error) throw error
    rows.push(...data)
    if (data.length < 500) return rows
  }
  throw Error('物料过多，无法完整读取。请联系管理员。')
}
const store = createUserSessionStore<{ assets: MaterialAsset[]; links: CourseMaterialLink[] }>(
  'shared-materials',
  {
    empty: { assets: [], links: [] },
    fetch: async (user) => {
      const [assets, links] = await Promise.all([
        loadRows('material_assets'),
        loadRows('course_material_links', user),
      ])
      return { assets: assets as MaterialAsset[], links: links as CourseMaterialLink[] }
    },
  },
)
export function useMaterialData() {
  const { user } = useAuth()
  const state = store.useSessionData(user)
  const uid = () => {
    if (!user) throw Error('请先登录')
    return user.id
  }
  return {
    ...state,
    user,
    readyData: async () => {
      const userId = uid()
      await store.ensureLoaded(userId)
      const snapshot = store.getSnapshot(userId)
      if (snapshot.status !== 'ready') throw snapshot.error ?? Error('物料尚未就绪')
      return snapshot.data
    },
    listAssets: (filters: MaterialFilters = {}) =>
      state.data.assets.filter(
        (a) =>
          (filters.includeArchived || a.status === 'ready') &&
          (!filters.subject || a.subject === filters.subject) &&
          (!filters.kind || a.kind === filters.kind) &&
          (!filters.query ||
            a.title.toLocaleLowerCase().includes(filters.query.toLocaleLowerCase())),
      ),
    refresh: () => store.refreshInBackground(uid()),
    saveAsset: async (
      input: Pick<MaterialAsset, 'subject' | 'kind' | 'title' | 'text_content' | 'href'> & {
        id?: string
        status?: MaterialAsset['status']
      },
    ) => {
      const userId = uid()
      const { data, error } = await supabase.rpc('material_save_asset', { p_input: input })
      if (error) throw error
      const asset = data as MaterialAsset
      store.patchSessionData(userId, (s) => ({
        ...s,
        assets: [...s.assets.filter((a) => a.id !== asset.id), asset],
      }))
      return asset
    },
    linkCourseMaterials: async (
      courseId: string,
      links: Pick<CourseMaterialLink, 'asset_id' | 'scope' | 'role' | 'sort_order'>[],
    ) => {
      const userId = uid()
      const { data, error } = await supabase.rpc('material_link_course', {
        p_course: courseId,
        p_links: links,
      })
      if (error) throw error
      const rows = data as CourseMaterialLink[]
      store.patchSessionData(userId, (s) => ({
        ...s,
        links: [...s.links.filter((l) => !rows.some((r) => r.id === l.id)), ...rows],
      }))
    },
    unlinkCourseMaterial: async (linkId: string) => {
      const userId = uid()
      const { error } = await supabase.rpc('material_unlink_course', { p_link: linkId })
      if (error) throw error
      store.patchSessionData(userId, (s) => ({
        ...s,
        links: s.links.filter((l) => l.id !== linkId),
      }))
    },
  }
}
export type MaterialDataApi = ReturnType<typeof useMaterialData>
