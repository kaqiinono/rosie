import { NextResponse } from 'next/server'
import { createAdminSupabase, getUserFromRequest, isAdminRequestUser } from '@/lib/api-auth'
import { isValidParentPin, verifyParentPin } from '@/lib/parent-pin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type StarSource = 'calc' | 'english' | 'math'

function shanghaiDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const admin = createAdminSupabase()
  if (!isAdminRequestUser(user)) {
    const pin = body.pin
    if (!isValidParentPin(pin)) {
      return NextResponse.json({ error: 'invalid_parent_pin' }, { status: 403 })
    }
    const { data, error } = await admin
      .from('user_parent_pins')
      .select('pin_hash,pin_salt')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: 'parent_pin_lookup_failed' }, { status: 500 })
    if (!(await verifyParentPin(pin, data))) {
      return NextResponse.json({ error: 'invalid_parent_pin' }, { status: 403 })
    }
  }

  if (body.action === 'add_stars') {
    const source = body.source
    const amount = body.amount
    if (!(['calc', 'english', 'math'] as unknown[]).includes(source) ||
        typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > 10_000) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    }
    const { error } = await admin.from('star_sessions').insert({
      user_id: user.id,
      date: shanghaiDate(),
      source: source as StarSource,
      coins_earned: amount,
    })
    if (error) return NextResponse.json({ error: 'add_stars_failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'grant_voucher') {
    const category = typeof body.category === 'string' ? body.category : ''
    if (!category || category.length > 100) {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 })
    }
    const { data: template, error: templateError } = await admin
      .from('voucher_templates').select('category,archived').eq('category', category).maybeSingle()
    if (templateError || !template || template.archived) {
      return NextResponse.json({ error: 'voucher_unavailable' }, { status: 400 })
    }
    const { error } = await admin.from('calc_vouchers').insert({
      user_id: user.id, category, coins_spent: 0,
      price_yellow: 0, price_red: 0, price_blue: 0, free: true,
    })
    if (error) return NextResponse.json({ error: 'grant_voucher_failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'bad_request' }, { status: 400 })
}
