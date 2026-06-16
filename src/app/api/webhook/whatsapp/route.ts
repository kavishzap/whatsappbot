import { handleChatbotMessage } from '@/lib/chatbot/flow'
import { handleSodamaxMessage } from '@/lib/sodamax/flow'
import { isWhatsAppAuthError } from '@/lib/whatsapp'
import { resolveWhatsAppLine, runWithWhatsAppLine } from '@/lib/whatsapp-line'
import type { IncomingWhatsAppMessage } from '@/lib/chatbot/types'

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
    metadata?: { phone_number_id?: string }
    messages?: IncomingWhatsAppMessage[]
  } | undefined

  const message = value?.messages?.[0]
  const phoneNumberId = value?.metadata?.phone_number_id

  if (!message) {
    return new Response('OK', { status: 200 })
  }

  const line = resolveWhatsAppLine(phoneNumberId)

  const preview =
    message.type === 'text'
      ? message.text?.body
      : message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title

  console.log(
    'WhatsApp inbound:',
    JSON.stringify({
      line,
      phoneNumberId,
      from: message.from,
      type: message.type,
      preview,
    })
  )

  const handler =
    line === 'sodamax'
      ? () => handleSodamaxMessage(message)
      : () => handleChatbotMessage(message)

  runWithWhatsAppLine(line, () => {
    handler().catch(error => {
      if (!isWhatsAppAuthError(error)) {
        console.error('Webhook handler error:', error)
      }
    })
  })

  return new Response('OK', { status: 200 })
}
