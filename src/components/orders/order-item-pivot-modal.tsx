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
import { TablePagination } from '@/components/ui/table-pagination'

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

const DEFAULT_PAGE_SIZE = 10

export function OrderItemPivotModal({ open, orders, company, onClose }: OrderItemPivotModalProps) {
  const [dateFilter, setDateFilter] = useState<OrderDateFilterState>(DEFAULT_TABLE_DATE_FILTER)
  const [statusFilter, setStatusFilter] = useState<'' | OrderStatus>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

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

  const totalPages = Math.max(1, Math.ceil(pivotRows.length / pageSize))

  useEffect(() => {
    setPage(1)
  }, [dateFilter, statusFilter, pageSize, pivotRows.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return pivotRows.slice(start, start + pageSize)
  }, [pivotRows, page, pageSize])

  const rangeStart = pivotRows.length === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, pivotRows.length)

  const hasActiveFilters = isOrderDateFilterActive(dateFilter) || statusFilter !== ''

  const clearFilters = () => {
    setDateFilter(DEFAULT_TABLE_DATE_FILTER)
    setStatusFilter('')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 lg:p-6">
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
        className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-card border border-ink-200/80 w-full max-w-[min(96vw,72rem)] h-[min(94dvh,920px)] sm:h-[min(90dvh,920px)] flex flex-col animate-fade-in overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 px-5 sm:px-7 lg:px-8 py-5 sm:py-6 border-b border-ink-100 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 id="item-pivot-title" className="text-xl sm:text-2xl font-bold text-ink-900 tracking-tight">
              Item pivot
            </h2>
            <p className="text-sm sm:text-base text-ink-500 mt-1 max-w-2xl leading-relaxed">
              Total quantity and amount ordered by product across filtered orders.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="shrink-0 border-b border-ink-100 bg-ink-50/50 px-5 sm:px-7 lg:px-8 py-4 sm:py-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <OrderDateFilter value={dateFilter} onChange={setDateFilter} />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as '' | OrderStatus)}
                className="select-field shrink-0 min-w-[10rem] h-9 sm:h-10 text-sm"
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
                  className="btn-secondary shrink-0 !py-2 !px-4 text-sm whitespace-nowrap"
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <SummaryStat label="Products" value={String(pivotRows.length)} />
              <SummaryStat label="Units" value={String(totalQty)} />
              <SummaryStat label="Amount" value={formatOrderTotal(totalAmount)} highlight />
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
                className="btn-secondary shrink-0 !py-2 !px-4 text-sm whitespace-nowrap w-full sm:w-auto"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {pivotRows.length === 0 ? (
            <div className="empty-state py-16 sm:py-24 px-6">
              <p className="text-base font-semibold text-ink-900">No items in this range</p>
              <p className="text-sm text-ink-500 mt-1">Try a different date or status filter.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm text-brand-600 hover:text-brand-700 font-semibold mt-3"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="min-w-[36rem]">
              <table className="w-full text-sm sm:text-base">
                <thead className="sticky top-0 z-10 panel-header">
                  <tr>
                    <th className="px-5 sm:px-7 lg:px-8 py-3.5 sm:py-4 text-left font-semibold uppercase tracking-wide text-xs text-ink-500">
                      Product name
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 sm:py-4 text-right font-semibold uppercase tracking-wide text-xs text-ink-500 w-32 sm:w-36">
                      Total qty
                    </th>
                    <th className="px-4 sm:px-5 py-3.5 sm:py-4 text-right font-semibold uppercase tracking-wide text-xs text-ink-500 w-36 sm:w-44">
                      Total amount
                    </th>
                    <th className="px-5 sm:px-7 lg:px-8 py-3.5 sm:py-4 text-right font-semibold uppercase tracking-wide text-xs text-ink-500 w-28 sm:w-32">
                      Orders
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {paginatedRows.map(row => (
                    <PivotRow key={row.productName} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pivotRows.length > 0 && (
          <div className="shrink-0 border-t border-ink-200 bg-white">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 px-5 sm:px-7 lg:px-8 py-4 border-b border-ink-100 bg-ink-50/40">
              <FooterMetric label="Grand total" value="All products" />
              <FooterMetric label="Total qty" value={String(totalQty)} bold />
              <FooterMetric label="Total amount" value={formatOrderTotal(totalAmount)} bold accent />
              <FooterMetric label="Orders in range" value={String(filteredOrders.length)} />
            </div>
            <TablePagination
              page={page}
              totalPages={totalPages}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              totalItems={pivotRows.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-ink-200/80 bg-white px-3 py-2 text-sm shadow-sm">
      <span className="text-ink-500 whitespace-nowrap">{label}</span>
      <span
        className={`font-semibold tabular-nums whitespace-nowrap ${highlight ? 'text-brand-700' : 'text-ink-900'}`}
      >
        {value}
      </span>
    </div>
  )
}

function FooterMetric({
  label,
  value,
  bold = false,
  accent = false,
}: {
  label: string
  value: string
  bold?: boolean
  accent?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-ink-500 font-medium">{label}</p>
      <p
        className={`mt-0.5 truncate tabular-nums ${
          accent ? 'text-brand-700' : bold ? 'text-ink-900 font-bold' : 'text-ink-800 font-medium'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function PivotRow({ row }: { row: ItemPivotRow }) {
  return (
    <tr className="align-middle hover:bg-ink-50/60 transition-colors">
      <td className="px-5 sm:px-7 lg:px-8 py-3.5 sm:py-4 font-medium text-ink-900">{row.productName}</td>
      <td className="px-4 sm:px-5 py-3.5 sm:py-4 text-right tabular-nums text-ink-800">{row.totalQty}</td>
      <td className="px-4 sm:px-5 py-3.5 sm:py-4 text-right tabular-nums font-medium text-ink-900">
        {formatOrderTotal(row.totalAmount)}
      </td>
      <td className="px-5 sm:px-7 lg:px-8 py-3.5 sm:py-4 text-right tabular-nums text-ink-500">
        {row.orderCount}
      </td>
    </tr>
  )
}
