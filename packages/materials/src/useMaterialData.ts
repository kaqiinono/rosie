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
type MaterialData = { assets: MaterialAsset[]; links: CourseMaterialLink[] }
// The shared store intentionally keeps ready display data during background refresh.
// Track every actual fetch (including remount retries) so all forecast consumers await
// the same latest read, rather than interpreting stale display readiness as authority.
const latestReads = new Map<string, Promise<MaterialData>>()
const store = createUserSessionStore<MaterialData>('shared-materials', {
  empty: { assets: [], links: [] },
  fetch: (user) => {
    const pending = Promise.all([
      loadRows('material_assets'),
      loadRows('course_material_links', user),
    ]).then(([assets, links]) => ({
      assets: assets as MaterialAsset[],
      links: links as CourseMaterialLink[],
    }))
    latestReads.set(user, pending)
    return pending
  },
})
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
      for (;;) {
        const latest = latestReads.get(userId)
        if (!latest) break
        try {
          await latest
        } catch (error) {
          if (latestReads.get(userId) === latest) throw error
        }
        if (latestReads.get(userId) === latest) break
      }
      const snapshot = store.getSnapshot(userId)
      if (snapshot.error) throw snapshot.error
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
