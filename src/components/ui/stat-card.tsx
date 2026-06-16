interface StatCardProps {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger'
}

const toneClasses: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-ink-900',
  brand: 'text-brand-600',
  success: 'text-brand-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
}

export function StatCard({ label, value, hint, tone = 'default' }: StatCardProps) {
  return (
    <div className="stat-card">
      <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold tracking-tight mt-0.5 ${toneClasses[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-ink-400 mt-0.5">{hint}</p>}
    </div>
  )
}
