import {
  displayOrderCityMapping,
  displayOrderCityRegion,
  displayOrderCustomerName,
  formatOrderDate,
  formatOrderItemLabel,
  formatOrderTotal,
  type OrderStatus,
  type WhatsAppBotOrder,
} from '@/lib/whatsapp-bot-orders'
import type { CsvColumn } from '@/lib/export-csv'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

export interface OrderExportLineRow {
  orderRef: string
  date: string
  status: string
  customer: string
  mappedCity: string
  region: string
  phone: string
  amount: string
  items: number
  productName: string
  qty: number
}

export interface ItemPivotRow {
  productName: string
  totalQty: number
  orderCount: number
}

export function expandOrdersForExport(orders: WhatsAppBotOrder[]): OrderExportLineRow[] {
  const rows: OrderExportLineRow[] = []

  for (const order of orders) {
    const base = {
      orderRef: order.order_ref,
      date: formatOrderDate(order.created_at),
      status: ORDER_STATUS_LABELS[order.status],
      customer: displayOrderCustomerName(order),
      mappedCity: displayOrderCityMapping(order),
      region: displayOrderCityRegion(order),
      phone: order.customer_phone_number,
      amount: formatOrderTotal(Number(order.total)),
      items: order.items.length,
    }

    if (order.items.length === 0) {
      rows.push({ ...base, productName: '', qty: 0 })
      continue
    }

    for (const item of order.items) {
      rows.push({
        ...base,
        productName: item.product_name?.trim() || 'Product',
        qty: item.quantity,
      })
    }
  }

  return rows
}

export const ORDER_EXPORT_COLUMNS: CsvColumn<OrderExportLineRow>[] = [
  { header: 'Order Ref', value: row => row.orderRef },
  { header: 'Date', value: row => row.date },
  { header: 'Status', value: row => row.status },
  { header: 'Customer', value: row => row.customer },
  { header: 'Mapped City', value: row => row.mappedCity },
  { header: 'Region', value: row => row.region },
  { header: 'Phone Number', value: row => row.phone },
  { header: 'Amount', value: row => row.amount },
  { header: 'Items', value: row => row.items },
  { header: 'Product Name', value: row => row.productName },
  { header: 'Qty', value: row => row.qty },
]

export function buildItemPivot(orders: WhatsAppBotOrder[]): ItemPivotRow[] {
  const map = new Map<string, { totalQty: number; orderIds: Set<string> }>()

  for (const order of orders) {
    for (const item of order.items) {
      const key = formatOrderItemLabel(item)
      const entry = map.get(key) ?? { totalQty: 0, orderIds: new Set<string>() }
      entry.totalQty += item.quantity
      entry.orderIds.add(order.id)
      map.set(key, entry)
    }
  }

  return Array.from(map.entries())
    .map(([productName, { totalQty, orderIds }]) => ({
      productName,
      totalQty,
      orderCount: orderIds.size,
    }))
    .sort((a, b) => b.totalQty - a.totalQty || a.productName.localeCompare(b.productName))
}

export const ITEM_PIVOT_EXPORT_COLUMNS: CsvColumn<ItemPivotRow>[] = [
  { header: 'Product Name', value: row => row.productName },
  { header: 'Total Qty', value: row => row.totalQty },
  { header: 'Orders', value: row => row.orderCount },
]
