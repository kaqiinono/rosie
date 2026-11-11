'use client'

import { Checkbox } from '@rosie/ui/themes'
import { DrawPoolManager } from '@rosie/rewards'
import { PageBreadcrumb } from '@rosie/ui'

export default function DrawPoolsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-5 px-4 py-8">
      <PageBreadcrumb variant="inline" />
      <h1 className="text-2xl font-black">奖惩管理</h1>
      <DrawPoolManager
        renderTreeToggle={({ checked, disabled, name, onChange }) => (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              aria-label={name + '可用于生命树盲盒'}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(value) => onChange(value === true)}
            />
            生命树盲盒
          </label>
        )}
      />
    </main>
  )
}
