'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  fetchBotOrders,
  formatOrderDate,
  formatOrderTotal,
  updateOrderStatus,
  type OrderStatus,
  type WhatsAppBotOrder,
} from '@/lib/whatsapp-bot-orders'
import { useToast } from '@/components/ui/toast'
import { OrderReceiptModal } from '@/components/orders/order-receipt-modal'
import { TablePagination } from '@/components/ui/table-pagination'

function matchesOrderSearch(order: WhatsAppBotOrder, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    order.order_ref.toLowerCase().includes(q) ||
    order.customer_name.toLowerCase().includes(q) ||
    order.customer_phone_number.includes(q) ||
    order.product_name.toLowerCase().includes(q) ||
    order.city.toLowerCase().includes(q)
  )
}

function countByStatus(orders: WhatsAppBotOrder[], status: OrderStatus): number {
  return orders.filter(order => order.status === status).length
}

export default function OrdersPage() {
  const toast = useToast()
  const [orders, setOrders] = useState<WhatsAppBotOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedOrder, setSelectedOrder] = useState<WhatsAppBotOrder | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchBotOrders()
      setOrders(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load orders')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const handleStatusChange = useCallback(
    async (order: WhatsAppBotOrder, status: OrderStatus) => {
      if (order.status === status) return
      setUpdatingId(order.id)
      try {
        const updated = await updateOrderStatus(order.id, status)
        setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)))
        setSelectedOrder(prev => (prev?.id === updated.id ? updated : prev))
        toast.success(`Order ${status}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update order')
      } finally {
        setUpdatingId(null)
      }
    },
    [toast]
  )

  const filteredOrders = useMemo(
    () => orders.filter(order => matchesOrderSearch(order, searchQuery)),
    [orders, searchQuery]
  )

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize))

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredOrders.slice(start, start + pageSize)
  }, [filteredOrders, page, pageSize])

  const rangeStart = filteredOrders.length === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, filteredOrders.length)

  const stats = useMemo(
    () => ({
      total: orders.length,
      approved: countByStatus(orders, 'approved'),
      pending: countByStatus(orders, 'pending'),
      rejected: countByStatus(orders, 'rejected'),
    }),
    [orders]
  )

  useEffect(() => {
    setPage(1)
  }, [searchQuery, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <div className="flex flex-col h-full min-h-0 max-w-[1400px] mx-auto w-full gap-4">
      <OrderReceiptModal
        order={selectedOrder}
        updating={selectedOrder ? updatingId === selectedOrder.id : false}
        onClose={() => setSelectedOrder(null)}
        onApprove={order => handleStatusChange(order, 'approved')}
        onReject={order => handleStatusChange(order, 'rejected')}
      />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Orders</h2>
          <p className="text-sm text-gray-500 mt-1">
            WhatsApp orders saved from the chatbot flow.
          </p>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          disabled={loading}
          className="flex items-center justify-center gap-2 shrink-0 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
        <StatCard label="Total orders" value={loading ? '—' : String(stats.total)} />
        <StatCard
          label="Approved orders"
          value={loading ? '—' : String(stats.approved)}
          valueClassName="text-emerald-600"
        />
        <StatCard
          label="Pending orders"
          value={loading ? '—' : String(stats.pending)}
          valueClassName="text-amber-600"
        />
        <StatCard
          label="Rejected orders"
          value={loading ? '—' : String(stats.rejected)}
          valueClassName="text-red-600"
        />
      </div>

      {!loading && orders.length > 0 && (
        <div className="relative max-w-md shrink-0">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search order ref, customer, phone, product…"
            className="w-full h-10 pl-9 pr-9 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-2 flex items-center px-1 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div className="hidden md:flex flex-1 min-h-0 flex-col bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <LoadingState />
          ) : orders.length === 0 ? (
            <EmptyState />
          ) : filteredOrders.length === 0 ? (
            <NoResults onClear={() => setSearchQuery('')} />
          ) : (
            <table className="w-full min-w-[1200px] text-sm table-fixed">
              <colgroup>
                <col className="w-[132px]" />
                <col className="w-[132px]" />
                <col className="w-[88px]" />
                <col className="w-[108px]" />
                <col className="w-[108px]" />
                <col className="w-[140px]" />
                <col className="w-[48px]" />
                <col className="w-[108px]" />
                <col className="w-[140px]" />
                <col className="w-[88px]" />
                <col className="w-[120px]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm border-b border-gray-100">
                <tr className="text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Order ref</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Customer</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Phone</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Product</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap text-center">Qty</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">City</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Address</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap text-right">Total</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedOrders.map(order => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="hover:bg-emerald-50/40 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-emerald-700 max-w-0">
                      <span className="block truncate" title={order.order_ref}>
                        {order.order_ref}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                      {formatOrderDate(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium truncate" title={order.customer_name}>
                      {order.customer_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">
                      {order.customer_phone_number}
                    </td>
                    <td className="px-4 py-3 text-gray-800 truncate" title={order.product_name}>
                      {order.product_name}
                    </td>
                    <td className="px-4 py-3 text-gray-800 text-center tabular-nums">
                      {order.quantity}
                    </td>
                    <td className="px-4 py-3 text-gray-600 truncate" title={order.city}>
                      {order.city}
                    </td>
                    <td className="px-4 py-3 text-gray-600 truncate" title={order.address}>
                      {order.address}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-semibold text-right whitespace-nowrap tabular-nums">
                      {formatOrderTotal(Number(order.total))}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <OrderActions
                        order={order}
                        updating={updatingId === order.id}
                        onApprove={() => handleStatusChange(order, 'approved')}
                        onReject={() => handleStatusChange(order, 'rejected')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filteredOrders.length > 0 && (
          <TablePagination
            page={page}
            totalPages={totalPages}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            totalItems={filteredOrders.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden flex flex-1 min-h-0 flex-col gap-3">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm">
            <LoadingState />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm">
            <EmptyState />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm">
            <NoResults onClear={() => setSearchQuery('')} />
          </div>
        ) : (
          <>
            {paginatedOrders.map(order => (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 space-y-3"
              >
                <button
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className="w-full text-left space-y-3 hover:opacity-90 transition-opacity"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-emerald-700 truncate min-w-0" title={order.order_ref}>
                      {order.order_ref}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-xs text-gray-500">{formatOrderDate(order.created_at)}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Customer</p>
                      <p className="text-gray-900 font-medium">{order.customer_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Phone</p>
                      <p className="text-gray-700 tabular-nums">{order.customer_phone_number}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Product</p>
                      <p className="text-gray-800">{order.product_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Qty</p>
                      <p className="text-gray-800">{order.quantity}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">City / Address</p>
                      <p className="text-gray-700">{order.city} — {order.address}</p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs text-gray-500">Total</span>
                    <span className="text-base font-semibold text-gray-900">{formatOrderTotal(Number(order.total))}</span>
                  </div>
                </button>
                <div className="pt-2 border-t border-gray-100 flex justify-end">
                  <OrderActions
                    order={order}
                    updating={updatingId === order.id}
                    onApprove={() => handleStatusChange(order, 'approved')}
                    onReject={() => handleStatusChange(order, 'rejected')}
                  />
                </div>
              </div>
            ))}
            {filteredOrders.length > 0 && (
              <TablePagination
                page={page}
                totalPages={totalPages}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                totalItems={filteredOrders.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    pending: 'bg-amber-50 text-amber-700 ring-amber-100',
    approved: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    rejected: 'bg-red-50 text-red-700 ring-red-100',
  }

  const labels: Record<OrderStatus, string> = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ring-1 ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function OrderActions({
  order,
  updating,
  onApprove,
  onReject,
}: {
  order: WhatsAppBotOrder
  updating: boolean
  onApprove: () => void
  onReject: () => void
}) {
  if (order.status === 'approved') {
    return (
      <span className="text-[11px] font-medium text-emerald-600">Approved</span>
    )
  }

  if (order.status === 'rejected') {
    return (
      <button
        type="button"
        disabled={updating}
        onClick={onApprove}
        className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
      >
        {updating ? '…' : 'Approve'}
      </button>
    )
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        disabled={updating}
        onClick={onApprove}
        className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
      >
        {updating ? '…' : 'Approve'}
      </button>
      <button
        type="button"
        disabled={updating}
        onClick={onReject}
        className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
      >
        Reject
      </button>
    </div>
  )
}

function StatCard({
  label,
  value,
  className = '',
  valueClassName = 'text-gray-900',
}: {
  label: string
  value: string
  className?: string
  valueClassName?: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200/80 shadow-sm px-4 py-3.5 ${className}`}>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${valueClassName}`}>{value}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="px-4 py-16 flex flex-col items-center justify-center gap-3 text-gray-400">
      <Spinner className="w-7 h-7" />
      <p className="text-sm">Loading orders…</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="px-6 py-16 flex flex-col items-center justify-center text-center gap-3">
      <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p className="text-sm font-medium text-gray-900">No orders yet</p>
      <p className="text-sm text-gray-500 max-w-xs">Orders placed via WhatsApp will appear here.</p>
    </div>
  )
}

function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="px-6 py-14 flex flex-col items-center justify-center text-center gap-3">
      <SearchIcon className="w-8 h-8 text-gray-300" />
      <p className="text-sm font-medium text-gray-900">No orders found</p>
      <button type="button" onClick={onClear} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
        Clear search
      </button>
    </div>
  )
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? ''}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}
