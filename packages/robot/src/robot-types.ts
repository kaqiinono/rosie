export type RobotTaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'EXPIRED' | 'COMPLETED'

/** A robot task as used in the app (camelCase). Maps to the robot_tasks row. */
export interface RobotTask {
  id: string
  title: string
  content: string
  startTime: string // HH:MM (start_time)
  endTime: string // HH:MM (end_time)
  rewardCoins: number // reward_coins
  quickLink: string // quick_link
  completedAt: string | null // completed_at; null = not completed
  sortOrder: number // sort_order
}

/** Fields a parent can configure via the CRUD form (status is never an input). */
export interface RobotTaskInput {
  title: string
  content: string
  startTime: string
  endTime: string
  rewardCoins: number
  quickLink: string
}

/** Shape Sub-project B sends to Dify (status reconstructed at the boundary). */
export interface RobotTasksSnapshot {
  tasks: RobotTask[]
}
