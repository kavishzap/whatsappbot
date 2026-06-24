'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  fetchMessageLeads,
  formatMessageLeadStep,
  type MessageLead,
} from '@/lib/message-leads'
import { formatSessionDate } from '@/lib/whatsapp-bot-sessions'
import {
  buildSessionFollowUpMessage,
  formatSessionPhone,
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

function matchesLeadSearch(lead: MessageLead, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  return (
    lead.phone.includes(q) ||
    formatSessionPhone(lead.phone).toLowerCase().includes(q) ||
    formatMessageLeadStep(lead).toLowerCase().includes(q) ||
    (lead.product_name ?? '').toLowerCase().includes(q) ||
    (lead.source_id ?? '').toLowerCase().includes(q) ||
    lead.source.toLowerCase().includes(q)
  )
}

function followUpUrl(lead: MessageLead, company: WhatsAppCompany): string {
  const message = buildSessionFollowUpMessage(
    {
      state: lead.session_state,
      product_name: lead.product_name,
      customer_name: lead.customer_name,
    },
    company
  )
  return sessionWhatsAppMessageUrl(lead.phone, message)
}

interface BotMessagesPageProps {
  company: WhatsAppCompany
}

export function BotMessagesPage({ company }: BotMessagesPageProps) {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const [leads, setLeads] = useState<MessageLead[]>([])
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState('')
  const [stepFilter, setStepFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [dateFilter, setDateFilter] = useState<OrderDateFilterState>(DEFAULT_TABLE_DATE_FILTER)

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchMessageLeads(company)
      setLeads(data)
    } catch (err) {
      toastRef.current.error(err instanceof Error ? err.message : 'Failed to load messages')
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [company])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  const stepOptions = useMemo(() => {
    const steps = Array.from(new Set(leads.map(lead => formatMessageLeadStep(lead)))).sort()
    return [{ value: '', label: 'All steps' }, ...steps.map(step => ({ value: step, label: step }))]
  }, [leads])

  const productOptions = useMemo(() => {
    const byName = new Set<string>()
    for (const lead of leads) {
      if (lead.product_name) byName.add(lead.product_name)
    }
    return [
      { value: '', label: 'All products' },
      ...Array.from(byName)
        .sort((a, b) => a.localeCompare(b))
        .map(name => ({ value: name, label: name })),
    ]
  }, [leads])

  const leadsInDateRange = useMemo(
    () => filterByDateField(leads, dateFilter, lead => lead.received_at),
    [leads, dateFilter]
  )

  const stats = useMemo(() => {
    const adClicks = leadsInDateRange.filter(lead => lead.source === 'ad').length
    const inProgress = leadsInDateRange.filter(
      lead =>
        !lead.draft_order_id &&
        lead.session_state !== 'idle' &&
        lead.session_state !== 'ad_click' &&
        lead.session_state !== 'awaiting_menu_selection'
    ).length
    const uniquePhones = new Set(leadsInDateRange.map(lead => lead.phone)).size
    const withProduct = leadsInDateRange.filter(lead => lead.product_name).length

    return { adClicks, inProgress, uniquePhones, withProduct, total: leadsInDateRange.length }
  }, [leadsInDateRange])

  const columns: DynamicTableColumn<MessageLead>[] = useMemo(
    () => [
      {
        key: 'phone',
        header: 'Phone',
        width: '14%',
        sortValue: lead => lead.phone,
        render: lead => (
          <span
            className="font-medium text-ink-900 tabular-nums whitespace-nowrap"
            title={formatSessionPhone(lead.phone)}
          >
            {formatSessionPhone(lead.phone)}
          </span>
        ),
      },
      {
        key: 'source',
        header: 'Source',
        width: '10%',
        sortValue: lead => lead.source,
        render: lead => (
          <span
            className={
              lead.source === 'ad'
                ? 'inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700'
                : 'inline-flex rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-600'
            }
          >
            {lead.source === 'ad' ? 'Ad' : 'Direct'}
          </span>
        ),
      },
      {
        key: 'step',
        header: 'Step',
        width: '14%',
        truncateCell: true,
        sortValue: lead => formatMessageLeadStep(lead),
        render: lead => (
          <span className="text-ink-700 truncate block" title={formatMessageLeadStep(lead)}>
            {formatMessageLeadStep(lead)}
          </span>
        ),
      },
      {
        key: 'received_at',
        header: 'Date',
        width: '16%',
        sortValue: lead => new Date(lead.received_at).getTime(),
        render: lead => {
          const label = formatSessionDate(lead.received_at)
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
        width: '16%',
        truncateCell: true,
        sortValue: lead => lead.product_name ?? '',
        render: lead => (
          <span className="text-ink-600 truncate block" title={lead.product_name ?? undefined}>
            {lead.product_name ?? '—'}
          </span>
        ),
      },
      {
        key: 'ad_id',
        header: 'Ad ID',
        width: '14%',
        truncateCell: true,
        sortValue: lead => lead.source_id ?? '',
        render: lead => (
          <span className="text-ink-500 truncate block font-mono text-xs" title={lead.source_id ?? undefined}>
            {lead.source_id ?? '—'}
          </span>
        ),
      },
      {
        key: 'follow_up',
        header: 'Follow up',
        width: '12%',
        shrinkCol: true,
        align: 'right',
        sortValue: lead => formatMessageLeadStep(lead),
        render: lead => {
          const message = buildSessionFollowUpMessage(
            {
              state: lead.session_state,
              product_name: lead.product_name,
              customer_name: lead.customer_name,
            },
            company
          )
          const href = followUpUrl(lead, company)
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
        subtitle={`${brandLabel} · ad clicks and in-progress chats`}
        items={[
          {
            label: 'Ad clicks',
            value: loading ? '—' : String(stats.adClicks),
          },
          {
            label: 'In progress',
            value: loading ? '—' : String(stats.inProgress),
          },
          {
            label: 'Unique numbers',
            value: loading ? '—' : String(stats.uniquePhones),
          },
          {
            label: 'With product',
            value: loading ? '—' : String(stats.withProduct),
          },
        ]}
      />

      <DynamicTable
        data={leadsInDateRange}
        columns={columns}
        rowKey={lead => lead.id}
        loading={loading}
        searchPlaceholder="Search phone, ad ID, product, step…"
        searchFilter={matchesLeadSearch}
        defaultSort={{ key: 'received_at', direction: 'desc' }}
        fitScreen
        filterExtras={<OrderDateFilter value={dateFilter} onChange={setDateFilter} />}
        extrasActive={isOrderDateFilterActive(dateFilter)}
        onClearFilters={() => {
          setDateFilter(DEFAULT_TABLE_DATE_FILTER)
          setSourceFilter('')
          setStepFilter('')
          setProductFilter('')
        }}
        filters={[
          {
            id: 'source-filter',
            label: 'Source',
            value: sourceFilter,
            onChange: setSourceFilter,
            options: [
              { value: '', label: 'All sources' },
              { value: 'ad', label: 'Ad click' },
              { value: 'organic', label: 'Direct' },
            ],
            match: (lead, value) => lead.source === value,
          },
          {
            id: 'step-filter',
            label: 'Step',
            value: stepFilter,
            onChange: setStepFilter,
            options: stepOptions,
            match: (lead, value) => formatMessageLeadStep(lead) === value,
          },
          {
            id: 'product-filter',
            label: 'Product',
            value: productFilter,
            onChange: setProductFilter,
            options: productOptions,
            match: (lead, value) => lead.product_name === value,
          },
        ]}
        toolbar={
          <button
            type="button"
            onClick={loadLeads}
            disabled={loading}
            className="btn-secondary shrink-0 !p-2 sm:!py-1.5 sm:!px-3"
            aria-label="Refresh messages"
            title="Refresh messages"
          >
            <RefreshIcon className="w-4 h-4" />
            <span className="hidden sm:inline sm:ml-1.5">Refresh</span>
          </button>
        }
        mobileCardRender={lead => {
          const message = buildSessionFollowUpMessage(
            {
              state: lead.session_state,
              product_name: lead.product_name,
              customer_name: lead.customer_name,
            },
            company
          )
          const href = followUpUrl(lead, company)
          return (
            <div className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-medium text-ink-900 tabular-nums">
                  {formatSessionPhone(lead.phone)}
                </span>
                <span className="text-xs font-medium text-ink-500 shrink-0">
                  {formatMessageLeadStep(lead)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <span>{lead.source === 'ad' ? 'Ad click' : 'Direct'}</span>
                {lead.source_id && <span className="font-mono truncate">· {lead.source_id}</span>}
              </div>
              {lead.product_name && (
                <p className="text-sm text-ink-700 truncate mt-1">{lead.product_name}</p>
              )}
              <p className="text-xs text-ink-400 mt-1">{formatSessionDate(lead.received_at)}</p>
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
            No ad clicks or in-progress chats in this date range. Ad-initiated WhatsApp messages
            appear here once someone messages from your Meta ad.
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
