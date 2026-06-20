'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  fetchBotOrders,
  formatOrderDate,
  formatOrderTotal,
  displayOrderCustomerName,
  displayOrderAddress,
  displayOrderCity,
  displayOrderCityRegion,
  displayOrderZoneName,
  formatOrderItemLabel,
  formatOrderProductsList,
  formatOrderTotalQty,
  updateOrderStatus,
  deleteBotOrder,
  type OrderStatus,
  type WhatsAppBotOrder,
} from '@/lib/whatsapp-bot-orders'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'
import { useToast } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { OrderReceiptModal } from '@/components/orders/order-receipt-modal'
import { OrderItemPivotModal } from '@/components/orders/order-item-pivot-modal'
import { OrderActionsMenu } from '@/components/orders/order-actions-menu'
import { OrderDateFilter } from '@/components/orders/order-date-filter'
import { CollapsibleKpiPanel } from '@/components/ui/collapsible-kpi-panel'
import { DynamicTable, type DynamicTableColumn } from '@/components/ui/dynamic-table'
import { HoverTooltip } from '@/components/ui/hover-tooltip'
import { useDashboardHeaderActions } from '@/components/dashboard/dashboard-header-context'
import {
  DEFAULT_TABLE_DATE_FILTER,
  filterOrdersByDate,
  isOrderDateFilterActive,
  toDateInputValue,
  type OrderDateFilterState,
} from '@/lib/order-date-filter'
import {
  expandOrdersForExport,
  ORDER_EXPORT_COLUMNS,
  ORDER_STATUS_LABELS,
} from '@/lib/order-item-pivot'
import type { CsvColumn } from '@/lib/export-csv'

function matchesOrderSearch(order: WhatsAppBotOrder, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    order.order_ref.toLowerCase().includes(q) ||
    (order.customer_name ?? '').toLowerCase().includes(q) ||
    order.customer_phone_number.includes(q) ||
    order.city.toLowerCase().includes(q) ||
    (order.notes ?? '').toLowerCase().includes(q) ||
    order.items.some(item =>
      item.product_name.toLowerCase().includes(q) ||
      (item.color_name ?? '').toLowerCase().includes(q)
    )
  )
}

function countByStatus(orders: WhatsAppBotOrder[], status: OrderStatus): number {
  return orders.filter(order => order.status === status).length
}

const STATUS_SORT_ORDER: Record<OrderStatus, number> = {
  draft: 0,
  complete: 1,
  approved: 2,
  rejected: 3,
}

interface BotOrdersPageProps {
  company: WhatsAppCompany
}

export function BotOrdersPage({ company }: BotOrdersPageProps) {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const [orders, setOrders] = useState<WhatsAppBotOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState<OrderDateFilterState>(DEFAULT_TABLE_DATE_FILTER)
  const [selectedOrder, setSelectedOrder] = useState<WhatsAppBotOrder | null>(null)
  const [pivotOpen, setPivotOpen] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WhatsAppBotOrder | null>(null)
  const exportCsvRef = useRef<(() => void) | null>(null)

  const headerActions = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPivotOpen(true)}
          disabled={loading}
          className="btn-secondary !p-2 sm:!py-1.5 sm:!px-3.5 text-sm"
          aria-label="Item pivot"
          title="Item pivot"
        >
          <PivotIcon className="w-4 h-4" />
          <span className="hidden sm:inline sm:ml-1.5">Item Pivot</span>
        </button>
        <button
          type="button"
          onClick={() => exportCsvRef.current?.()}
          disabled={loading}
          className="btn-secondary !p-2 sm:!py-1.5 sm:!px-3.5 text-sm"
          aria-label="Export CSV"
          title="Export CSV"
        >
          <ExportIcon className="w-4 h-4" />
          <span className="hidden sm:inline sm:ml-1.5">Export CSV</span>
        </button>
      </div>
    ),
    [loading]
  )

  useDashboardHeaderActions(headerActions)

  const handleExportReady = useCallback((exportFn: () => void) => {
    exportCsvRef.current = exportFn
  }, [])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchBotOrders(company)
      setOrders(data)
    } catch (err) {
      toastRef.current.error(err instanceof Error ? err.message : 'Failed to load orders')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [company])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const handleStatusChange = useCallback(
    async (order: WhatsAppBotOrder, status: OrderStatus) => {
      if (order.status === status) return
      setUpdatingId(order.id)
      try {
        const updated = await updateOrderStatus(order.id, status, company)
        setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)))
        setSelectedOrder(prev => (prev?.id === updated.id ? updated : prev))
        toast.success(`Order ${status}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update order')
      } finally {
        setUpdatingId(null)
      }
    },
    [company, toast]
  )

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setUpdatingId(deleteTarget.id)
    try {
      await deleteBotOrder(deleteTarget.id, company)
      setOrders(prev => prev.filter(order => order.id !== deleteTarget.id))
      setSelectedOrder(prev => (prev?.id === deleteTarget.id ? null : prev))
      toast.success('Order deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete order')
    } finally {
      setUpdatingId(null)
      setDeleteTarget(null)
    }
  }, [company, deleteTarget, toast])

  const ordersInDateRange = useMemo(
    () => filterOrdersByDate(orders, dateFilter),
    [orders, dateFilter]
  )

  const stats = useMemo(
    () => ({
      total: ordersInDateRange.filter(o => o.status !== 'draft').length,
      complete: countByStatus(ordersInDateRange, 'complete'),
      approved: countByStatus(ordersInDateRange, 'approved'),
    }),
    [ordersInDateRange]
  )

  const columns: DynamicTableColumn<WhatsAppBotOrder>[] = useMemo(
    () => [
      {
        key: 'no',
        header: 'No',
        width: '4%',
        shrinkCol: true,
        align: 'center',
        sortValue: () => 0,
        render: (_order, index) => (
          <span className="text-ink-500 tabular-nums">{index + 1}</span>
        ),
      },
      {
        key: 'date',
        header: 'Date',
        width: '9%',
        sortValue: order => new Date(order.created_at).getTime(),
        render: order => (
          <span className="text-ink-600 whitespace-nowrap" title={formatOrderDate(order.created_at)}>
            {formatOrderDate(order.created_at)}
          </span>
        ),
      },
      {
        key: 'customer',
        header: 'Name',
        width: '9%',
        truncateCell: true,
        sortValue: order => displayOrderCustomerName(order),
        render: order => (
          <span
            className="font-medium text-ink-900 truncate block"
            title={displayOrderCustomerName(order)}
          >
            {displayOrderCustomerName(order)}
          </span>
        ),
      },
      {
        key: 'address',
        header: 'Address',
        width: '10%',
        truncateCell: true,
        hideBelow: 'lg',
        sortValue: order => displayOrderAddress(order),
        render: order => (
          <span className="text-ink-600 truncate block" title={displayOrderAddress(order)}>
            {displayOrderAddress(order)}
          </span>
        ),
      },
      {
        key: 'city',
        header: 'City',
        width: '8%',
        truncateCell: true,
        sortValue: order => displayOrderCity(order),
        render: order => (
          <span className="text-ink-600 truncate block" title={displayOrderCity(order)}>
            {displayOrderCity(order)}
          </span>
        ),
      },
      {
        key: 'zone',
        header: 'Zone',
        width: '7%',
        truncateCell: true,
        sortValue: order => displayOrderZoneName(order),
        render: order => {
          const zone = displayOrderZoneName(order)
          return (
            <span className="text-ink-600 truncate block" title={zone === '—' ? undefined : zone}>
              {zone}
            </span>
          )
        },
      },
      {
        key: 'phone',
        header: 'Phone Number',
        width: '9%',
        sortValue: order => order.customer_phone_number,
        render: order => (
          <span className="text-ink-600 tabular-nums whitespace-nowrap" title={order.customer_phone_number}>
            {order.customer_phone_number}
          </span>
        ),
      },
      {
        key: 'total',
        header: 'Amount',
        width: '7%',
        align: 'right',
        sortValue: order => Number(order.total),
        render: order => (
          <span className="font-semibold tabular-nums text-ink-900 whitespace-nowrap">
            {formatOrderTotal(Number(order.total))}
          </span>
        ),
      },
      {
        key: 'qty',
        header: 'Qty',
        width: '4%',
        align: 'center',
        shrinkCol: true,
        sortValue: order => formatOrderTotalQty(order),
        render: order => (
          <OrderItemLines
            order={order}
            renderItem={item => (
              <span className="tabular-nums text-ink-900">{item.quantity}</span>
            )}
          />
        ),
      },
      {
        key: 'product',
        header: 'Product',
        width: '11%',
        sortValue: order => formatOrderProductsList(order),
        render: order => (
          <OrderItemLines
            order={order}
            renderItem={item => (
              <span className="text-ink-600 leading-snug">{formatOrderItemLabel(item)}</span>
            )}
          />
        ),
      },
      {
        key: 'notes',
        header: 'Note',
        width: '3%',
        align: 'center',
        shrinkCol: true,
        hideBelow: 'md',
        sortValue: order => order.notes ?? '',
        render: order => {
          const note = order.notes?.trim()
          if (!note) return null
          return (
            <HoverTooltip content={note}>
              <span className="inline-flex items-center justify-center text-ink-500 hover:text-brand-600 cursor-default">
                <NoteIcon className="w-4 h-4" />
              </span>
            </HoverTooltip>
          )
        },
      },
      {
        key: 'status',
        header: 'Status',
        width: '7%',
        sortValue: order => STATUS_SORT_ORDER[order.status],
        render: order => <StatusBadge status={order.status} />,
      },
      {
        key: 'ref',
        header: 'Order Ref',
        width: '9%',
        sortValue: order => order.order_ref,
        render: order => (
          <span className="font-mono font-semibold text-brand-700 whitespace-nowrap" title={order.order_ref}>
            {order.order_ref}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        shrinkCol: true,
        align: 'right',
        headerClassName: 'sr-only',
        sortValue: order => STATUS_SORT_ORDER[order.status],
        render: order => (
          <OrderActionsMenu
            order={order}
            updating={updatingId === order.id}
            onApprove={() => handleStatusChange(order, 'approved')}
            onDelete={() => setDeleteTarget(order)}
          />
        ),
      },
    ],
    [handleStatusChange, updatingId]
  )

  const brandLabel = company === 'sodamax' ? 'SodaMax' : 'Spark'

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full gap-2 lg:gap-3 overflow-hidden">
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete order?"
        description={
          deleteTarget
            ? `${deleteTarget.order_ref} will be permanently removed. This cannot be undone.`
            : 'This order will be permanently removed.'
        }
        confirmLabel="Delete"
        variant="danger"
        loading={deleteTarget !== null && updatingId === deleteTarget.id}
        onCancel={() => !updatingId && setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      <OrderReceiptModal
        order={selectedOrder}
        updating={selectedOrder ? updatingId === selectedOrder.id : false}
        onClose={() => setSelectedOrder(null)}
        onApprove={order => handleStatusChange(order, 'approved')}
        onMarkComplete={order => handleStatusChange(order, 'complete')}
        onDelete={order => {
          setSelectedOrder(null)
          setDeleteTarget(order)
        }}
      />

      <OrderItemPivotModal
        open={pivotOpen}
        orders={orders}
        company={company}
        onClose={() => setPivotOpen(false)}
      />

      <CollapsibleKpiPanel
        title="Order overview"
        subtitle={`${brandLabel} · filtered by date range`}
        items={[
          {
            label: 'Total orders',
            value: loading ? '—' : String(stats.total),
          },
          {
            label: 'Complete orders',
            value: loading ? '—' : String(stats.complete),
            tone: 'warning',
          },
          {
            label: 'Approved orders',
            value: loading ? '—' : String(stats.approved),
            tone: 'success',
          },
        ]}
      />

      <DynamicTable
        data={ordersInDateRange}
        columns={columns}
        rowKey={order => order.id}
        loading={loading}
        fitScreen
        defaultSort={{ key: 'date', direction: 'desc' }}
        searchPlaceholder="Search ref, customer, phone, item…"
        searchFilter={matchesOrderSearch}
        onRowClick={setSelectedOrder}
        filterExtras={<OrderDateFilter value={dateFilter} onChange={setDateFilter} />}
        extrasActive={isOrderDateFilterActive(dateFilter)}
        onClearFilters={() => {
          setDateFilter(DEFAULT_TABLE_DATE_FILTER)
          setStatusFilter('')
        }}
        mobileCardRender={(order) => (
          <button
            type="button"
            onClick={() => setSelectedOrder(order)}
            className="w-full text-left px-2.5 py-2 sm:px-3 sm:py-2.5 table-row-hover"
          >
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <span className="font-mono text-xs sm:text-sm font-semibold text-brand-700 truncate">{order.order_ref}</span>
              <StatusBadge status={order.status} />
            </div>
            <p className="font-medium text-sm text-ink-900 truncate">{displayOrderCustomerName(order)}</p>
            <div className="flex items-center justify-between gap-2 mt-1 text-xs sm:text-sm">
              <span className="text-ink-500 truncate">{formatOrderDate(order.created_at)}</span>
              <span className="font-semibold text-ink-900 tabular-nums shrink-0">
                {formatOrderTotal(Number(order.total))}
              </span>
            </div>
            {order.city && (
              <p className="text-xs text-ink-400 mt-1 truncate">
                {order.city}
                {displayOrderZoneName(order) !== '—' && (
                  <span> · {displayOrderZoneName(order)}</span>
                )}
                {displayOrderZoneName(order) === '—' &&
                  displayOrderCityRegion(order) !== '—' && (
                    <span> · {displayOrderCityRegion(order)}</span>
                  )}
              </p>
            )}
          </button>
        )}
        filters={[
          {
            id: 'status-filter',
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: '', label: 'All statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'complete', label: 'Complete' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ],
            match: (order, value) => order.status === value,
          },
        ]}
        toolbar={
          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            className="btn-secondary shrink-0 !p-1.5 sm:!py-1.5 sm:!px-3"
            aria-label="Refresh orders"
            title="Refresh orders"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline sm:ml-1.5">Refresh</span>
          </button>
        }
        exportConfig={{
          fileName: () => `${company}-orders-${toDateInputValue(new Date())}.csv`,
          columns: ORDER_EXPORT_COLUMNS as CsvColumn<unknown>[],
          getExportRows: expandOrdersForExport,
          scope: 'filtered',
          placement: 'header',
          onExport: count => toast.success(`Exported ${count} row${count === 1 ? '' : 's'} to CSV`),
        }}
        onExportReady={handleExportReady}
        emptyState={
          orders.length === 0 ? (
            <div className="empty-state">
              <p className="text-sm font-semibold text-ink-900">No orders yet</p>
              <p className="text-sm text-ink-500 max-w-xs">
                {brandLabel} orders placed via WhatsApp will appear here.
              </p>
            </div>
          ) : undefined
        }
      />
    </div>
  )
}

function OrderItemLines({
  order,
  renderItem,
}: {
  order: WhatsAppBotOrder
  renderItem: (item: WhatsAppBotOrder['items'][number], index: number) => React.ReactNode
}) {
  if (!order.items.length) {
    return <span className="text-ink-400">—</span>
  }

  if (order.items.length === 1) {
    return <>{renderItem(order.items[0], 0)}</>
  }

  return (
    <div className="flex flex-col">
      {order.items.map((item, index) => (
        <div
          key={item.id ?? `${item.product_name}-${index}`}
          className={index > 0 ? 'border-t border-ink-100 pt-1.5 mt-1.5' : undefined}
        >
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    draft: 'badge-neutral',
    complete: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
  }
  const labels: Record<OrderStatus, string> = ORDER_STATUS_LABELS
  return <span className={styles[status]}>{labels[status]}</span>
}

function ExportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )
}

function PivotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 10h16M4 14h16M4 18h16"
      />
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

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
      />
    </svg>
  )
}
