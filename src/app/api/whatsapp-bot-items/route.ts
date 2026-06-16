import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import { isAllowedRole } from '@/lib/auth'
import { isWhatsAppCompany } from '@/lib/whatsapp-company'

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
    return NextResponse.json({ success: true, data: result.data })
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
    return NextResponse.json({ success: true, data: result.data })
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
