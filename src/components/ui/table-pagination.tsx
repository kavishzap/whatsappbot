'use client'

import { useEffect, useState } from 'react'

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100, 200, 500] as const
export const MAX_CUSTOM_PAGE_SIZE = 5000

function isPresetPageSize(size: number): boolean {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(size)
}

function parsePageSize(raw: string): number | null {
  const n = parseInt(raw.trim(), 10)
  if (!Number.isFinite(n) || n < 1) return null
  return Math.min(n, MAX_CUSTOM_PAGE_SIZE)
}

interface TablePaginationProps {
  page: number
  totalPages: number
  rangeStart: number
  rangeEnd: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function TablePagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const isCustomSize = !isPresetPageSize(pageSize)
  const [customMode, setCustomMode] = useState(isCustomSize)
  const [customDraft, setCustomDraft] = useState(String(pageSize))
  const [customError, setCustomError] = useState(false)

  useEffect(() => {
    setCustomMode(isCustomSize)
    if (isCustomSize) {
      setCustomDraft(String(pageSize))
    }
  }, [pageSize, isCustomSize])

  const selectValue = customMode || isCustomSize ? 'custom' : String(pageSize)

  const handleSelectChange = (value: string) => {
    setCustomError(false)
    if (value === 'custom') {
      setCustomMode(true)
      setCustomDraft(String(pageSize))
      return
    }
    setCustomMode(false)
    onPageSizeChange(Number(value))
  }

  const applyCustomPageSize = () => {
    const parsed = parsePageSize(customDraft)
    if (parsed == null) {
      setCustomError(true)
      return
    }
    setCustomError(false)
    onPageSizeChange(parsed)
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 py-2.5 border-t border-ink-100 bg-ink-50/50 shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
        <p className="text-sm text-ink-500">
          Showing <span className="font-semibold text-ink-700">{rangeStart}–{rangeEnd}</span> of{' '}
          <span className="font-semibold text-ink-700">{totalItems}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="rows-per-page" className="text-sm text-ink-500 whitespace-nowrap">
            Rows
          </label>
          <select
            id="rows-per-page"
            value={selectValue}
            onChange={e => handleSelectChange(e.target.value)}
            className="select-field w-[4.5rem] !pr-8"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
          {(customMode || isCustomSize) && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={MAX_CUSTOM_PAGE_SIZE}
                value={customDraft}
                onChange={e => {
                  setCustomDraft(e.target.value)
                  setCustomError(false)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyCustomPageSize()
                  }
                }}
                onBlur={applyCustomPageSize}
                placeholder="e.g. 1000"
                aria-label="Custom rows per page"
                aria-invalid={customError}
                className={`h-10 sm:h-8 w-24 sm:w-20 rounded-lg border bg-white px-2.5 text-sm text-ink-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${
                  customError ? 'border-red-300 focus:border-red-400' : 'border-ink-200 focus:border-brand-500'
                }`}
              />
              <button
                type="button"
                onClick={applyCustomPageSize}
                className="btn-secondary !py-2 !px-2.5 !text-xs sm:!text-sm whitespace-nowrap"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn-secondary flex-1 sm:flex-none !py-2.5 sm:!py-2 !px-3.5 text-sm disabled:opacity-40 min-h-[44px] sm:min-h-0"
        >
          Previous
        </button>
        <span className="px-2 text-sm font-medium text-ink-500 tabular-nums min-w-[4.5rem] text-center shrink-0">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-secondary flex-1 sm:flex-none !py-2.5 sm:!py-2 !px-3.5 text-sm disabled:opacity-40 min-h-[44px] sm:min-h-0"
        >
          Next
        </button>
      </div>
    </div>
  )
}
