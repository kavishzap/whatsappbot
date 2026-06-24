import { handleChatbotMessage } from '@/lib/spark/flow'
import { handleSodamaxMessage } from '@/lib/sodamax/flow'
import { recordAdReferral } from '@/lib/ad-referrals'
import {
  OTHER_QUERY_CTA_LABEL,
  PROCESS_ERROR_MESSAGE,
  SUPPORT_WHATSAPP_URL,
} from '@/lib/spark/constants'
import {
  PROCESS_ERROR_MESSAGE as SODAMAX_PROCESS_ERROR_MESSAGE,
  SUPPORT_WHATSAPP_URL as SODAMAX_SUPPORT_WHATSAPP_URL,
} from '@/lib/sodamax/constants'
import { sendProcessErrorWithSupport } from '@/lib/spark/process-error'
import { isWhatsAppAuthError } from '@/lib/whatsapp'
import { logWhatsAppInbound } from '@/lib/whatsapp-log'
import { resolveWhatsAppLine, runWithWhatsAppLine } from '@/lib/whatsapp-line'
import type { IncomingWhatsAppMessage } from '@/lib/spark/types'

function getVerifyToken() {
  return (
    process.env.META_VERIFY_TOKEN?.trim() ||
    process.env.WHATSAPP_VERIFY_TOKEN?.trim() ||
    ''
  )
}

function getQueryParam(request: Request, ...keys: string[]) {
  const { searchParams } = new URL(request.url)
  for (const key of keys) {
    const value = searchParams.get(key)
    if (value) return value
  }
  return null
}

export async function GET(request: Request) {
  const mode = getQueryParam(request, 'hub.mode', 'hub_mode')
  const token = getQueryParam(request, 'hub.verify_token', 'hub_verify_token')
  const challenge = getQueryParam(request, 'hub.challenge', 'hub_challenge')
  const verifyToken = getVerifyToken()

  if (mode === 'subscribe' && token && challenge && token === verifyToken) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return new Response('Forbidden', { status: 403 })
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return new Response('OK', { status: 200 })
  }

  const value = (body as { entry?: { changes?: { value?: unknown }[] }[] })
    .entry?.[0]?.changes?.[0]?.value as {
    metadata?: { phone_number_id?: string; display_phone_number?: string }
    contacts?: { wa_id?: string; profile?: { name?: string } }[]
    messages?: IncomingWhatsAppMessage[]
    statuses?: unknown[]
  } | undefined

  const phoneNumberId = value?.metadata?.phone_number_id
  const line = resolveWhatsAppLine(phoneNumberId)
  const rawMessage = value?.messages?.[0]
  const profileName = value?.contacts
    ?.find(c => c.wa_id === rawMessage?.from)
    ?.profile?.name
    ?.trim()
  const message = rawMessage
    ? { ...rawMessage, ...(profileName ? { profile_name: profileName } : {}) }
    : undefined

  logWhatsAppInbound({
    line,
    phoneNumberId,
    displayPhoneNumber: value?.metadata?.display_phone_number,
    message,
    messages: value?.messages,
    statuses: value?.statuses,
    contacts: value?.contacts,
    webhook: body,
  })

  if (!message) {
    return new Response('OK', { status: 200 })
  }

  if (message.referral?.source_id || message.referral?.source_url) {
    void recordAdReferral(line, message.referral, message.from).catch(err =>
      console.error('recordAdReferral failed:', err)
    )
  }

  const handler =
    line === 'sodamax'
      ? () => handleSodamaxMessage(message)
      : () => handleChatbotMessage(message)

  // Must await on serverless (Netlify): returning 200 before the handler finishes lets
  // the runtime shut down and drop in-flight WhatsApp replies.
  await runWithWhatsAppLine(line, async () => {
    try {
      await handler()
    } catch (error) {
      if (isWhatsAppAuthError(error)) {
        console.error('WhatsApp auth error:', (error as Error).message)
        return
      }

      console.error('Webhook handler error:', error)

      const isSodamax = line === 'sodamax'
      await sendProcessErrorWithSupport(message.from, {
        message: isSodamax ? SODAMAX_PROCESS_ERROR_MESSAGE : PROCESS_ERROR_MESSAGE,
        ctaLabel: OTHER_QUERY_CTA_LABEL,
        supportUrl: isSodamax ? SODAMAX_SUPPORT_WHATSAPP_URL : SUPPORT_WHATSAPP_URL,
        logLabel: isSodamax ? 'SodaMax webhook' : 'Spark webhook',
      })
    }
  })

  return new Response('OK', { status: 200 })
}
