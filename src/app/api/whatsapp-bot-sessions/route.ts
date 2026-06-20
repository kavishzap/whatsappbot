import { NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { invokeEdgeFunction } from '@/lib/supabase/edge-functions'
import { isAllowedRole } from '@/lib/auth'

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

export async function GET(request: Request) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const company = url.searchParams.get('company')
  const list = url.searchParams.get('list')

  if (company !== 'spark' && company !== 'sodamax') {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid company (spark|sodamax)' },
      { status: 400 }
    )
  }

  if (list !== 'pre_draft') {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid list (pre_draft)' },
      { status: 400 }
    )
  }

  try {
    const result = await invokeEdgeFunction('whatsapp-bot-sessions', {
      query: { list: 'pre_draft', list_company: company },
    })
    return NextResponse.json({ success: true, data: result.data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
