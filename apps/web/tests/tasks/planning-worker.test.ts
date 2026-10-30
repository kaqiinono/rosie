import { describe, expect, it, vi, beforeEach } from 'vitest'
import { runPlanningJobs, planningExpiry } from '@/lib/task-planning-worker'
import { POST as ownerPost, GET as ownerGet } from '@/app/api/tasks/planning/route'
import { POST as internalPost } from '@/app/api/internal/task-planning/recompute/route'
const auth = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/api-auth', () => ({
  getUserFromRequest: auth.user,
  getBearerToken: () => 'verified-token',
  createAuthedSupabase: () => ({ rpc: auth.rpc }),
  createAdminSupabase: () => ({ rpc: auth.rpc }),
  unauthorizedResponse: () => new Response('{}', { status: 401 }),
}))
const snapshot = {
  user_id: 'owner',
  input_revision: 1,
  shared_revision: 2,
  now: '2030-10-30T00:00:00Z',
  tight_ratio: 0.2,
  courses: [],
  rules: [],
  exceptions: [],
  occurrences: [],
  events: [],
  catalog_snapshots: [],
  bindings: [],
  pool_items: [],
  tasks: [],
  day_states: [],
  windows: [],
  blocks: [],
  exams: [],
  material_links: [],
  material_assets: [],
  previous_allocations: [],
}
function rpcFixture(fail?: string) {
  return vi.fn(async (name: string): Promise<unknown> => {
    if (name === fail) throw new Error('interrupted')
    if (name === 'task_claim_planning_jobs') return [{ user_id: 'owner', lease_id: 'lease' }]
    if (name === 'task_planning_input') return snapshot
    return true
  })
}
describe('planning worker', () => {
  it('uses shared builder/solver and publishes both revisions and lease identity', async () => {
    const rpc = rpcFixture()
    expect(await runPlanningJobs(2, rpc)).toMatchObject({ published: 1, failed: 0 })
    expect(rpc).toHaveBeenCalledWith(
      'task_publish_planning',
      expect.objectContaining({
        p_user: 'owner',
        p_lease: 'lease',
        p_shared_revision: 2,
        p_input: expect.objectContaining({ input_revision: 1 }),
        p_next: '2030-10-30T00:01:00.000Z',
      }),
    )
  })
  it('does not publish an expired lease', async () => {
    const rpc = rpcFixture()
    rpc.mockImplementation(async (n) =>
      n === 'task_claim_planning_jobs'
        ? [{ user_id: 'owner', lease_id: 'old' }]
        : n === 'task_planning_input'
          ? snapshot
          : false,
    )
    expect(await runPlanningJobs(1, rpc)).toMatchObject({ stale: 1, published: 0 })
    expect(rpc.mock.calls.map((c) => c[0])).not.toContain('task_publish_planning')
  })
  it('records retry after interruption and reports rejected stale publication', async () => {
    expect(await runPlanningJobs(1, rpcFixture('task_planning_input'))).toMatchObject({
      retried: 1,
      failed: 1,
    })
    const rpc = rpcFixture()
    const impl = rpc.getMockImplementation()!
    rpc.mockImplementation((n) =>
      n === 'task_publish_planning' ? Promise.resolve(false) : impl(n),
    )
    expect(await runPlanningJobs(1, rpc)).toMatchObject({ stale: 1, published: 0 })
  })
  it('expires at an earlier capacity/release boundary', () => {
    expect(
      planningExpiry({
        input_revision: 1,
        now: snapshot.now,
        horizon_end: '2031-01-01T00:00:00Z',
        demands: [],
        capacity: [
          {
            key: 'x',
            start: '2030-10-30T00:00:15Z',
            end: '2030-10-30T01:00:00Z',
            minutes: 60,
            kind: 'regular',
          },
        ],
        fixed_blocks: [],
        previous_allocations: [],
        configuration_issues: [],
      }),
    ).toBe('2030-10-30T00:00:15.000Z')
  })
})
describe('route ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.user.mockResolvedValue(null)
  })
  it('rejects unauthenticated reads and writes', async () => {
    expect((await ownerGet(new Request('https://local/api/tasks/planning'))).status).toBe(401)
    expect(
      (await ownerPost(new Request('https://local/api/tasks/planning', { method: 'POST' }))).status,
    ).toBe(401)
  })
  it('uses authenticated RPC and does not accept a query owner', async () => {
    auth.user.mockResolvedValue({ id: 'owner' })
    auth.rpc.mockResolvedValue({ data: { stale: true }, error: null })
    expect(
      (await ownerGet(new Request('https://local/api/tasks/planning?user_id=victim'))).status,
    ).toBe(200)
    expect(auth.rpc).toHaveBeenCalledWith('task_planning_status')
  })
  it('ignores spoofed owner in POST and claims only the verified owner', async () => {
    auth.user.mockResolvedValue({ id: 'verified-owner' })
    auth.rpc.mockImplementation(async (name: string) => ({
      data: name === 'task_claim_planning_jobs' ? [] : null,
      error: null,
    }))
    const response = await ownerPost(
      new Request('https://local/api/tasks/planning', {
        method: 'POST',
        body: JSON.stringify({ user_id: 'victim' }),
      }),
    )
    expect(response.status).toBe(200)
    expect(auth.rpc).toHaveBeenCalledWith('task_claim_planning_jobs', {
      p_limit: 1,
      p_user: 'verified-owner',
    })
  })
  it('rejects absent and wrong internal secrets', async () => {
    vi.stubEnv('TASK_PLANNING_CRON_SECRET', 'configured-secret')
    expect(
      (
        await internalPost(
          new Request('https://local', {
            method: 'POST',
            headers: { Authorization: 'Bearer wrong' },
          }),
        )
      ).status,
    ).toBe(401)
    vi.stubEnv('TASK_PLANNING_CRON_SECRET', '')
    expect((await internalPost(new Request('https://local', { method: 'POST' }))).status).toBe(401)
    vi.unstubAllEnvs()
  })
})
