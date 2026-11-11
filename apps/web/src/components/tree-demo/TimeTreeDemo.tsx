'use client'

import dynamic from 'next/dynamic'
import { LoadingOverlay } from '@rosie/ui'

// 原型依赖浏览器时间、画布和音频，随机的样例数据也不能在服务端渲染，所以只在浏览器里加载。
const GardenDemo = dynamic(() => import('./garden/GardenDemo'), {
  ssr: false,
  loading: () => <LoadingOverlay visible placement="content" />,
})

export default function TimeTreeDemo() {
  return <GardenDemo />
}
