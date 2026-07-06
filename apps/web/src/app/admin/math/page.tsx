'use client'

import { useAuth } from '@rosie/core'
import { MathImageManagerPage } from '@rosie/math'

export default function AdminMathImagesPage() {
  const { user } = useAuth()
  return <MathImageManagerPage user={user} />
}
