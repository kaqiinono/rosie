'use client'

import { isAdminUser, useAuth } from '@rosie/core'
import PageBreadcrumb from './PageBreadcrumb'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (isAdminUser(user)) return <>{children}</>

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        <h1 className="text-xl font-bold text-slate-900">需要管理员权限</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          当前账户可以继续学习，但不能打开家长管理页面。
        </p>
        <div className="mt-6 flex justify-center">
          <PageBreadcrumb variant="inline" />
        </div>
      </div>
    </main>
  )
}
