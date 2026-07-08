'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function ToastIcon({ type }: { type: ToastType }) {
  if (type === 'success') {
    return (
      <svg className="w-5 h-5 text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (type === 'error') {
    return (
      <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  return (
    <svg className="w-5 h-5 text-sky-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => dismiss(id), 4500)
  }, [dismiss])

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message: string) => toast(message, 'success'),
      error: (message: string) => toast(message, 'error'),
      info: (message: string) => toast(message, 'info'),
    }),
    [toast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] left-4 sm:left-auto z-[250] flex flex-col gap-2 w-auto sm:w-full sm:max-w-sm pointer-events-none"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            role="alert"
            className="pointer-events-auto flex items-start gap-3 bg-white border border-ink-200/80 rounded-2xl shadow-panel px-4 py-3.5 animate-slide-in"
          >
            <ToastIcon type={t.type} />
            <p className="text-sm text-ink-700 flex-1 leading-snug pt-0.5">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-ink-400 hover:text-ink-600 shrink-0 inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
