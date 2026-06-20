import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAuthClient } from '@/lib/supabase/server'
import { isAllowedRole } from '@/lib/auth'
import { isPlausibleWhatsAppPhone, normalizeWhatsAppPhone } from '@/lib/phone'
import {
  isWhatsAppAuthError,
  sendWhatsAppTemplate,
  sendWhatsAppText,
} from '@/lib/whatsapp'
import { runWithWhatsAppLine, LINE_LABELS, type WhatsAppLine } from '@/lib/whatsapp-line'

const DEFAULT_MESSAGE = 'Hello'

function testTemplateName(line: WhatsAppLine): string {
  if (line === 'sodamax') {
    return process.env.WHATSAPP_TEST_TEMPLATE_2?.trim() || process.env.WHATSAPP_TEST_TEMPLATE?.trim() || 'hello_world'
  }
  return process.env.WHATSAPP_TEST_TEMPLATE?.trim() || 'hello_world'
}

function testTemplateLanguage(): string {
  return process.env.WHATSAPP_TEST_TEMPLATE_LANGUAGE?.trim() || 'en_US'
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

  let body: { line?: string; phone?: string; message?: string; mode?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const line: WhatsAppLine = body.line === 'sodamax' ? 'sodamax' : 'spark'
  const to = normalizeWhatsAppPhone(body.phone ?? '')
  const message = body.message?.trim() || DEFAULT_MESSAGE
  const useTemplate = body.mode !== 'text'

  if (!isPlausibleWhatsAppPhone(to)) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Enter a valid phone number (e.g. 57833020, 057833020, or +230 5783 3020).',
      },
      { status: 400 }
    )
  }

  try {
    let sentVia: 'template' | 'text' = useTemplate ? 'template' : 'text'
    let templateName: string | undefined

    await runWithWhatsAppLine(line, async () => {
      if (useTemplate) {
        templateName = testTemplateName(line)
        await sendWhatsAppTemplate(to, templateName, testTemplateLanguage())
        return
      }

      sentVia = 'text'
      await sendWhatsAppText(to, message)
    })

    return NextResponse.json({
      success: true,
      to,
      message:
        sentVia === 'template' && templateName ? `Template: ${templateName}` : message,
      line: LINE_LABELS[line],
      sentVia,
    })
  } catch (error) {
    if (isWhatsAppAuthError(error)) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 })
    }

    const errMessage = error instanceof Error ? error.message : 'Failed to send test message'
    return NextResponse.json({ success: false, error: errMessage }, { status: 500 })
  }
}
