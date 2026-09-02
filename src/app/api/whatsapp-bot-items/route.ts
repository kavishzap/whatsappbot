import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/admin'
import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import { isAllowedRole } from '@/lib/auth'
import { isWhatsAppCompany } from '@/lib/whatsapp-company'
import { deleteStoredProductMedia } from '@/lib/delete-product-media'
import { attachCoverUrls } from '@/lib/attach-product-covers'

function visibilityUpdates(body: Record<string, unknown>): Record<string, boolean> | null {
  const updates: Record<string, boolean> = {}
  if ('is_website' in body) updates.is_website = body.is_website === true
  if ('is_whatsapp' in body) updates.is_whatsapp = body.is_whatsapp === true
  if ('promo' in body) updates.promo = body.promo === true
  if ('pre_order' in body) updates.pre_order = body.pre_order === true
  if ('sold_out' in body) updates.sold_out = body.sold_out === true
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

async function withCoverUrls(data: unknown): Promise<unknown> {
  if (Array.isArray(data)) {
    const items = data.filter(
      (item): item is { id: string } =>
        Boolean(item) && typeof item === 'object' && 'id' in item && typeof item.id === 'string'
    )
    if (items.length === 0) return data
    const withCovers = await attachCoverUrls(items)
    const coverById = new Map(withCovers.map(item => [item.id, item.cover_url]))
    return data.map(item =>
      item && typeof item === 'object' && 'id' in item && typeof item.id === 'string'
        ? { ...item, cover_url: coverById.get(item.id) ?? null }
        : item
    )
  }

  if (data && typeof data === 'object' && 'id' in data && typeof data.id === 'string') {
    const [withCover] = await attachCoverUrls([{ id: data.id }])
    return { ...data, cover_url: withCover?.cover_url ?? null }
  }

  return data
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
    const data = await withCoverUrls(result.data)
    return NextResponse.json({ success: true, data })
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
    await deleteStoredProductMedia(id)
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
