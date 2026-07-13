import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/admin'
import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import { isAllowedRole } from '@/lib/auth'
import { isWhatsAppCompany } from '@/lib/whatsapp-company'

function visibilityUpdates(body: Record<string, unknown>): Record<string, boolean> | null {
  const updates: Record<string, boolean> = {}
  if ('is_website' in body) updates.is_website = body.is_website === true
  if ('is_whatsapp' in body) updates.is_whatsapp = body.is_whatsapp === true
  return Object.keys(updates).length > 0 ? updates : null
}

async function persistVisibilityFlags(id: string, body: Record<string, unknown>): Promise<void> {
  const updates = visibilityUpdates(body)
  if (!updates) return

  const supabase = getServiceClient()
  const { error } = await supabase.from('whatsapp_bot_items').update(updates).eq('id', id)
  if (error) throw error
}

function mergeVisibilityIntoResponse<T extends Record<string, unknown>>(
  data: T,
  body: Record<string, unknown>
): T {
  const updates = visibilityUpdates(body)
  return updates ? { ...data, ...updates } : data
}

async function requireAuth() {
  const supabase = createAuthClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (!isAllowedRole(profile?.system_role)) return null

  return user
}

export async function GET(request: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id') ?? undefined
  const company = request.nextUrl.searchParams.get('company') ?? undefined

  if (!id && !isWhatsAppCompany(company)) {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid company (spark|sodamax)' },
      { status: 400 }
    )
  }

  try {
    const result = await invokeEdgeFunction('whatsapp-bot-items', {
      query: { id, company },
    })
    return NextResponse.json({ success: true, data: result.data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const company = isWhatsAppCompany(body.company) ? body.company : 'spark'
    const result = await invokeEdgeFunction('whatsapp-bot-items', {
      method: 'POST',
      query: { company },
      body,
    })
    const created = result.data as { id?: string } | undefined
    if (created?.id) {
      await persistVisibilityFlags(created.id, body)
    }
    const data =
      created?.id && result.data && typeof result.data === 'object'
        ? mergeVisibilityIntoResponse(result.data as Record<string, unknown>, body)
        : result.data
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const company = isWhatsAppCompany(body.company)
      ? body.company
      : request.nextUrl.searchParams.get('company') ?? undefined
    const result = await invokeEdgeFunction('whatsapp-bot-items', {
      method: 'PUT',
      query: { id, company },
      body,
    })
    await persistVisibilityFlags(id, body)
    const data =
      result.data && typeof result.data === 'object'
        ? mergeVisibilityIntoResponse(result.data as Record<string, unknown>, body)
        : result.data
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
  }

  try {
    const result = await invokeEdgeFunction('whatsapp-bot-items', {
      method: 'DELETE',
      query: { id },
    })
    return NextResponse.json({ success: true, message: result.message })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
