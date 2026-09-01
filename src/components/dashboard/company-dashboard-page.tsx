'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/components/ui/toast'
import { StatCard } from '@/components/ui/stat-card'
import { fetchBotOrders, formatOrderTotal } from '@/lib/whatsapp-bot-orders'
import { buildMonthlyRevenue } from '@/lib/monthly-revenue'
import type { WhatsAppCompany } from '@/lib/whatsapp-company'

interface CompanyDashboardPageProps {
  company: WhatsAppCompany
}

function formatCompactAmount(amount: number): string {
  if (amount <= 0) return ''
  if (amount >= 1_000_000) {
    return `Rs ${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  }
  if (amount >= 1_000) {
    const value = amount >= 10_000 ? Math.round(amount / 1_000) : Number((amount / 1_000).toFixed(1))
    return `Rs ${value}k`
  }
  return formatOrderTotal(amount)
}

export function CompanyDashboardPage({ company }: CompanyDashboardPageProps) {
  const toast = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast

  const year = new Date().getFullYear()
  const currentMonth = new Date().getMonth()

  const [months, setMonths] = useState(() => buildMonthlyRevenue([], year))
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const orders = await fetchBotOrders(company)
      const approved = orders.filter(order => order.status === 'approved')
      setMonths(buildMonthlyRevenue(approved, year))
    } catch (err) {
      toastRef.current.error(err instanceof Error ? err.message : 'Failed to load dashboard')
      setMonths(buildMonthlyRevenue([], year))
    } finally {
      setLoading(false)
    }
  }, [company, year])

  useEffect(() => {
    load()
  }, [load])

  const yearTotal = useMemo(() => months.reduce((sum, row) => sum + row.amount, 0), [months])
  const yearOrders = useMemo(() => months.reduce((sum, row) => sum + row.orderCount, 0), [months])
  const thisMonth = months[currentMonth]
  const maxAmount = useMemo(() => Math.max(...months.map(row => row.amount), 0), [months])

  const barClass = company === 'sodamax' ? 'bg-soda-500 hover:bg-soda-600' : 'bg-brand-500 hover:bg-brand-600'
  const currentBarClass = company === 'sodamax' ? 'bg-soda-600' : 'bg-brand-600'

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full gap-2 lg:gap-3 overflow-hidden">
      <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-2.5 shrink-0">
        <StatCard label={`${year} revenue`} value={loading ? '—' : formatOrderTotal(yearTotal)} tone="brand" />
        <StatCard
          label="This month"
          value={loading ? '—' : formatOrderTotal(thisMonth?.amount ?? 0)}
          hint={thisMonth?.label}
        />
        <StatCard
          label="Approved orders"
          value={loading ? '—' : String(yearOrders)}
          hint={String(year)}
          tone="success"
        />
      </div>

      <div className="panel flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="panel-header flex items-center justify-between gap-3">
          <span>Revenue per month</span>
          <span className="normal-case tracking-normal font-medium text-ink-400">{year}</span>
        </div>

        <div className="flex-1 min-h-0 p-4 sm:p-5 lg:p-6 flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-end gap-1.5 sm:gap-2.5">
              {months.map(row => (
                <div key={row.month} className="flex-1 h-3/5 rounded-t-md bg-ink-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex-1 min-h-[16rem] flex items-end gap-1 sm:gap-2">
              {months.map(row => {
                const pct = maxAmount > 0 ? (row.amount / maxAmount) * 100 : 0
                const isCurrent = row.month === currentMonth
                return (
                  <div key={row.month} className="flex-1 h-full min-w-0 flex flex-col items-center justify-end gap-1.5">
                    <span className="text-[10px] sm:text-xs font-medium tabular-nums text-ink-600 h-4 truncate max-w-full">
                      {formatCompactAmount(row.amount)}
                    </span>
                    <div
                      title={`${row.label} ${year}: ${formatOrderTotal(row.amount)} · ${row.orderCount} order${row.orderCount === 1 ? '' : 's'}`}
                      className={`w-full max-w-[3.25rem] rounded-t-md transition-colors ${
                        row.amount > 0 ? (isCurrent ? currentBarClass : barClass) : 'bg-ink-100'
                      }`}
                      style={{ height: `${Math.max(pct, row.amount > 0 ? 4 : 2)}%` }}
                    />
                    <span
                      className={`text-[10px] sm:text-xs font-medium ${
                        isCurrent ? 'text-ink-900' : 'text-ink-500'
                      }`}
                    >
                      {row.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
