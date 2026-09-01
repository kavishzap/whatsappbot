import type { WhatsAppBotOrder } from '@/lib/whatsapp-bot-orders'

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

export interface MonthlyRevenueRow {
  month: number
  label: string
  amount: number
  orderCount: number
}

export function buildMonthlyRevenue(orders: WhatsAppBotOrder[], year: number): MonthlyRevenueRow[] {
  const rows: MonthlyRevenueRow[] = MONTH_LABELS.map((label, month) => ({
    month,
    label,
    amount: 0,
    orderCount: 0,
  }))

  for (const order of orders) {
    const date = new Date(order.created_at)
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) continue
    const row = rows[date.getMonth()]
    row.amount += Number(order.total) || 0
    row.orderCount += 1
  }

  return rows
}
