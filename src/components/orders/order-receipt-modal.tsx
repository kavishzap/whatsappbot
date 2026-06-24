'use client'

import { useEffect } from 'react'
import {
  displayOrderAddress,
  displayOrderCity,
  displayOrderCityRegion,
  displayOrderCustomerName,
  displayOrderZoneName,
  formatOrderDate,
  formatOrderItemLabel,
  formatOrderProductsList,
  formatOrderTotal,
  formatOrderTotalQty,
  type OrderStatus,
  type WhatsAppBotOrder,
} from '@/lib/whatsapp-bot-orders'
import { ORDER_STATUS_LABELS } from '@/lib/order-item-pivot'
import {
  BrandLabel,
  DetailRow,
  DetailSection,
  ORDER_MODAL_SHELL,
  StatusBadge,
} from '@/components/orders/order-modal-shared'

interface OrderReceiptModalProps {
  order: WhatsAppBotOrder | null
  updating?: boolean
  onClose: () => void
  onEdit?: (order: WhatsAppBotOrder) => void
  onApprove: (order: WhatsAppBotOrder) => void
  onMarkComplete?: (order: WhatsAppBotOrder) => void
  onDelete?: (order: WhatsAppBotOrder) => void
}

function modalTitle(status: OrderStatus): string {
  if (status === 'approved') return 'Order approved'
  if (status === 'rejected') return 'Order rejected'
  if (status === 'draft') return 'Draft order'
  return 'Order details'
}

export function OrderReceiptModal({
  order,
  updating = false,
  onClose,
  onEdit,
  onApprove,
  onMarkComplete,
  onDelete,
}: OrderReceiptModalProps) {
  useEffect(() => {
    if (!order) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !updating) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [order, updating, onClose])

  if (!order) return null

  const items = order.items ?? []
  const showDraftActions = order.status === 'draft'
  const showCompleteActions = order.status === 'complete'
  const showRejectedActions = order.status === 'rejected'
  const showApproveAction = showDraftActions || showCompleteActions || showRejectedActions
  const totalQty = formatOrderTotalQty(order)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close order details"
        onClick={onClose}
        disabled={updating}
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm disabled:cursor-not-allowed"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-modal-title"
        className={ORDER_MODAL_SHELL}
      >
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-ink-100 shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-ink-400 mb-1">
              <BrandLabel company={order.company} />
            </p>
            <h2 id="order-modal-title" className="text-lg font-bold text-ink-900 tracking-tight truncate">
              {modalTitle(order.status)}
            </h2>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={order.status} />
            <button
              type="button"
              onClick={onClose}
              disabled={updating}
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
            <DetailRow label="Status" value={ORDER_STATUS_LABELS[order.status]} />
          </DetailSection>

          <DetailSection title="Customer">
            <DetailRow label="Name" value={displayOrderCustomerName(order)} />
            <DetailRow label="Phone Number" value={order.customer_phone_number} />
          </DetailSection>

          <DetailSection title="Delivery">
            <DetailRow label="Address" value={displayOrderAddress(order)} />
            <DetailRow label="City" value={displayOrderCity(order)} />
            <DetailRow label="Region" value={displayOrderCityRegion(order)} />
            <DetailRow label="Zone" value={displayOrderZoneName(order)} />
          </DetailSection>

          <DetailSection title="Items & total">
            <DetailRow label="Product" value={formatOrderProductsList(order)} />
            <DetailRow label="Qty" value={totalQty > 0 ? String(totalQty) : '—'} />
            <DetailRow label="Amount" value={formatOrderTotal(Number(order.total))} />
            <DetailRow label="Note" value={order.notes?.trim() || '—'} />
          </DetailSection>

          {items.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                  Line items
                </p>
                <span className="text-xs text-ink-400 tabular-nums">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="rounded-xl border border-ink-200/80 overflow-hidden">
                <div className="grid grid-cols-[1fr_3.5rem_5.5rem] gap-2 px-3.5 py-2 bg-ink-50/90 border-b border-ink-100 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  <span>Product</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Amount</span>
                </div>

                <ul className="divide-y divide-ink-100">
                  {items.map(item => {
                    const label = formatOrderItemLabel(item)
                    return (
                      <li
                        key={item.id}
                        className="grid grid-cols-[1fr_3.5rem_5.5rem] gap-2 px-3.5 py-3 text-sm text-ink-700"
                      >
                        <span className="truncate pr-2 font-medium text-ink-800" title={label}>
                          {label}
                        </span>
                        <span className="text-center tabular-nums text-ink-600">{item.quantity}</span>
                        <span className="text-right tabular-nums font-medium text-ink-900">
                          {formatOrderTotal(Number(item.line_total))}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>

        {(onDelete || onEdit || showApproveAction) && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-6 py-4 border-t border-ink-100 bg-ink-50/40 shrink-0">
            {onEdit && (
              <button
                type="button"
                disabled={updating}
                onClick={() => onEdit(order)}
                className="btn-secondary w-full sm:w-auto sm:mr-auto"
              >
                Edit
              </button>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 w-full sm:w-auto">
            {showDraftActions && (
              <button
                type="button"
                disabled={updating}
                onClick={() => (onMarkComplete ?? onApprove)(order)}
                className="btn-primary w-full sm:w-auto"
              >
                {updating ? 'Updating…' : 'Mark complete'}
              </button>
            )}

            {showCompleteActions && (
              <button
                type="button"
                disabled={updating}
                onClick={() => onApprove(order)}
                className="btn-primary w-full sm:w-auto"
              >
                {updating ? 'Updating…' : 'Approve'}
              </button>
            )}

            {showRejectedActions && (
              <button
                type="button"
                disabled={updating}
                onClick={() => onApprove(order)}
                className="btn-primary w-full sm:w-auto"
              >
                {updating ? 'Updating…' : 'Approve'}
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                disabled={updating}
                onClick={() => onDelete(order)}
                className="inline-flex items-center justify-center w-full sm:w-auto h-10 px-4 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Delete
              </button>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
