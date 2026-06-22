'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/toast'
import { isPlausibleWhatsAppPhone, normalizeWhatsAppPhone } from '@/lib/phone'
import {
  DEFAULT_WHATSAPP_TEST_TEMPLATES,
  welcomeTemplateLabel,
} from '@/lib/whatsapp-test-templates'
import type { WhatsAppLine } from '@/lib/whatsapp-line'

function TestPanel({
  line,
  title,
  description,
  accent,
  defaultPhone,
}: {
  line: WhatsAppLine
  title: string
  description: string
  accent: 'spark' | 'soda'
  defaultPhone?: string
}) {
  const toast = useToast()
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const [sending, setSending] = useState(false)

  const accentClasses =
    accent === 'spark'
      ? {
          border: 'border-brand-200/80',
          header: 'bg-gradient-to-r from-brand-50 to-white',
          badge: 'bg-brand-100 text-brand-700 ring-brand-200',
          dot: 'bg-brand-500',
        }
      : {
          border: 'border-soda-200/80',
          header: 'bg-gradient-to-r from-soda-50 to-white',
          badge: 'bg-soda-100 text-soda-800 ring-soda-200',
          dot: 'bg-soda-500',
        }

  const handleSend = async () => {
    const normalized = normalizeWhatsAppPhone(phone)
    if (!isPlausibleWhatsAppPhone(normalized)) {
      toast.error('Enter a valid phone number (e.g. 57833020, 057833020, or +230 5783 3020)')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/whatsapp-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line, phone }),
      })
      const data = (await res.json()) as {
        success?: boolean
        error?: string
        to?: string
        message?: string
        line?: string
        sentVia?: 'template' | 'text'
      }

      if (!res.ok || !data.success) {
        toast.error(data.error ?? 'Failed to send test message')
        return
      }

      const via =
        data.sentVia === 'template'
          ? ' (welcome template + menu — works even if they have not messaged recently)'
          : ''
      toast.success(`Sent to ${data.to} via ${data.line}${via}`)
    } catch {
      toast.error('Failed to send test message')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`panel ${accentClasses.border} flex flex-col`}>
      <div className={`px-5 py-4 border-b border-ink-100 ${accentClasses.header}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${accentClasses.dot}`} />
              <h2 className="text-base font-bold text-ink-900 tracking-tight">{title}</h2>
            </div>
            <p className="text-sm text-ink-500 leading-relaxed">{description}</p>
          </div>
          <span className={`badge shrink-0 ring-1 ${accentClasses.badge}`}>Test</span>
        </div>
      </div>

      <div className="p-5 space-y-4 flex-1 flex flex-col">
        <div>
          <label htmlFor={`phone-${line}`} className="block text-sm font-medium text-ink-700 mb-1.5">
            Recipient phone number
          </label>
          <input
            id={`phone-${line}`}
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="e.g. 57833020, 057833020, or +230 5783 3020"
            className="input-field"
            autoComplete="tel"
          />
          <p className="text-xs text-ink-400 mt-1.5">
            Mauritius numbers are auto-formatted with country code 230. Test sends use the approved{' '}
            <span className="font-medium">{welcomeTemplateLabel(line)}</span> template, then the
            same welcome menu and buttons as the live bot.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !phone.trim()}
          className="btn-primary w-full sm:w-auto mt-auto"
        >
          {sending ? (
            <>
              <Spinner />
              Sending…
            </>
          ) : (
            <>
              <SendIcon />
              Send test
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default function WhatsAppIntegrationPage() {
  return (
    <div className="flex flex-col gap-5 animate-fade-in flex-1 min-h-0 overflow-auto">
      <div className="panel p-5 sm:p-6 bg-gradient-to-br from-white via-white to-ink-50/80">
        <h2 className="text-sm font-semibold text-ink-900">Integration overview</h2>
        <p className="text-sm text-ink-500 mt-1 max-w-2xl leading-relaxed">
          Both WhatsApp Business numbers share one webhook. Messages are routed automatically by phone
          number ID. Use the panels below to verify each line can send outbound messages.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="badge-success">Spark → WHATSAPP_PHONE_NUMBER_ID</span>
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-soda-50 text-soda-800 ring-1 ring-soda-100">
            SodaMax → WHATSAPP_PHONE_NUMBER_ID_2
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <TestPanel
          line="spark"
          title="Spark test"
          description={`Sends the ${DEFAULT_WHATSAPP_TEST_TEMPLATES.spark} template and Spark welcome menu from the Spark Distributors WhatsApp number.`}
          accent="spark"
        />
        <TestPanel
          line="sodamax"
          title="SodaMax test"
          description={`Sends the ${DEFAULT_WHATSAPP_TEST_TEMPLATES.sodamax} template and SodaMax welcome menu from the SodaMax WhatsApp number.`}
          accent="soda"
        />
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  )
}
