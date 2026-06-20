import Link from 'next/link'

interface SiteFooterProps {
  variant?: 'default' | 'dashboard'
  className?: string
}

export function SiteFooter({ variant = 'default', className = '' }: SiteFooterProps) {
  const year = new Date().getFullYear()

  const baseClass =
    variant === 'dashboard'
      ? 'shrink-0 px-4 sm:px-5 py-3 border-t border-ink-200/80 bg-white text-xs text-ink-500'
      : 'px-6 sm:px-10 py-6 border-t border-ink-100 bg-ink-50/80 text-xs text-ink-500'

  return (
    <footer
      className={`${baseClass} flex flex-wrap items-center justify-between gap-3 ${className}`.trim()}
    >
      <span>© {year} Spark Distributors</span>
      <div className="flex items-center gap-4">
        <Link href="/privacy" className="text-brand-600 hover:underline font-medium">
          Privacy
        </Link>
        <Link href="/data-deletion" className="text-brand-600 hover:underline font-medium">
          Data deletion
        </Link>
      </div>
    </footer>
  )
}
