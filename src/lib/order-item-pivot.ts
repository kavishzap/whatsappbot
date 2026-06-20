import {
  displayOrderAddress,
  displayOrderCity,
  displayOrderCustomerName,
  displayOrderZoneName,
  formatOrderDate,
  formatOrderItemLabel,
  formatOrderProductsList,
  formatOrderQtyList,
  formatOrderTotal,
  type OrderStatus,
  type WhatsAppBotOrder,
} from '@/lib/whatsapp-bot-orders'
import type { CsvColumn } from '@/lib/export-csv'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  complete: 'Complete',
  approved: 'Approved',
  rejected: 'Rejected',
}

export interface OrderExportLineRow {
  rowNo: number
  date: string
  name: string
  address: string
  city: string
  zone: string
  phone: string
  amount: string
  qty: string
  product: string
  note: string
  status: string
  orderRef: string
}

export interface ItemPivotRow {
  productName: string
  totalQty: number
  totalAmount: number
  orderCount: number
}

function lineItemAmount(item: WhatsAppBotOrder['items'][number]): number {
  if (item.line_total != null && Number.isFinite(Number(item.line_total))) {
    return Number(item.line_total)
  }
  return Number(item.quantity) * Number(item.unit_price)
}

export function expandOrdersForExport(orders: WhatsAppBotOrder[]): OrderExportLineRow[] {
  return orders.map((order, index) => ({
    rowNo: index + 1,
    date: formatOrderDate(order.created_at),
    name: displayOrderCustomerName(order),
    address: displayOrderAddress(order),
    city: displayOrderCity(order),
    zone: displayOrderZoneName(order),
    phone: order.customer_phone_number,
    amount: formatOrderTotal(Number(order.total)),
    qty: formatOrderQtyList(order),
    product: formatOrderProductsList(order),
    note: order.notes?.trim() || '—',
    status: ORDER_STATUS_LABELS[order.status],
    orderRef: order.order_ref,
  }))
}

export const ORDER_EXPORT_COLUMNS: CsvColumn<OrderExportLineRow>[] = [
  { header: 'No', value: row => row.rowNo },
  { header: 'Date', value: row => row.date },
  { header: 'Name', value: row => row.name },
  { header: 'Address', value: row => row.address },
  { header: 'City', value: row => row.city },
  { header: 'Zone', value: row => row.zone },
  { header: 'Phone Number', value: row => row.phone },
  { header: 'Amount', value: row => row.amount },
  { header: 'Qty', value: row => row.qty },
  { header: 'Product', value: row => row.product },
  { header: 'Note', value: row => row.note },
  { header: 'Status', value: row => row.status },
  { header: 'Order Ref', value: row => row.orderRef },
]

export function buildItemPivot(orders: WhatsAppBotOrder[]): ItemPivotRow[] {
  const map = new Map<string, { totalQty: number; totalAmount: number; orderIds: Set<string> }>()

  for (const order of orders) {
    for (const item of order.items) {
      const key = formatOrderItemLabel(item)
      const entry = map.get(key) ?? { totalQty: 0, totalAmount: 0, orderIds: new Set<string>() }
      entry.totalQty += item.quantity
      entry.totalAmount += lineItemAmount(item)
      entry.orderIds.add(order.id)
      map.set(key, entry)
    }
  }

  return Array.from(map.entries())
    .map(([productName, { totalQty, totalAmount, orderIds }]) => ({
      productName,
      totalQty,
      totalAmount,
      orderCount: orderIds.size,
    }))
    .sort(
      (a, b) =>
        b.totalQty - a.totalQty ||
        b.totalAmount - a.totalAmount ||
        a.productName.localeCompare(b.productName)
    )
}

export const ITEM_PIVOT_EXPORT_COLUMNS: CsvColumn<ItemPivotRow>[] = [
  { header: 'Product Name', value: row => row.productName },
  { header: 'Total Qty', value: row => row.totalQty },
  { header: 'Total Amount', value: row => formatOrderTotal(row.totalAmount) },
  { header: 'Orders', value: row => row.orderCount },
]
