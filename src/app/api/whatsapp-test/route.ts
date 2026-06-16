import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { isAllowedRole } from '@/lib/auth'
import { isWhatsAppAuthError, sendWhatsAppText } from '@/lib/whatsapp'
import { runWithWhatsAppLine, LINE_LABELS, type WhatsAppLine } from '@/lib/whatsapp-line'

const DEFAULT_MESSAGE = 'Hello'

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('230')) return digits
  if (digits.startsWith('0')) return `230${digits.slice(1)}`
  return `230${digits}`
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

export async function POST(request: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: { line?: string; phone?: string; message?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const line: WhatsAppLine = body.line === 'sodamax' ? 'sodamax' : 'spark'
  const to = normalizePhone(body.phone ?? '')
  const message = body.message?.trim() || DEFAULT_MESSAGE

  if (!to || to.length < 10) {
    return NextResponse.json({ success: false, error: 'Valid phone number is required' }, { status: 400 })
  }

  try {
    await runWithWhatsAppLine(line, async () => {
      await sendWhatsAppText(to, message)
    })

    return NextResponse.json({
      success: true,
      to,
      message,
      line: LINE_LABELS[line],
    })
  } catch (error) {
    if (isWhatsAppAuthError(error)) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 })
    }

    const errMessage = error instanceof Error ? error.message : 'Failed to send test message'
    return NextResponse.json({ success: false, error: errMessage }, { status: 500 })
  }
}
