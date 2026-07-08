'use client'

import { useEffect, useMemo, useState } from 'react'
import { OrderDateFilter } from '@/components/orders/order-date-filter'
import {
  DEFAULT_TABLE_DATE_FILTER,
  filterOrdersByDate,
  isOrderDateFilterActive,
  toDateInputValue,
  type OrderDateFilterState,
} from '@/lib/order-date-filter'
import {
  buildItemPivot,
  ITEM_PIVOT_EXPORT_COLUMNS,
  type ItemPivotRow,
} from '@/lib/order-item-pivot'
import { downloadCsvRows } from '@/lib/export-csv'
import { formatOrderTotal, type OrderStatus, type WhatsAppBotOrder } from '@/lib/whatsapp-bot-orders'

interface OrderItemPivotModalProps {
  open: boolean
  orders: WhatsAppBotOrder[]
  company: string
  onClose: () => void
}

const STATUS_OPTIONS: { value: '' | OrderStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'complete', label: 'Complete' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

export function OrderItemPivotModal({ open, orders, company, onClose }: OrderItemPivotModalProps) {
  const [dateFilter, setDateFilter] = useState<OrderDateFilterState>(DEFAULT_TABLE_DATE_FILTER)
  const [statusFilter, setStatusFilter] = useState<'' | OrderStatus>('')

  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const filteredOrders = useMemo(() => {
    let result = filterOrdersByDate(orders, dateFilter)
    if (statusFilter) {
      result = result.filter(order => order.status === statusFilter)
    }
    return result
  }, [orders, dateFilter, statusFilter])

  const pivotRows = useMemo(() => buildItemPivot(filteredOrders), [filteredOrders])

  const totalQty = useMemo(
    () => pivotRows.reduce((sum, row) => sum + row.totalQty, 0),
    [pivotRows]
  )

  const totalAmount = useMemo(
    () => pivotRows.reduce((sum, row) => sum + row.totalAmount, 0),
    [pivotRows]
  )

  const hasActiveFilters = isOrderDateFilterActive(dateFilter) || statusFilter !== ''

  const clearFilters = () => {
    setDateFilter(DEFAULT_TABLE_DATE_FILTER)
    setStatusFilter('')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close item pivot"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-pivot-title"
        className="relative bg-white rounded-2xl shadow-card border border-ink-200/80 w-full max-w-3xl max-h-[min(90dvh,900px)] flex flex-col animate-fade-in mx-auto"
      >
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-ink-100 shrink-0">
          <div className="min-w-0">
            <h2 id="item-pivot-title" className="text-lg font-bold text-ink-900 tracking-tight">
              Item pivot
            </h2>
            <p className="text-sm text-ink-500 mt-0.5">
              Total quantity and amount ordered by product across filtered orders.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-nowrap items-center gap-2 px-4 sm:px-6 py-3 border-b border-ink-100 bg-ink-50/40 shrink-0 overflow-x-auto">
          <OrderDateFilter value={dateFilter} onChange={setDateFilter} />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as '' | OrderStatus)}
            className="select-field shrink-0 min-w-[9.5rem] h-8 sm:h-10 text-xs sm:text-sm"
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map(option => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-secondary shrink-0 !py-1.5 !px-3 text-xs sm:text-sm whitespace-nowrap"
            >
              Clear filters
            </button>
          )}
          <span className="text-xs sm:text-sm text-ink-500 tabular-nums whitespace-nowrap shrink-0">
            {pivotRows.length} product{pivotRows.length === 1 ? '' : 's'} · {totalQty} units ·{' '}
            {formatOrderTotal(totalAmount)}
          </span>
          <div className="flex-1 min-w-2 shrink" aria-hidden="true" />
          <button
            type="button"
            disabled={pivotRows.length === 0}
            onClick={() =>
              downloadCsvRows(
                `${company}-item-pivot-${toDateInputValue(new Date())}.csv`,
                pivotRows,
                ITEM_PIVOT_EXPORT_COLUMNS
              )
            }
            className="btn-secondary shrink-0 !py-1.5 !px-3 text-xs sm:text-sm whitespace-nowrap"
          >
            Export CSV
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {pivotRows.length === 0 ? (
            <div className="empty-state py-12">
              <p className="text-sm font-semibold text-ink-900">No items in this range</p>
              <p className="text-sm text-ink-500">Try a different date or status filter.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm text-brand-600 hover:text-brand-700 font-semibold"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 panel-header">
                <tr>
                  <th className="px-4 sm:px-6 py-2.5 text-left font-semibold uppercase tracking-wide text-xs">
                    Product name
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-xs w-28">
                    Total qty
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold uppercase tracking-wide text-xs w-32">
                    Total amount
                  </th>
                  <th className="px-4 sm:px-6 py-2.5 text-right font-semibold uppercase tracking-wide text-xs w-24">
                    Orders
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {pivotRows.map(row => (
                  <PivotRow key={row.productName} row={row} />
                ))}
              </tbody>
              <tfoot className="border-t border-ink-200 bg-ink-50/60">
                <tr>
                  <td className="px-4 sm:px-6 py-3 font-semibold text-ink-900">Total</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-brand-700">{totalQty}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-brand-700">
                    {formatOrderTotal(totalAmount)}
                  </td>
                  <td className="px-4 sm:px-6 py-3 text-right tabular-nums text-ink-600">
                    {filteredOrders.length}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function PivotRow({ row }: { row: ItemPivotRow }) {
  return (
    <tr className="align-middle">
      <td className="px-4 sm:px-6 py-2.5 font-medium text-ink-900">{row.productName}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-ink-800">{row.totalQty}</td>
      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-ink-900">
        {formatOrderTotal(row.totalAmount)}
      </td>
      <td className="px-4 sm:px-6 py-2.5 text-right tabular-nums text-ink-500">{row.orderCount}</td>
    </tr>
  )
}
