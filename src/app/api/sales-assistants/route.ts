import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/admin'
import { isAllowedRole } from '@/lib/auth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLUMNS = 'id, full_name, email, phone_number, is_active, created_at'
const failure = (error: string, status: number) => NextResponse.json({ success: false, error }, { status })

async function handle(request: NextRequest, method: 'GET' | 'POST' | 'PUT' | 'DELETE') {
  try {
    const auth = createClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return failure('Unauthorized', 401)
    const { data: profile } = await auth.from('user_profiles').select('system_role').eq('id', user.id).single()
    if (!isAllowedRole(profile?.system_role)) return failure('Forbidden', 403)
    const client = getServiceClient()
    const id = request.nextUrl.searchParams.get('id') ?? ''
    if ((method === 'PUT' || method === 'DELETE') && !UUID.test(id)) return failure('A valid assistant id is required', 400)
    if (method === 'GET') {
      const { data, error } = await client.from('sales_assistants').select(COLUMNS).order('full_name')
      if (error) throw error
      return NextResponse.json({ success: true, data })
    }
    if (method === 'DELETE') {
      const { data, error } = await client.from('sales_assistants').delete().eq('id', id).select('id').maybeSingle()
      if (error) throw error
      if (!data) return failure('Sales assistant not found', 404)
      return NextResponse.json({ success: true, data })
    }
    let body: unknown
    try { body = await request.json() } catch { return failure('Invalid JSON body', 400) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return failure('Invalid assistant details', 400)
    const fields = body as Record<string, unknown>
    if (typeof fields.full_name !== 'string' || !fields.full_name.trim()) return failure('Full name is required', 400)
    if (typeof fields.is_active !== 'boolean') return failure('Active status must be a boolean', 400)
    for (const field of ['email', 'phone_number']) {
      if (fields[field] != null && typeof fields[field] !== 'string') return failure(`Invalid ${field}`, 400)
    }
    const email = typeof fields.email === 'string' ? fields.email.trim() || null : null
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return failure('Enter a valid email address', 400)
    const values = { full_name: fields.full_name.trim(), email,
      phone_number: typeof fields.phone_number === 'string' ? fields.phone_number.trim() || null : null,
      is_active: fields.is_active }
    const query = method === 'POST'
      ? client.from('sales_assistants').insert(values)
      : client.from('sales_assistants').update(values).eq('id', id)
    const { data, error } = await query.select(COLUMNS).maybeSingle()
    if (error) throw error
    if (!data) return failure('Sales assistant not found', 404)
    return NextResponse.json({ success: true, data }, { status: method === 'POST' ? 201 : 200 })
  } catch (error) {
    console.error('Sales assistants request failed', error)
    return failure('Unable to complete the request. Please try again.', 500)
  }
}
export function GET(request: NextRequest) { return handle(request, 'GET') }
export function POST(request: NextRequest) { return handle(request, 'POST') }
export function PUT(request: NextRequest) { return handle(request, 'PUT') }
export function DELETE(request: NextRequest) { return handle(request, 'DELETE') }
