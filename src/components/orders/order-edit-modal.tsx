'use client'

import { useEffect, useMemo, useState } from 'react'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import {
  formatOrderDate,
  formatOrderItemLabel,
  formatOrderTotal,
  resolveEditAddress,
  type OrderStatus,
  type UpdateBotOrderPayload,
  type WhatsAppBotOrder,
  type WhatsAppBotOrderItem,
} from '@/lib/whatsapp-bot-orders'
import { ORDER_STATUS_LABELS } from '@/lib/order-item-pivot'
import { useToast } from '@/components/ui/toast'
import {
  BrandLabel,
  DetailRow,
  DetailSection,
  EditRow,
  ORDER_MODAL_SHELL,
  resolveInitialCityId,
  StatusBadge,
  type CityOption,
} from '@/components/orders/order-modal-shared'

interface EditableItem {
  key: string
  item_id: string | null
  color_id: string | null
  product_name: string
  color_name: string | null
  color_hex: string | null
  quantity: string
  unit_price: string
}

interface OrderEditModalProps {
  order: WhatsAppBotOrder | null
  company: WhatsAppCompany
  saving?: boolean
  onClose: () => void
  onSave: (payload: UpdateBotOrderPayload) => void
}

const STATUS_OPTIONS: OrderStatus[] = ['draft', 'complete', 'approved', 'rejected']

function toEditableItem(item: WhatsAppBotOrderItem, index: number): EditableItem {
  return {
    key: item.id || `line-${index}`,
    item_id: item.item_id,
    color_id: item.color_id,
    product_name: item.product_name ?? '',
    color_name: item.color_name,
    color_hex: item.color_hex,
    quantity: String(item.quantity),
    unit_price: String(item.unit_price),
  }
}

function itemFromEditable(item: EditableItem): WhatsAppBotOrderItem {
  const quantity = parseFloat(item.quantity)
  const unit_price = parseFloat(item.unit_price)
  const safeQty = Number.isFinite(quantity) ? quantity : 0
  const safePrice = Number.isFinite(unit_price) ? unit_price : 0

  return {
    id: item.key,
    order_id: '',
    item_id: item.item_id,
    color_id: item.color_id,
    product_name: item.product_name,
    color_name: item.color_name,
    color_hex: item.color_hex,
    quantity: safeQty,
    unit_price: safePrice,
    line_total: safeQty * safePrice,
    sort_order: 0,
  }
}

function parseLineTotal(item: EditableItem): number {
  const qty = parseFloat(item.quantity)
  const price = parseFloat(item.unit_price)
  if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0) return 0
  return qty * price
}

function buildFormState(order: WhatsAppBotOrder) {
  return {
    customerName: order.customer_name?.trim() ?? '',
    address: resolveEditAddress(order),
    cityId: order.city_id?.trim() ?? '',
    notes: order.notes?.trim() ?? '',
    status: order.status,
    items:
      order.items.length > 0
        ? order.items.map(toEditableItem)
        : [
            {
              key: 'line-0',
              item_id: null,
              color_id: null,
              product_name: '',
              color_name: null,
              color_hex: null,
              quantity: '1',
              unit_price: String(order.total ?? 0),
            },
          ],
  }
}

export function OrderEditModal({
  order,
  company,
  saving = false,
  onClose,
  onSave,
}: OrderEditModalProps) {
  const toast = useToast()
  const [form, setForm] = useState(() => (order ? buildFormState(order) : null))
  const [cities, setCities] = useState<CityOption[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)

  useEffect(() => {
    if (!order) {
      setForm(null)
      return
    }
    setForm(buildFormState(order))
  }, [order?.id])

  useEffect(() => {
    if (!order) return

    setCitiesLoading(true)
    fetch(`/api/whatsapp-cities?company=${company}`)
      .then(res => res.json())
      .then(json => {
        const rows = (json.data ?? []) as CityOption[]
        const sorted = [...rows].sort(
          (a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name)
        )
        setCities(sorted)
        setForm(prev => {
          if (!prev || prev.cityId) return prev
          const resolved = resolveInitialCityId(order, sorted)
          return resolved ? { ...prev, cityId: resolved } : prev
        })
      })
      .catch(() => setCities([]))
      .finally(() => setCitiesLoading(false))
  }, [order?.id, company])

  useEffect(() => {
    if (!order) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [order, saving, onClose])

  const selectedCity = useMemo(
    () => cities.find(city => city.id === form?.cityId) ?? null,
    [cities, form?.cityId]
  )

  const computedTotal = useMemo(
    () => (form?.items ?? []).reduce((sum, item) => sum + parseLineTotal(item), 0),
    [form?.items]
  )

  const computedQty = useMemo(
    () =>
      (form?.items ?? []).reduce((sum, item) => {
        const qty = parseFloat(item.quantity)
        return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0)
      }, 0),
    [form?.items]
  )

  const productsSummary = useMemo(() => {
    if (!form) return '—'
    const labels = form.items
      .map(item => formatOrderItemLabel(itemFromEditable(item)))
      .filter(label => label.trim())
    return labels.length > 0 ? labels.join('\n') : '—'
  }, [form])

  if (!order || !form) return null

  const updateItem = (key: string, patch: Partial<EditableItem>) => {
    setForm(prev =>
      prev
        ? {
            ...prev,
            items: prev.items.map(item => (item.key === key ? { ...item, ...patch } : item)),
          }
        : prev
    )
  }

  const handleSubmit = () => {
    const trimmedName = form.customerName.trim()
    if (!trimmedName) {
      toast.error('Customer name is required.')
      return
    }

    const parsedItems = form.items
      .map((item, index) => {
        const product_name = item.product_name.trim()
        if (!product_name) return null

        const quantity = parseFloat(item.quantity)
        const unit_price = parseFloat(item.unit_price)
        if (!Number.isFinite(quantity) || quantity <= 0) return null
        if (!Number.isFinite(unit_price) || unit_price < 0) return null

        return {
          item_id: item.item_id,
          color_id: item.color_id,
          product_name,
          color_name: item.color_name,
          color_hex: item.color_hex,
          quantity,
          unit_price,
          line_total: quantity * unit_price,
          sort_order: index,
        }
      })
      .filter(Boolean) as UpdateBotOrderPayload['items']

    if (!parsedItems?.length) {
      toast.error('Add at least one product line with a name, quantity, and price.')
      return
    }

    onSave({
      id: order.id,
      company,
      status: form.status,
      customer_name: trimmedName,
      address: form.address.trim(),
      city_id: form.cityId.trim() || null,
      city: selectedCity?.name ?? order.mapped_city_name?.trim() ?? '',
      notes: form.notes.trim() || null,
      total: computedTotal,
      items: parsedItems,
    })
  }

  const canSave =
    form.customerName.trim().length > 0 &&
    form.items.some(item => item.product_name.trim()) &&
    form.items.every(item => {
      if (!item.product_name.trim()) return true
      const qty = parseFloat(item.quantity)
      const price = parseFloat(item.unit_price)
      return Number.isFinite(qty) && qty > 0 && Number.isFinite(price) && price >= 0
    })

  const regionLabel =
    selectedCity?.region?.trim() ||
    order.mapped_city_region?.trim() ||
    '—'

  const zoneLabel =
    selectedCity?.zone_name?.trim() ||
    order.mapped_zone_name?.trim() ||
    '—'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close edit order"
        onClick={onClose}
        disabled={saving}
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm disabled:cursor-not-allowed"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-edit-title"
        className={ORDER_MODAL_SHELL}
      >
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-ink-100 shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-ink-400 mb-1">
              <BrandLabel company={order.company} />
            </p>
            <h2 id="order-edit-title" className="text-lg font-bold text-ink-900 tracking-tight truncate">
              Edit order
            </h2>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={form.status} />
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 disabled:opacity-50 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4 min-h-0">
          <DetailSection title="Order">
            <DetailRow label="Order Ref" value={order.order_ref} />
            <DetailRow label="Date" value={formatOrderDate(order.created_at)} />
            <EditRow label="Status">
              <select
                value={form.status}
                onChange={e => setForm(prev => (prev ? { ...prev, status: e.target.value as OrderStatus } : prev))}
                className="input-field"
              >
                {STATUS_OPTIONS.map(value => (
                  <option key={value} value={value}>
                    {ORDER_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </EditRow>
          </DetailSection>

          <DetailSection title="Customer">
            <EditRow label="Name">
              <input
                type="text"
                value={form.customerName}
                onChange={e => setForm(prev => (prev ? { ...prev, customerName: e.target.value } : prev))}
                className="input-field"
                autoComplete="name"
              />
            </EditRow>
            <DetailRow label="Phone Number" value={order.customer_phone_number} />
          </DetailSection>

          <DetailSection title="Delivery">
            <EditRow label="Address">
              <textarea
                value={form.address}
                onChange={e => setForm(prev => (prev ? { ...prev, address: e.target.value } : prev))}
                rows={2}
                className="input-field resize-y min-h-[72px]"
              />
            </EditRow>
            <EditRow label="City">
              <select
                value={form.cityId}
                onChange={e => setForm(prev => (prev ? { ...prev, cityId: e.target.value } : prev))}
                className="input-field"
                disabled={citiesLoading}
              >
                <option value="">
                  {citiesLoading
                    ? 'Loading cities…'
                    : selectedCity?.name || order.mapped_city_name?.trim() || 'Select city'}
                </option>
                {cities.map(city => (
                  <option key={city.id} value={city.id}>
                    {city.name} · {city.region}
                    {city.zone_name ? ` · ${city.zone_name}` : ''}
                  </option>
                ))}
              </select>
            </EditRow>
            <DetailRow label="Region" value={regionLabel} />
            <DetailRow label="Zone" value={zoneLabel} />
          </DetailSection>

          <DetailSection title="Items & total">
            <DetailRow label="Product" value={productsSummary} />
            <DetailRow label="Qty" value={computedQty > 0 ? String(computedQty) : '—'} />
            <DetailRow label="Amount" value={formatOrderTotal(computedTotal)} />
            <EditRow label="Note">
              <textarea
                value={form.notes}
                onChange={e => setForm(prev => (prev ? { ...prev, notes: e.target.value } : prev))}
                rows={2}
                className="input-field resize-y min-h-[72px]"
              />
            </EditRow>
          </DetailSection>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Line items</p>
              <button
                type="button"
                onClick={() =>
                  setForm(prev =>
                    prev
                      ? {
                          ...prev,
                          items: [
                            ...prev.items,
                            {
                              key: crypto.randomUUID(),
                              item_id: null,
                              color_id: null,
                              product_name: '',
                              color_name: null,
                              color_hex: null,
                              quantity: '1',
                              unit_price: '0',
                            },
                          ],
                        }
                      : prev
                  )
                }
                className="text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                + Add line
              </button>
            </div>

            <div className="rounded-xl border border-ink-200/80 overflow-hidden">
              <div className="grid grid-cols-[1fr_3.5rem_5.5rem] gap-2 px-3.5 py-2 bg-ink-50/90 border-b border-ink-100 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <span>Product</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Amount</span>
              </div>

              <ul className="divide-y divide-ink-100">
                {form.items.map((item, index) => (
                  <li
                    key={item.key}
                    className="grid grid-cols-[1fr_3.5rem_5.5rem] gap-2 px-3.5 py-3 text-sm text-ink-700 items-start"
                  >
                    <div className="min-w-0 space-y-1">
                      <input
                        type="text"
                        value={item.product_name}
                        onChange={e => updateItem(item.key, { product_name: e.target.value })}
                        className="input-field text-sm py-1.5"
                        placeholder="Product name"
                      />
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm(prev =>
                              prev
                                ? {
                                    ...prev,
                                    items: prev.items.filter(row => row.key !== item.key),
                                  }
                                : prev
                            )
                          }
                          className="text-[11px] text-red-600 hover:text-red-700"
                        >
                          Remove item {index + 1}
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={e => updateItem(item.key, { quantity: e.target.value })}
                      className="input-field text-sm py-1.5 tabular-nums text-center px-1"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={parseLineTotal(item) || ''}
                      onChange={e => {
                        const lineTotal = parseFloat(e.target.value)
                        const qty = parseFloat(item.quantity)
                        if (!Number.isFinite(lineTotal) || !Number.isFinite(qty) || qty <= 0) return
                        updateItem(item.key, { unit_price: String(lineTotal / qty) })
                      }}
                      className="input-field text-sm py-1.5 tabular-nums text-right px-1"
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-4 sm:px-6 py-4 border-t border-ink-100 bg-ink-50/40 shrink-0">
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary w-full sm:w-auto">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !canSave}
            className="btn-primary w-full sm:w-auto"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
