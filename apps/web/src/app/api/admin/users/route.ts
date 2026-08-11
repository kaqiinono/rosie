import { NextResponse } from 'next/server'
import { createAdminSupabase, forbiddenResponse, requireAdminFromRequest } from '@/lib/api-auth'
import { isValidManagedEmail, isValidManagedUserId, selfMutationError } from '@/lib/user-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'user_admin_error'
  return NextResponse.json({ error: message }, { status: 500 })
}

export async function GET(req: Request) {
  const actor = await requireAdminFromRequest(req)
  if (!actor) return forbiddenResponse()

  const url = new URL(req.url)
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const perPage = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get('perPage') ?? '50', 10) || 50),
  )

  try {
    const admin = createAdminSupabase()
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    return NextResponse.json({
      users: data.users.map((user) => ({
        id: user.id,
        email: user.email ?? '',
        recoveryEmail:
          typeof user.user_metadata?.recovery_email === 'string'
            ? user.user_metadata.recovery_email
            : '',
        isAdmin: user.app_metadata?.role === 'admin',
        isCurrent: user.id === actor.id,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      })),
      page,
      perPage,
      total: data.total ?? data.users.length,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(req: Request) {
  const actor = await requireAdminFromRequest(req)
  if (!actor) return forbiddenResponse()

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const userId = body.userId
  const action = body.action
  if (!isValidManagedUserId(userId) || typeof action !== 'string') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  try {
    const admin = createAdminSupabase()
    const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(userId)
    if (targetError || !targetData.user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
    }
    const target = targetData.user

    if (action === 'profile') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const recoveryEmail =
        typeof body.recoveryEmail === 'string' ? body.recoveryEmail.trim().toLowerCase() : ''
      if (!isValidManagedEmail(email) || (recoveryEmail && !isValidManagedEmail(recoveryEmail))) {
        return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
      }

      const { data, error } = await admin.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
        user_metadata: {
          ...target.user_metadata,
          recovery_email: recoveryEmail || null,
        },
      })
      if (error) throw error
      return NextResponse.json({ ok: true, userId: data.user.id })
    }

    if (action === 'admin') {
      const isAdmin = body.isAdmin === true
      const selfError = !isAdmin
        ? selfMutationError({ actorId: actor.id, targetId: userId, action: 'demote' })
        : null
      if (selfError) {
        return NextResponse.json({ error: selfError }, { status: 409 })
      }
      const nextAppMetadata = { ...target.app_metadata }
      if (isAdmin) nextAppMetadata.role = 'admin'
      else delete nextAppMetadata.role

      const { error } = await admin.auth.admin.updateUserById(userId, {
        app_metadata: nextAppMetadata,
      })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'password') {
      const password = typeof body.password === 'string' ? body.password : ''
      if (password.length < 8 || password.length > 128) {
        return NextResponse.json({ error: 'invalid_password' }, { status: 400 })
      }
      const { error } = await admin.auth.admin.updateUserById(userId, { password })
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(req: Request) {
  const actor = await requireAdminFromRequest(req)
  if (!actor) return forbiddenResponse()

  const userId = new URL(req.url).searchParams.get('id')
  if (!isValidManagedUserId(userId)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  const selfError = selfMutationError({ actorId: actor.id, targetId: userId, action: 'delete' })
  if (selfError) {
    return NextResponse.json({ error: selfError }, { status: 409 })
  }

  try {
    const admin = createAdminSupabase()
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
