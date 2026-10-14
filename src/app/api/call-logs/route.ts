import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/supabase/admin'
import { isAllowedRole } from '@/lib/auth'
import { isMessageStatus, MESSAGE_STATUSES, type MessageStatus } from '@/lib/message-status'

const CALL_TYPES = ['incoming', 'outgoing', 'missed', 'rejected', 'blocked'] as const
const FOLLOW_UP_FILTERS = ['open', ...MESSAGE_STATUSES] as const
const LIST_COLUMNS = 'id, sales_assistant_id, device_id, android_call_id, phone_number, call_type, call_date, duration_seconds, synced_at, created_at, follow_up_status, follow_up_notes, converted_order_id, converted_order_ref, order_company, assistant:sales_assistants(full_name), device:sales_assistant_devices(device_name, device_model)'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type CallType = (typeof CALL_TYPES)[number]
type FollowUpFilter = (typeof FOLLOW_UP_FILTERS)[number]

function isCallType(value: string): value is CallType {
  return (CALL_TYPES as readonly string[]).includes(value)
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, char => `\\${char}`)
}

function isFollowUpFilter(value: string): value is FollowUpFilter {
  return (FOLLOW_UP_FILTERS as readonly string[]).includes(value)
}

async function requireAdmin() {
  const auth = createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return { error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await auth.from('user_profiles').select('system_role').eq('id', user.id).single()
  if (!isAllowedRole(profile?.system_role)) {
    return { error: NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) }
  }
  return { error: null }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (admin.error) return admin.error
    const pageValue = request.nextUrl.searchParams.get('page') ?? '1'
    const page = Number(pageValue)
    if (!/^\d+$/.test(pageValue) || !Number.isSafeInteger(page) || page < 1 || page > 1000000) {
      return NextResponse.json({ success: false, error: 'Invalid page' }, { status: 400 })
    }
    const pageSizeValue = request.nextUrl.searchParams.get('pageSize') ?? '50'
    const pageSize = Number(pageSizeValue)
    if (!/^\d+$/.test(pageSizeValue) || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 5000) {
      return NextResponse.json({ success: false, error: 'Invalid page size' }, { status: 400 })
    }
    const callTypeValue = request.nextUrl.searchParams.get('callType')?.trim() ?? ''
    if (callTypeValue && !isCallType(callTypeValue)) {
      return NextResponse.json({ success: false, error: 'Invalid call type' }, { status: 400 })
    }
    const phone = request.nextUrl.searchParams.get('phone')?.trim() ?? ''
    if (phone.length > 40) {
      return NextResponse.json({ success: false, error: 'Invalid phone search' }, { status: 400 })
    }
    const followUpValue = request.nextUrl.searchParams.get('followUp')?.trim() ?? ''
    if (followUpValue && !isFollowUpFilter(followUpValue)) {
      return NextResponse.json({ success: false, error: 'Invalid follow-up status' }, { status: 400 })
    }
    const callType: CallType | null = callTypeValue && isCallType(callTypeValue) ? callTypeValue : null
    const phonePattern = phone ? `%${escapeLike(phone)}%` : null
    const followUp: FollowUpFilter | null = followUpValue && isFollowUpFilter(followUpValue) ? followUpValue : null
    const client = getServiceClient()
    const start = (page - 1) * pageSize
    const data = []
    let count = 0
    for (let offset = 0; offset < pageSize; offset += 1000) {
      let listQuery = client.from('call_logs').select(LIST_COLUMNS, { count: 'exact' })
      if (callType) listQuery = listQuery.eq('call_type', callType)
      if (phonePattern) listQuery = listQuery.ilike('phone_number', phonePattern)
      if (followUp === 'open') listQuery = listQuery.is('follow_up_status', null)
      else if (followUp) listQuery = listQuery.eq('follow_up_status', followUp)
      const { data: rows, error, count: total } = await listQuery
        .order('call_date', { ascending: false }).order('id', { ascending: false })
        .range(start + offset, start + Math.min(offset + 1000, pageSize) - 1)
      if (error) throw error
      count = total ?? 0
      data.push(...(rows ?? []))
      if (!rows || rows.length < Math.min(1000, pageSize - offset)) break
    }
    const statistics = { incoming: 0, outgoing: 0, missed: 0, duration_seconds: 0 }
    if (request.nextUrl.searchParams.get('stats') !== '0') {
      // Read only the two fields needed for totals, in batches to avoid Supabase's row limit.
      const batchSize = 1000
      for (let offset = 0; ; offset += batchSize) {
        let statsQuery = client.from('call_logs').select('call_type, duration_seconds')
        if (callType) statsQuery = statsQuery.eq('call_type', callType)
        if (phonePattern) statsQuery = statsQuery.ilike('phone_number', phonePattern)
        if (followUp === 'open') statsQuery = statsQuery.is('follow_up_status', null)
        else if (followUp) statsQuery = statsQuery.eq('follow_up_status', followUp)
        const { data: batch, error: statsError } = await statsQuery.order('id', { ascending: true })
          .range(offset, offset + batchSize - 1)
        if (statsError) throw statsError
        for (const call of batch ?? []) {
          if (call.call_type === 'incoming') statistics.incoming += 1
          if (call.call_type === 'outgoing') statistics.outgoing += 1
          if (call.call_type === 'missed') statistics.missed += 1
          statistics.duration_seconds += call.duration_seconds
        }
        if (!batch || batch.length < batchSize) break
      }
    }
    return NextResponse.json({ success: true, data, total: count ?? 0, page, pageSize, statistics })
  } catch (error) {
    console.error('Call logs request failed', error)
    const message = error instanceof Error ? error.message : ''
    if (message.includes('follow_up_status')) {
      return NextResponse.json({
        success: false,
        error: 'Follow-up status is not in the database yet. Run supabase/call-log-follow-up-migration.sql in the Supabase SQL editor, then refresh.',
      }, { status: 500 })
    }
    return NextResponse.json({ success: false, error: 'Unable to load call logs. Please try again.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (admin.error) return admin.error
    const body = await request.json() as {
      id?: unknown
      follow_up_status?: unknown
      follow_up_notes?: unknown
    }
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ success: false, error: 'Invalid call log' }, { status: 400 })
    }
    const rawStatus = body.follow_up_status
    let statusValue: MessageStatus | null = null
    if (rawStatus !== null && rawStatus !== undefined && rawStatus !== '') {
      if (typeof rawStatus !== 'string' || !isMessageStatus(rawStatus)) {
        return NextResponse.json({ success: false, error: 'Invalid follow-up status' }, { status: 400 })
      }
      statusValue = rawStatus
    }
    const notes = typeof body.follow_up_notes === 'string' ? body.follow_up_notes.trim() : ''
    if (notes.length > 2000) {
      return NextResponse.json({ success: false, error: 'Notes are too long' }, { status: 400 })
    }
    const client = getServiceClient()
    const { data, error } = await client.from('call_logs')
      .update({
        follow_up_status: statusValue || null,
        follow_up_notes: notes || null,
      })
      .eq('id', id)
      .select(LIST_COLUMNS)
      .single()
    if (error && error.code !== 'PGRST116') throw error
    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Call log not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Call log update failed', error)
    return NextResponse.json({ success: false, error: 'Unable to update call status. Please try again.' }, { status: 500 })
  }
}
