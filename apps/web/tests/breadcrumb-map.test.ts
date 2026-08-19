import { describe, expect, it } from 'vitest'
import { buildBreadcrumb } from '@rosie/ui/breadcrumb-map'

describe('buildBreadcrumb', () => {
  it('一级页面：链只含自身（上级为首页，组件渲染返回按钮）', () => {
    expect(buildBreadcrumb('/english')).toEqual([{ label: '英语', href: '/english' }])
    expect(buildBreadcrumb('/vouchers')).toEqual([{ label: '兑换券', href: '/vouchers' }])
    expect(buildBreadcrumb('/setting')).toEqual([{ label: '设置', href: '/setting' }])
  })

  it('多级静态链：/admin/audio', () => {
    expect(buildBreadcrumb('/admin/audio')).toEqual([
      { label: '管理', href: '/admin' },
      { label: '音频管理', href: '/admin/audio' },
    ])
  })

  it('动态段回填标签与上级 href：/english/grammar/5', () => {
    expect(buildBreadcrumb('/english/grammar/5')).toEqual([
      { label: '英语', href: '/english' },
      { label: '语法', href: '/english/grammar' },
      { label: 'Unit 5', href: '/english/grammar/5' },
    ])
  })

  it('跳过无映射的中间段：/math/ny/3/5/notes（math/ny 无条目）', () => {
    expect(buildBreadcrumb('/math/ny/3/5/notes')).toEqual([
      { label: '数学', href: '/math' },
      { label: '3年级', href: '/math/ny/3' },
      { label: '第 5 讲', href: '/math/ny/3/5' },
      { label: '笔记', href: '/math/ny/3/5/notes' },
    ])
  })

  it('静态路由优先于动态段匹配：/english/grammar/study-guide', () => {
    expect(buildBreadcrumb('/english/grammar/study-guide')).toEqual([
      { label: '英语', href: '/english' },
      { label: '语法', href: '/english/grammar' },
      { label: '学习指导', href: '/english/grammar/study-guide' },
    ])
  })

  it('未知路由与首页返回 null（兜底返回按钮）', () => {
    expect(buildBreadcrumb('/unknown/page')).toBeNull()
    expect(buildBreadcrumb('/')).toBeNull()
  })

  it('容忍尾斜杠', () => {
    expect(buildBreadcrumb('/math/catalog/')).toEqual([
      { label: '数学', href: '/math' },
      { label: '目录', href: '/math/catalog' },
    ])
  })
})
