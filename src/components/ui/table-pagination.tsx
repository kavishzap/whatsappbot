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
    <div className="border-t border-ink-100 bg-ink-50/50 shrink-0 px-2 py-1.5 sm:px-3 sm:py-2.5">
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        <p className="text-xs sm:text-sm text-ink-500 whitespace-nowrap shrink-0">
          <span className="sm:hidden">
            <span className="font-semibold text-ink-700">{rangeStart}–{rangeEnd}</span>/{totalItems}
          </span>
          <span className="hidden sm:inline">
            Showing <span className="font-semibold text-ink-700">{rangeStart}–{rangeEnd}</span> of{' '}
            <span className="font-semibold text-ink-700">{totalItems}</span>
          </span>
        </p>

        <div className="flex items-center gap-1 shrink-0">
          <label htmlFor="rows-per-page" className="sr-only sm:not-sr-only sm:text-sm sm:text-ink-500 sm:whitespace-nowrap">
            Rows
          </label>
          <select
            id="rows-per-page"
            value={selectValue}
            onChange={e => handleSelectChange(e.target.value)}
            className="select-field w-[3.25rem] sm:w-[4.5rem] !pr-6 sm:!pr-8 h-8 text-xs sm:text-sm"
            aria-label="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
            <option value="custom">Custom</option>
          </select>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="btn-secondary !py-1.5 !px-2 sm:!px-3.5 text-xs sm:text-sm disabled:opacity-40 h-8 whitespace-nowrap"
          >
            <span className="sm:hidden">Prev</span>
            <span className="hidden sm:inline">Previous</span>
          </button>
          <span className="px-0.5 sm:px-2 text-xs sm:text-sm font-medium text-ink-500 tabular-nums min-w-[2.5rem] sm:min-w-[4.5rem] text-center shrink-0">
            {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="btn-secondary !py-1.5 !px-2 sm:!px-3.5 text-xs sm:text-sm disabled:opacity-40 h-8 whitespace-nowrap"
          >
            Next
          </button>
        </div>
      </div>

      {(customMode || isCustomSize) && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
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
            className={`h-8 w-24 sm:w-20 rounded-lg border bg-white px-2.5 text-sm text-ink-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${
              customError ? 'border-red-300 focus:border-red-400' : 'border-ink-200 focus:border-brand-500'
            }`}
          />
          <button
            type="button"
            onClick={applyCustomPageSize}
            className="btn-secondary !py-1.5 !px-2.5 !text-xs sm:!text-sm whitespace-nowrap h-8"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  )
}
