import { NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import { isAllowedRole } from '@/lib/auth'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

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

type BulkAction = 'approve' | 'delete'

export async function POST(request: Request) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      company?: WhatsAppCompany
      action?: BulkAction
      ids?: string[]
    }

    const company = body.company
    const action = body.action
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : []

    if (company !== 'spark' && company !== 'sodamax') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid company (spark|sodamax)' },
        { status: 400 }
      )
    }

    if (action !== 'approve' && action !== 'delete') {
      return NextResponse.json({ success: false, error: 'Invalid action (approve|delete)' }, { status: 400 })
    }

    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'No orders selected' }, { status: 400 })
    }

    const result = await invokeEdgeFunction<{ affected: number; ids: string[] }>('whatsapp-bot-orders', {
      method: 'PATCH',
      body: {
        company,
        bulk_action: action,
        ids,
      },
    })

    return NextResponse.json({ success: true, data: result.data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
