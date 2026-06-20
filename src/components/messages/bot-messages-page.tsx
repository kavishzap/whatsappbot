'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  fetchPreDraftSessions,
  formatSessionDate,
  type WhatsAppBotSessionMessage,
} from '@/lib/whatsapp-bot-sessions'
import {
  buildSessionFollowUpMessage,
  formatSessionPhone,
  formatSessionState,
  sessionWhatsAppMessageUrl,
} from '@/lib/whatsapp-session-labels'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import { useToast } from '@/components/ui/toast'
import { OrderDateFilter } from '@/components/orders/order-date-filter'
import { CollapsibleKpiPanel } from '@/components/ui/collapsible-kpi-panel'
import { DynamicTable, type DynamicTableColumn } from '@/components/ui/dynamic-table'
import {
  DEFAULT_TABLE_DATE_FILTER,
  filterByDateField,
  isOrderDateFilterActive,
  type OrderDateFilterState,
} from '@/lib/order-date-filter'

function matchesSessionSearch(session: WhatsAppBotSessionMessage, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  return (
    session.phone.includes(q) ||
    formatSessionPhone(session.phone).toLowerCase().includes(q) ||
    formatSessionState(session.state).toLowerCase().includes(q) ||
    (session.product_name ?? '').toLowerCase().includes(q)
  )
}

function followUpUrl(session: WhatsAppBotSessionMessage, company: WhatsAppCompany): string {
  const message = buildSessionFollowUpMessage(session, company)
  return sessionWhatsAppMessageUrl(session.phone, message)
}

function sessionActiveAt(session: WhatsAppBotSessionMessage): string {
  return session.last_inbound_at ?? session.updated_at
}

interface BotMessagesPageProps {
  company: WhatsAppCompany
}

export function BotMessagesPage({ company }: BotMessagesPageProps) {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const [sessions, setSessions] = useState<WhatsAppBotSessionMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [stateFilter, setStateFilter] = useState('')
  const [dateFilter, setDateFilter] = useState<OrderDateFilterState>(DEFAULT_TABLE_DATE_FILTER)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPreDraftSessions(company)
      setSessions(data)
    } catch (err) {
      toastRef.current.error(err instanceof Error ? err.message : 'Failed to load messages')
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [company])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const stateOptions = useMemo(() => {
    const states = Array.from(new Set(sessions.map(session => session.state))).sort()
    return [
      { value: '', label: 'All steps' },
      ...states.map(state => ({ value: state, label: formatSessionState(state) })),
    ]
  }, [sessions])

  const sessionsInDateRange = useMemo(
    () => filterByDateField(sessions, dateFilter, sessionActiveAt),
    [sessions, dateFilter]
  )

  const stats = useMemo(() => {
    const withProduct = sessionsInDateRange.filter(session => session.selected_item_id).length
    const uniquePhones = new Set(sessionsInDateRange.map(session => session.phone)).size
    return {
      total: sessionsInDateRange.length,
      uniquePhones,
      withProduct,
    }
  }, [sessionsInDateRange])

  const columns: DynamicTableColumn<WhatsAppBotSessionMessage>[] = useMemo(
    () => [
      {
        key: 'phone',
        header: 'Phone',
        width: '16%',
        sortValue: session => session.phone,
        render: session => (
          <span
            className="font-medium text-ink-900 tabular-nums whitespace-nowrap"
            title={formatSessionPhone(session.phone)}
          >
            {formatSessionPhone(session.phone)}
          </span>
        ),
      },
      {
        key: 'state',
        header: 'Step',
        width: '16%',
        truncateCell: true,
        sortValue: session => formatSessionState(session.state),
        render: session => (
          <span className="text-ink-700 truncate block" title={formatSessionState(session.state)}>
            {formatSessionState(session.state)}
          </span>
        ),
      },
      {
        key: 'last_active',
        header: 'Last active',
        width: '18%',
        sortValue: session =>
          new Date(session.last_inbound_at ?? session.updated_at).getTime(),
        render: session => {
          const label = formatSessionDate(session.last_inbound_at ?? session.updated_at)
          return (
            <span className="text-ink-600 whitespace-nowrap" title={label}>
              {label}
            </span>
          )
        },
      },
      {
        key: 'product',
        header: 'Product',
        width: '22%',
        truncateCell: true,
        sortValue: session => session.product_name ?? '',
        render: session => (
          <span className="text-ink-600 truncate block" title={session.product_name ?? undefined}>
            {session.product_name ?? '—'}
          </span>
        ),
      },
      {
        key: 'follow_up',
        header: 'Follow up',
        width: '14%',
        shrinkCol: true,
        align: 'right',
        sortValue: session => formatSessionState(session.state),
        render: session => {
          const message = buildSessionFollowUpMessage(session, company)
          const href = followUpUrl(session, company)
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-2.5 py-1.5 text-xs font-semibold text-[#128C7E] hover:bg-[#25D366]/20 transition-colors whitespace-nowrap"
              title={message}
              onClick={event => event.stopPropagation()}
            >
              <WhatsAppIcon className="w-3.5 h-3.5 shrink-0" />
              Message
            </a>
          )
        },
      },
    ],
    [company]
  )

  const brandLabel = company === 'sodamax' ? 'SodaMax' : 'Spark'

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full gap-3 overflow-hidden">
      <CollapsibleKpiPanel
        title="Messages overview"
        subtitle={`${brandLabel} · filtered by date range`}
        items={[
          {
            label: 'Active sessions',
            value: loading ? '—' : String(stats.total),
          },
          {
            label: 'Unique numbers',
            value: loading ? '—' : String(stats.uniquePhones),
          },
          {
            label: 'With product selected',
            value: loading ? '—' : String(stats.withProduct),
          },
        ]}
      />

      <DynamicTable
        data={sessionsInDateRange}
        columns={columns}
        rowKey={session => session.phone}
        loading={loading}
        searchPlaceholder="Search phone, product, step…"
        searchFilter={matchesSessionSearch}
        defaultSort={{ key: 'last_active', direction: 'desc' }}
        fitScreen
        filterExtras={<OrderDateFilter value={dateFilter} onChange={setDateFilter} />}
        extrasActive={isOrderDateFilterActive(dateFilter)}
        onClearFilters={() => {
          setDateFilter(DEFAULT_TABLE_DATE_FILTER)
          setStateFilter('')
        }}
        filters={[
          {
            id: 'state-filter',
            label: 'Step',
            value: stateFilter,
            onChange: setStateFilter,
            options: stateOptions,
            match: (session, value) => session.state === value,
          },
        ]}
        toolbar={
          <button
            type="button"
            onClick={loadSessions}
            disabled={loading}
            className="btn-secondary shrink-0 !p-2 sm:!py-1.5 sm:!px-3"
            aria-label="Refresh messages"
            title="Refresh messages"
          >
            <RefreshIcon className="w-4 h-4" />
            <span className="hidden sm:inline sm:ml-1.5">Refresh</span>
          </button>
        }
        mobileCardRender={session => {
          const message = buildSessionFollowUpMessage(session, company)
          const href = followUpUrl(session, company)
          return (
            <div className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-medium text-ink-900 tabular-nums">
                  {formatSessionPhone(session.phone)}
                </span>
                <span className="text-xs font-medium text-ink-500 shrink-0">
                  {formatSessionState(session.state)}
                </span>
              </div>
              {session.product_name && (
                <p className="text-sm text-ink-700 truncate">{session.product_name}</p>
              )}
              <p className="text-xs text-ink-400 mt-1">
                {formatSessionDate(session.last_inbound_at ?? session.updated_at)}
              </p>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-3 py-1.5 text-xs font-semibold text-[#128C7E] hover:bg-[#25D366]/20"
                title={message}
              >
                <WhatsAppIcon className="w-3.5 h-3.5" />
                Send follow-up
              </a>
            </div>
          )
        }}
        emptyState={
          <p className="text-sm text-ink-500 py-8 text-center">
            No in-progress chats right now. Numbers appear here when someone starts ordering but
            has not reached a draft order yet.
          </p>
        }
      />
    </div>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  )
}
