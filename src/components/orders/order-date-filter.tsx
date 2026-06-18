'use client'

import {
  type OrderDateFilterState,
  type OrderDatePreset,
  withPresetDates,
} from '@/lib/order-date-filter'

interface OrderDateFilterProps {
  value: OrderDateFilterState
  onChange: (value: OrderDateFilterState) => void
}

const PRESET_OPTIONS: { value: OrderDatePreset; label: string }[] = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
]

const selectClassName = 'select-field min-w-[9.5rem]'

const dateInputClassName =
  'h-10 rounded-lg border border-ink-200 bg-white px-2.5 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-brand-500'

export function OrderDateFilter({ value, onChange }: OrderDateFilterProps) {
  const handlePresetChange = (preset: OrderDatePreset) => {
    onChange(withPresetDates(value, preset))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <label htmlFor="order-date-preset" className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide sr-only">
          Date range
        </label>
        <select
          id="order-date-preset"
          value={value.preset}
          onChange={e => handlePresetChange(e.target.value as OrderDatePreset)}
          className={selectClassName}
        >
          {PRESET_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {value.preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-1.5">
          <label htmlFor="order-date-from" className="sr-only">
            From date
          </label>
          <input
            id="order-date-from"
            type="date"
            value={value.customFrom}
            onChange={e => onChange({ ...value, customFrom: e.target.value })}
            className={dateInputClassName}
          />
          <span className="text-sm text-ink-400">to</span>
          <label htmlFor="order-date-to" className="sr-only">
            To date
          </label>
          <input
            id="order-date-to"
            type="date"
            value={value.customTo}
            min={value.customFrom || undefined}
            onChange={e => onChange({ ...value, customTo: e.target.value })}
            className={dateInputClassName}
          />
        </div>
      )}
    </div>
  )
}
