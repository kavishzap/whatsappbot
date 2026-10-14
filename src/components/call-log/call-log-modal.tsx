'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import {
  MESSAGE_STATUSES,
  MESSAGE_STATUS_LABELS,
  type MessageStatus,
} from '@/lib/message-status'
import { convertCallLogToOrder, updateCallLogFollowUp, type CallLog } from '@/lib/call-logs'
import { fetchBotItems, type WhatsAppBotItemSummary } from '@/lib/whatsapp-bot-items'
import { formatSessionPhone, sessionWhatsAppMessageUrl } from '@/lib/whatsapp-session-labels'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import { MessageStatusBadge } from '@/components/messages/message-status-badge'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { useToast } from '@/components/ui/toast'
import { DetailRow, DetailSection, EditRow, type CityOption } from '@/components/orders/order-modal-shared'

const SELECTABLE_STATUSES = MESSAGE_STATUSES.filter(status => status !== 'complete')
const MODAL_SHELL =
  'relative bg-white rounded-2xl shadow-card border border-ink-200/80 w-full max-w-3xl max-h-[min(92dvh,920px)] flex flex-col animate-fade-in mx-auto'

const TYPE_LABELS: Record<CallLog['call_type'], string> = {
  incoming: 'Incoming',
  outgoing: 'Outgoing',
  missed: 'Missed',
  rejected: 'Rejected',
  blocked: 'Blocked',
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  return `${hours ? `${hours}h ` : ''}${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`
}

function followUpMessage(company: WhatsAppCompany) {
  const brand = company === 'sodamax' ? 'SodaMax' : 'Spark Distributors'
  return `Hi, this is ${brand}. We tried to reach you by phone. Reply here if you'd like to place an order and we'll help you.`
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function ModalSpinner({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-brand-600 ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

interface OrderLineItem {
  key: string
  item_id: string | null
  product_name: string
  quantity: string
  unit_price: string
  amount: string
}

interface OrderFormState {
  customerName: string
  customerPhone: string
  address: string
  cityId: string
  notes: string
  items: OrderLineItem[]
}

function normalizePrice(value: unknown): number {
  const num = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  return Number.isFinite(num) ? num : 0
}

function lineAmountFromParts(unitPrice: number, quantity: string): string {
  const qty = parseFloat(quantity)
  const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1
  return String(unitPrice * safeQty)
}

function createLineItem(partial?: Partial<OrderLineItem>): OrderLineItem {
  const quantity = partial?.quantity ?? '1'
  const unitPrice = partial?.unit_price ?? '0'
  return {
    key: crypto.randomUUID(),
    item_id: partial?.item_id ?? null,
    product_name: partial?.product_name?.trim() ?? '',
    quantity,
    unit_price: unitPrice,
    amount: partial?.amount ?? lineAmountFromParts(normalizePrice(unitPrice), quantity),
  }
}

function buildOrderForm(log: CallLog): OrderFormState {
  return {
    customerName: '',
    customerPhone: log.phone_number ?? '',
    address: '',
    cityId: '',
    notes: log.follow_up_notes?.trim() ?? '',
    items: [createLineItem()],
  }
}

function parseLineTotal(item: OrderLineItem): number {
  const amount = parseFloat(item.amount)
  if (Number.isFinite(amount) && amount >= 0) return amount
  const qty = parseFloat(item.quantity)
  const price = parseFloat(item.unit_price)
  if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0) return 0
  return qty * price
}

interface CallLogModalProps {
  log: CallLog | null
  onClose: () => void
  onUpdated: (log: CallLog) => void
}

export function CallLogModal({ log, onClose, onUpdated }: CallLogModalProps) {
  const toast = useToast()
  const [company, setCompany] = useState<WhatsAppCompany>('sodamax')
  const [followUpStatus, setFollowUpStatus] = useState<MessageStatus | ''>('')
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [orderForm, setOrderForm] = useState<OrderFormState | null>(null)
  const [cities, setCities] = useState<CityOption[]>([])
  const [products, setProducts] = useState<WhatsAppBotItemSummary[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [convertedOrderRef, setConvertedOrderRef] = useState<string | null>(null)
  const openedId = log?.id ?? null
  const [syncedId, setSyncedId] = useState<string | null>(openedId)
  if (openedId !== syncedId) {
    setSyncedId(openedId)
    if (!log) {
      setOrderForm(null)
      setConvertedOrderRef(null)
    } else {
      setCompany(log.order_company ?? 'sodamax')
      setFollowUpStatus(log.follow_up_status ?? '')
      setFollowUpNotes(log.follow_up_notes ?? '')
      setOrderForm(buildOrderForm(log))
      setConvertedOrderRef(log.converted_order_ref ?? null)
      setConvertError(null)
    }
  }

  useEffect(() => {
    if (!log) return
    setCitiesLoading(true)
    fetch(`/api/whatsapp-cities?company=${company}`)
      .then(res => res.json())
      .then(json => {
        const rows = (json.data ?? []) as CityOption[]
        setCities([...rows].sort((a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name)))
      })
      .catch(() => setCities([]))
      .finally(() => setCitiesLoading(false))
  }, [log?.id, company])

  useEffect(() => {
    if (!log) return
    setProductsLoading(true)
    fetchBotItems(company)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false))
  }, [log?.id, company])

  useEffect(() => {
    if (!log) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingStatus && !converting) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [log, savingStatus, converting, onClose])

  const cityOptions = useMemo<SearchableSelectOption[]>(
    () => cities.map(city => ({
      value: city.id,
      label: city.name,
      description: [city.region, city.zone_name].filter(Boolean).join(' · '),
      keywords: city.region,
    })),
    [cities],
  )
  const productOptions = useMemo<SearchableSelectOption[]>(
    () => products.map(product => {
      const price = normalizePrice(product.price)
      return {
        value: product.id,
        label: product.product_name,
        description: price > 0 ? `Rs ${price.toFixed(2)}` : undefined,
      }
    }),
    [products],
  )
  const productById = useMemo(() => new Map(products.map(product => [product.id, product])), [products])
  const selectedCity = useMemo(
    () => cities.find(city => city.id === orderForm?.cityId) ?? null,
    [cities, orderForm?.cityId],
  )
  const computedTotal = useMemo(
    () => (orderForm?.items ?? []).reduce((sum, item) => sum + parseLineTotal(item), 0),
    [orderForm],
  )
  const computedQty = useMemo(
    () => (orderForm?.items ?? []).reduce((sum, item) => {
      const qty = parseFloat(item.quantity)
      return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0)
    }, 0),
    [orderForm],
  )

  const patchOrderForm = useCallback((patch: Partial<Omit<OrderFormState, 'items'>>) => {
    setOrderForm(prev => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const updateLineItem = useCallback((key: string, patch: Partial<OrderLineItem>) => {
    setOrderForm(prev => prev ? {
      ...prev,
      items: prev.items.map(item => (item.key === key ? { ...item, ...patch } : item)),
    } : prev)
  }, [])

  const changeCompany = (next: WhatsAppCompany) => {
    setCompany(next)
    setOrderForm(prev => prev ? { ...prev, cityId: '', items: [createLineItem()] } : prev)
  }

  if (!log || !orderForm) return null

  const form = orderForm
  const busy = savingStatus || converting
  const phone = log.phone_number?.trim() || ''
  const message = followUpMessage(company)
  const followUpHref = phone ? sessionWhatsAppMessageUrl(phone, message) : null
  const ordersHref = (log.order_company ?? company) === 'sodamax' ? '/dashboard/sodamax-orders' : '/dashboard/orders'

  const handleSaveStatus = async () => {
    setSavingStatus(true)
    try {
      const updated = await updateCallLogFollowUp({
        id: log.id,
        follow_up_status: followUpStatus || null,
        follow_up_notes: followUpNotes.trim() || null,
      })
      onUpdated(updated)
      toast.success('Call status updated')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setSavingStatus(false)
    }
  }

  const handleConvertToOrder = async () => {
    const customerPhone = form.customerPhone.trim() || phone
    const cityName = selectedCity?.name ?? ''
    if (!customerPhone) {
      toast.error('Phone is required.')
      return
    }
    if (!cityName) {
      toast.error('City is required.')
      return
    }
    const parsedItems = form.items.map(item => {
      const product_name = item.product_name.trim()
      if (!product_name) return null
      const quantity = parseFloat(item.quantity)
      const amount = parseFloat(item.amount)
      const unit_price = Number.isFinite(amount) && amount >= 0 && Number.isFinite(quantity) && quantity > 0
        ? amount / quantity
        : parseFloat(item.unit_price)
      if (!Number.isFinite(quantity) || quantity <= 0) return null
      if (!Number.isFinite(unit_price) || unit_price < 0) return null
      return { item_id: item.item_id, product_name, quantity, unit_price }
    }).filter(Boolean) as Array<{ item_id: string | null; product_name: string; quantity: number; unit_price: number }>

    if (parsedItems.length === 0) {
      toast.error('Add at least one product with quantity and price.')
      return
    }

    setConverting(true)
    setConvertError(null)
    try {
      const result = await convertCallLogToOrder({
        id: log.id,
        company,
        customer_name: form.customerName.trim() || undefined,
        customer_phone_number: customerPhone,
        address: form.address.trim() || undefined,
        city: cityName,
        city_id: form.cityId.trim() || null,
        notes: form.notes.trim() || null,
        items: parsedItems,
      })
      setConvertedOrderRef(result.order_ref)
      onUpdated(result.call_log)
      toast.success(`Order ${result.order_ref} created`)
      onClose()
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Failed to create order'
      setConvertError(messageText)
      toast.error(messageText)
    } finally {
      setConverting(false)
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <button type="button" aria-label="Close call" onClick={onClose} disabled={busy} className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm disabled:cursor-not-allowed" />
      <div role="dialog" aria-modal="true" aria-labelledby="call-log-title" className={MODAL_SHELL}>
        {busy && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/75 backdrop-blur-[2px]" aria-live="polite" aria-busy="true">
            <div className="flex flex-col items-center gap-3 px-6 py-4 rounded-xl border border-ink-200/80 bg-white shadow-sm">
              <ModalSpinner className="w-6 h-6" />
              <p className="text-sm font-medium text-ink-700">{converting ? 'Creating order…' : 'Updating status…'}</p>
            </div>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-ink-100 shrink-0">
          <div className="min-w-0">
            <h2 id="call-log-title" className="text-lg font-bold text-ink-900 tracking-tight">Call follow-up</h2>
            <p className="text-sm text-ink-500 tabular-nums mt-0.5">{phone ? formatSessionPhone(phone) : 'No phone number'}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <MessageStatusBadge status={log.follow_up_status} />
            <button type="button" onClick={onClose} disabled={busy} className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 disabled:opacity-50 transition-colors" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4 min-h-0">
          <div className="grid gap-4 lg:grid-cols-2">
            <DetailSection title="Call info">
              <DetailRow label="Assistant" value={log.assistant?.full_name ?? '—'} />
              <DetailRow label="Call type" value={TYPE_LABELS[log.call_type]} />
              <DetailRow label="Call date" value={new Date(log.call_date).toLocaleString()} />
              <DetailRow label="Duration" value={formatDuration(log.duration_seconds)} />
              <DetailRow label="Phone" value={phone ? formatSessionPhone(phone) : '—'} />
            </DetailSection>
            <DetailSection title="Follow-up & status">
              <div className="px-3.5 py-3 border-b border-ink-100 space-y-2">
                <p className="text-xs text-ink-500">This status is separate from the call type. Use it to track what the admin did next.</p>
                {followUpHref ? (
                  <a href={followUpHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-3 py-2 text-sm font-semibold text-[#128C7E] hover:bg-[#25D366]/20 transition-colors" title={message}>
                    Open WhatsApp follow-up
                  </a>
                ) : (
                  <p className="text-sm text-ink-500">No phone number on this call.</p>
                )}
              </div>
              <EditRow label="Company">
                <select value={company} onChange={event => changeCompany(event.target.value as WhatsAppCompany)} className="input-field" disabled={busy || Boolean(convertedOrderRef)}>
                  <option value="sodamax">SodaMax</option>
                  <option value="spark">Spark</option>
                </select>
              </EditRow>
              <EditRow label="Stage">
                <select value={followUpStatus} onChange={event => setFollowUpStatus(event.target.value as MessageStatus | '')} className="input-field" disabled={busy}>
                  <option value="">Open</option>
                  {SELECTABLE_STATUSES.map(status => (
                    <option key={status} value={status}>{MESSAGE_STATUS_LABELS[status]}</option>
                  ))}
                  {followUpStatus === 'complete' && <option value="complete">{MESSAGE_STATUS_LABELS.complete}</option>}
                </select>
              </EditRow>
              <EditRow label="Notes">
                <textarea value={followUpNotes} onChange={event => setFollowUpNotes(event.target.value)} rows={3} className="input-field resize-y min-h-[4.5rem]" placeholder="Internal notes about calls, messages, or next steps…" disabled={busy} />
              </EditRow>
              <div className="py-3 flex justify-end">
                <button type="button" onClick={() => void handleSaveStatus()} disabled={busy} className="btn-primary inline-flex items-center gap-2">
                  {savingStatus && <ModalSpinner className="w-4 h-4" />}
                  {savingStatus ? 'Saving…' : 'Update status'}
                </button>
              </div>
            </DetailSection>
          </div>
          <DetailSection title="Move as order">
            {convertedOrderRef ? (
              <div className="px-3.5 py-4 space-y-3">
                <p className="text-sm text-ink-700">
                  This call was moved to order <span className="font-mono font-semibold text-brand-700">{convertedOrderRef}</span>.
                </p>
                <Link href={`${ordersHref}?ref=${encodeURIComponent(convertedOrderRef)}`} className="btn-secondary inline-flex">View in Orders</Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 px-3.5 py-3 border-b border-ink-100">
                  <label className="block min-w-0 space-y-2">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-400">Name</span>
                    <input type="text" value={form.customerName} onChange={event => patchOrderForm({ customerName: event.target.value })} className="input-field" autoComplete="name" disabled={busy} />
                  </label>
                  <label className="block min-w-0 space-y-2">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-400">Phone</span>
                    <input type="tel" value={form.customerPhone} onChange={event => patchOrderForm({ customerPhone: event.target.value })} className="input-field tabular-nums" disabled={busy} />
                  </label>
                </div>
                <EditRow label="Address">
                  <textarea value={form.address} onChange={event => patchOrderForm({ address: event.target.value })} rows={2} className="input-field resize-y min-h-[3rem]" disabled={busy} />
                </EditRow>
                <EditRow label="City">
                  <SearchableSelect options={cityOptions} value={form.cityId} onChange={cityId => patchOrderForm({ cityId })} placeholder="Search city…" searchPlaceholder="Search city or region…" loading={citiesLoading} disabled={citiesLoading || busy} />
                </EditRow>
                {(selectedCity?.region || selectedCity?.zone_name) && (
                  <DetailRow label="Region" value={[selectedCity?.region, selectedCity?.zone_name].filter(Boolean).join(' · ')} />
                )}
                <div className="px-3.5 py-3 border-t border-ink-100">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Products</p>
                    <button type="button" onClick={() => setOrderForm(prev => prev ? { ...prev, items: [...prev.items, createLineItem()] } : prev)} disabled={busy} className="text-sm font-semibold text-brand-700 hover:text-brand-800 disabled:opacity-50">+ Add product</button>
                  </div>
                  <div className="rounded-xl border border-ink-300/80 bg-ink-100/80">
                    <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_2.5rem] gap-2 px-3 py-2.5 bg-ink-200/70 border-b border-ink-300/60 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                      <span>Product</span>
                      <span className="text-center">Qty</span>
                      <span className="text-right">Amount</span>
                      <span className="sr-only">Remove</span>
                    </div>
                    <ul className="divide-y divide-ink-300/50">
                      {form.items.map((item, index) => (
                        <li key={item.key} className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_2.5rem] sm:items-center bg-ink-50/50">
                          <SearchableSelect
                            options={productOptions}
                            value={item.item_id ?? ''}
                            onChange={productId => {
                              const product = productById.get(productId)
                              const unit = normalizePrice(product?.price)
                              updateLineItem(item.key, {
                                item_id: product?.id ?? null,
                                product_name: product?.product_name ?? item.product_name,
                                unit_price: String(unit),
                                amount: lineAmountFromParts(unit, item.quantity),
                              })
                            }}
                            allowCustom
                            customValue={item.item_id && productById.has(item.item_id) ? '' : item.product_name}
                            onCustomChange={productName => updateLineItem(item.key, { item_id: null, product_name: productName, unit_price: '0', amount: '0' })}
                            placeholder="Search product…"
                            searchPlaceholder="Search catalog or type custom…"
                            loading={productsLoading}
                            disabled={productsLoading || busy}
                          />
                          <input type="number" min="0" step="1" value={item.quantity} onChange={event => {
                            const nextQty = event.target.value
                            const product = item.item_id ? productById.get(item.item_id) : undefined
                            const unit = item.item_id ? normalizePrice(product?.price) : normalizePrice(item.unit_price)
                            updateLineItem(item.key, { quantity: nextQty, unit_price: String(unit), amount: lineAmountFromParts(unit, nextQty) })
                          }} className="input-field text-sm py-1.5 tabular-nums text-center px-1 bg-white" aria-label={`Quantity line ${index + 1}`} disabled={busy} />
                          <div className="text-sm font-semibold text-ink-800 tabular-nums text-right px-1 py-2">Rs {parseLineTotal(item).toFixed(2)}</div>
                          <div className="flex justify-end sm:justify-center">
                            {form.items.length > 1 ? (
                              <button type="button" onClick={() => setOrderForm(prev => prev && prev.items.length > 1 ? { ...prev, items: prev.items.filter(line => line.key !== item.key) } : prev)} disabled={busy} className="inline-flex items-center justify-center min-w-[36px] min-h-[36px] rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50" aria-label={`Remove line ${index + 1}`}>
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            ) : <span className="hidden sm:block w-9" aria-hidden="true" />}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <DetailRow label="Total qty" value={computedQty > 0 ? String(computedQty) : '—'} />
                <DetailRow label="Order total" value={`Rs ${computedTotal.toFixed(2)}`} />
                <EditRow label="Notes">
                  <textarea value={form.notes} onChange={event => patchOrderForm({ notes: event.target.value })} rows={2} className="input-field resize-y min-h-[3rem]" disabled={busy} />
                </EditRow>
                <div className="py-3 space-y-2">
                  {convertError && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{convertError}</p>}
                  <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                    <p className="text-xs text-ink-400 sm:mr-auto sm:self-center">Creates a complete order and marks this call as moved.</p>
                    <button type="button" onClick={() => void handleConvertToOrder()} disabled={busy} className="btn-primary inline-flex items-center justify-center gap-2">
                      {converting && <ModalSpinner className="w-4 h-4" />}
                      {converting ? 'Creating…' : 'Move as order'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </DetailSection>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}
