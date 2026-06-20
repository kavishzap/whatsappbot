'use client'

import { useState, type ReactNode } from 'react'
import { StatCard } from './stat-card'

export interface KpiItem {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger'
}

interface CollapsibleKpiPanelProps {
  title: string
  subtitle?: string
  items: KpiItem[]
  /** Extra content below the stat grid (e.g. company badge). */
  footer?: ReactNode
}

export function CollapsibleKpiPanel({ title, subtitle, items, footer }: CollapsibleKpiPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="panel shrink-0 overflow-hidden">
      <div className="lg:hidden px-3 py-2">
        <p className="text-sm font-semibold text-ink-900">{title}</p>
      </div>

      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="hidden lg:flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-50/80 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink-900">{title}</p>
          {subtitle && <p className="text-xs text-ink-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border border-ink-200 bg-white text-ink-500 shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          <ChevronDownIcon className="w-4 h-4" />
        </span>
      </button>

      {open && (
        <div className="hidden lg:block px-4 pb-4 border-t border-ink-100">
          <div className="stat-grid pt-3">
            {items.map(item => (
              <StatCard
                key={item.label}
                label={item.label}
                value={item.value}
                hint={item.hint}
                tone={item.tone}
              />
            ))}
          </div>
          {footer ? <div className="mt-3">{footer}</div> : null}
        </div>
      )}
    </div>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}
