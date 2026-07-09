'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SearchableSelectOption {
  value: string
  label: string
  description?: string
  keywords?: string
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  onOptionSelect?: (option: SearchableSelectOption | null) => void
  placeholder?: string
  searchPlaceholder?: string
  loading?: boolean
  disabled?: boolean
  allowCustom?: boolean
  customValue?: string
  onCustomChange?: (value: string) => void
  className?: string
}

interface PanelPosition {
  top?: number
  bottom?: number
  left: number
  width: number
  maxHeight: number
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

export function SearchableSelect({
  options,
  value,
  onChange,
  onOptionSelect,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  loading = false,
  disabled = false,
  allowCustom = false,
  customValue = '',
  onCustomChange,
  className = '',
}: SearchableSelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null)

  const selected = useMemo(
    () => options.find(option => option.value === value) ?? null,
    [options, value]
  )

  const displayLabel = selected?.label ?? (allowCustom && customValue.trim() ? customValue : '')

  const filtered = useMemo(() => {
    const q = normalizeSearch(query)
    if (!q) return options
    return options.filter(option => {
      const haystack = normalizeSearch(
        [option.label, option.description, option.keywords].filter(Boolean).join(' ')
      )
      return haystack.includes(q)
    })
  }, [options, query])

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const gap = 4
    const viewportPadding = 8
    const preferredMaxHeight = 280
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
    const spaceAbove = rect.top - viewportPadding
    const openBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove
    const maxHeight = Math.min(
      preferredMaxHeight,
      Math.max(120, (openBelow ? spaceBelow : spaceAbove) - gap)
    )

    setPanelPosition(
      openBelow
        ? {
            top: rect.bottom + gap,
            left: rect.left,
            width: rect.width,
            maxHeight,
          }
        : {
            bottom: window.innerHeight - rect.top + gap,
            left: rect.left,
            width: rect.width,
            maxHeight,
          }
    )
  }, [])

  useEffect(() => {
    if (!open) return

    updatePanelPosition()

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }

    const handleReposition = () => updatePanelPosition()

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open, updatePanelPosition])

  useEffect(() => {
    if (open) {
      setQuery('')
      updatePanelPosition()
      requestAnimationFrame(() => searchRef.current?.focus())
    } else {
      setPanelPosition(null)
    }
  }, [open, updatePanelPosition])

  const pickOption = (option: SearchableSelectOption) => {
    onChange(option.value)
    onOptionSelect?.(option)
    setOpen(false)
  }

  const applyCustomQuery = () => {
    const next = query.trim()
    if (!allowCustom || !next) return
    onChange('')
    onCustomChange?.(next)
    onOptionSelect?.(null)
    setOpen(false)
  }

  const dropdown =
    open && panelPosition ? (
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: panelPosition.top,
          bottom: panelPosition.bottom,
          left: panelPosition.left,
          width: panelPosition.width,
          maxHeight: panelPosition.maxHeight,
          zIndex: 200,
        }}
        className="rounded-xl border border-ink-200 bg-white shadow-lg overflow-hidden flex flex-col"
      >
        <div className="p-2 border-b border-ink-100 shrink-0">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (filtered[0]) pickOption(filtered[0])
                else applyCustomQuery()
              }
              if (event.key === 'Escape') setOpen(false)
            }}
            placeholder={searchPlaceholder}
            className="input-field text-sm py-2"
          />
        </div>

        <ul id={listId} role="listbox" className="overflow-y-auto py-1 min-h-0 flex-1">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-400">No matches</li>
          ) : (
            filtered.map(option => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => pickOption(option)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-ink-50 ${
                    option.value === value ? 'bg-brand-50 text-brand-800' : 'text-ink-800'
                  }`}
                >
                  <span className="block truncate font-medium">{option.label}</span>
                  {option.description && (
                    <span className="block truncate text-xs text-ink-500 mt-0.5">
                      {option.description}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>

        {allowCustom && query.trim() && filtered.length === 0 && (
          <div className="border-t border-ink-100 p-2 shrink-0">
            <button
              type="button"
              onClick={applyCustomQuery}
              className="w-full text-left px-2 py-1.5 text-sm text-brand-700 hover:bg-brand-50 rounded-lg"
            >
              Use “{query.trim()}” as custom product
            </button>
          </div>
        )}
      </div>
    ) : null

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(prev => !prev)}
        className="input-field w-full text-left flex items-center justify-between gap-2 disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
      >
        <span className={displayLabel ? 'text-ink-800 truncate' : 'text-ink-400 truncate'}>
          {loading ? 'Loading…' : displayLabel || placeholder}
        </span>
        <svg
          className={`w-4 h-4 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {typeof document !== 'undefined' && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </div>
  )
}
