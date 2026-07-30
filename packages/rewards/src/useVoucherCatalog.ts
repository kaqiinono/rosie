'use client'

import { useCallback, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { createUserSessionStore, supabase } from '@rosie/core'
import type { VoucherTemplate } from '@rosie/core'

interface TemplateRow {
  category: string
  label: string
  emoji: string
  gradient: string
  price_yellow: number
  price_red: number
  price_blue: number
  sort_order: number
  archived: boolean
  created_at: string
  updated_at: string
}

function rowToTemplate(r: TemplateRow): VoucherTemplate {
  return {
    category: r.category,
    label: r.label,
    emoji: r.emoji,
    gradient: r.gradient,
    priceYellow: r.price_yellow,
    priceRed: r.price_red,
    priceBlue: r.price_blue,
    sortOrder: r.sort_order,
    archived: r.archived,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export interface VoucherTemplateDraft {
  label: string
  emoji: string
  gradient: string
  priceYellow: number
  priceRed: number
  priceBlue: number
}

function slugify(label: string): string {
  const cleaned = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return cleaned
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 8)
}

async function fetchVoucherTemplates(_userId: string): Promise<VoucherTemplate[]> {
  const { data, error } = await supabase
    .from('voucher_templates')
    .select('category,label,emoji,gradient,price_yellow,price_red,price_blue,sort_order,archived,created_at,updated_at')
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('[voucher_templates] select failed', error)
    throw error
  }
  return ((data ?? []) as TemplateRow[]).map(rowToTemplate)
}

export const voucherTemplatesStore = createUserSessionStore<VoucherTemplate[]>('voucher_templates', {
  fetch: fetchVoucherTemplates,
  empty: [],
})

export function useVoucherCatalog(user: User | null) {
  const { data: templates, isLoading } = voucherTemplatesStore.useSessionData(user)

  const refresh = useCallback(async () => {
    if (!user) return
    voucherTemplatesStore.invalidate(user.id)
    await voucherTemplatesStore.ensureLoaded(user.id)
  }, [user])

  const byCategory = useMemo(() => {
    const map = new Map<string, VoucherTemplate>()
    for (const t of templates) map.set(t.category, t)
    return map
  }, [templates])

  const visible = useMemo(() => templates.filter(t => !t.archived), [templates])
  const archived = useMemo(() => templates.filter(t => t.archived), [templates])

  const getById = useCallback((category: string) => byCategory.get(category), [byCategory])

  /** Auto-generate a unique slug, falling back to a random suffix if needed. */
  const nextSlug = useCallback(
    (label: string): string => {
      const base = slugify(label)
      if (base && !byCategory.has(base)) return base
      const prefix = base || 'voucher'
      let candidate = `${prefix}_${shortId()}`
      while (byCategory.has(candidate)) candidate = `${prefix}_${shortId()}`
      return candidate
    },
    [byCategory],
  )

  const create = useCallback(
    async (draft: VoucherTemplateDraft): Promise<VoucherTemplate | null> => {
      if (!user) return null
      const category = nextSlug(draft.label)
      const current = voucherTemplatesStore.getSessionData(user.id) ?? []
      const maxSort = current.reduce((m, t) => Math.max(m, t.sortOrder), 0)
      const { data, error } = await supabase
        .from('voucher_templates')
        .insert({
          category,
          label: draft.label,
          emoji: draft.emoji,
          gradient: draft.gradient,
          price_yellow: draft.priceYellow,
          price_red: draft.priceRed,
          price_blue: draft.priceBlue,
          sort_order: maxSort + 10,
        })
        .select('category,label,emoji,gradient,price_yellow,price_red,price_blue,sort_order,archived,created_at,updated_at')
        .single()
      if (error || !data) {
        console.error('[voucher_templates] create failed', error)
        return null
      }
      const t = rowToTemplate(data as TemplateRow)
      voucherTemplatesStore.patchSessionData(user.id, (prev) =>
        [...prev, t].sort((a, b) => a.sortOrder - b.sortOrder),
      )
      return t
    },
    [user, nextSlug],
  )

  const update = useCallback(
    async (category: string, patch: Partial<VoucherTemplateDraft>): Promise<boolean> => {
      if (!user) return false
      const updatedAt = new Date().toISOString()
      const dbPatch: Record<string, unknown> = { updated_at: updatedAt }
      if (patch.label !== undefined) dbPatch.label = patch.label
      if (patch.emoji !== undefined) dbPatch.emoji = patch.emoji
      if (patch.gradient !== undefined) dbPatch.gradient = patch.gradient
      if (patch.priceYellow !== undefined) dbPatch.price_yellow = patch.priceYellow
      if (patch.priceRed !== undefined) dbPatch.price_red = patch.priceRed
      if (patch.priceBlue !== undefined) dbPatch.price_blue = patch.priceBlue
      const { error } = await supabase
        .from('voucher_templates')
        .update(dbPatch)
        .eq('category', category)
      if (error) {
        console.error('[voucher_templates] update failed', error)
        return false
      }
      voucherTemplatesStore.patchSessionData(user.id, (prev) =>
        prev.map((t) =>
          t.category === category
            ? {
                ...t,
                ...(patch.label !== undefined && { label: patch.label }),
                ...(patch.emoji !== undefined && { emoji: patch.emoji }),
                ...(patch.gradient !== undefined && { gradient: patch.gradient }),
                ...(patch.priceYellow !== undefined && { priceYellow: patch.priceYellow }),
                ...(patch.priceRed !== undefined && { priceRed: patch.priceRed }),
                ...(patch.priceBlue !== undefined && { priceBlue: patch.priceBlue }),
                updatedAt,
              }
            : t,
        ),
      )
      return true
    },
    [user],
  )

  const setArchived = useCallback(
    async (category: string, archivedFlag: boolean): Promise<boolean> => {
      if (!user) return false
      const { error } = await supabase
        .from('voucher_templates')
        .update({ archived: archivedFlag, updated_at: new Date().toISOString() })
        .eq('category', category)
      if (error) {
        console.error('[voucher_templates] archive failed', error)
        return false
      }
      voucherTemplatesStore.patchSessionData(user.id, (prev) =>
        prev.map(t => (t.category === category ? { ...t, archived: archivedFlag } : t)),
      )
      return true
    },
    [user],
  )

  return {
    templates,
    visible,
    archived,
    isLoading,
    getById,
    create,
    update,
    archive: (category: string) => setArchived(category, true),
    restore: (category: string) => setArchived(category, false),
    refresh,
  }
}

export function templateTotalPrice(t: VoucherTemplate): number {
  return t.priceYellow + t.priceRed + t.priceBlue
}
