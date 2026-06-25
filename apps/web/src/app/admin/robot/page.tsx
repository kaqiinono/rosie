'use client'

import { useAuth } from '@rosie/core'
import { RobotTaskManager } from '@rosie/robot'

export default function AdminRobotPage() {
  const { user } = useAuth()
  return <RobotTaskManager user={user} />
}
