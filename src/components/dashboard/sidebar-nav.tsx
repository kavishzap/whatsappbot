'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { NAV_SECTIONS, findSectionForPath, type NavItem } from './nav-config'

const ACCENT_STYLES = {
  spark: {
    dot: 'bg-brand-400',
    ring: 'ring-brand-400/30',
    active: 'bg-brand-500/15 text-white ring-1 ring-brand-400/25',
    icon: 'text-brand-300',
  },
  soda: {
    dot: 'bg-soda-400',
    ring: 'ring-soda-400/30',
    active: 'bg-soda-500/15 text-white ring-1 ring-soda-400/25',
    icon: 'text-soda-300',
  },
  admin: {
    dot: 'bg-violet-400',
    ring: 'ring-violet-400/30',
    active: 'bg-violet-500/15 text-white ring-1 ring-violet-400/25',
    icon: 'text-violet-300',
  },
} as const

function SidebarTooltip({
  label,
  show,
  children,
}: {
  label: string
  show: boolean
  children: React.ReactNode
}) {
  if (!show) return <>{children}</>

  return (
    <div className="relative group/tooltip flex justify-center">
      {children}
      <div className="absolute left-[calc(100%+0.625rem)] top-1/2 -translate-y-1/2 z-[100] px-2.5 py-1.5 rounded-lg bg-ink-900 text-white text-xs font-medium whitespace-nowrap shadow-lg opacity-0 invisible translate-x-1 group-hover/tooltip:opacity-100 group-hover/tooltip:visible group-hover/tooltip:translate-x-0 transition-all duration-150 pointer-events-none">
        {label}
        <span className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-ink-900" />
      </div>
    </div>
  )
}

function NavLink({
  item,
  active,
  collapsed,
  accent,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  accent: keyof typeof ACCENT_STYLES
  onNavigate?: () => void
}) {
  const styles = ACCENT_STYLES[accent]
  const Icon = item.icon

  return (
    <SidebarTooltip label={item.label} show={collapsed}>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-label={collapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-all ${
          collapsed ? 'w-10 h-10 mx-auto justify-center' : 'px-3 py-2 ml-1'
        } ${
          active
            ? collapsed
              ? `bg-brand-500 text-white shadow-glow`
              : styles.active
            : collapsed
              ? 'text-slate-400 hover:bg-white/5 hover:text-white'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`}
      >
        <Icon className={`w-[17px] h-[17px] shrink-0 ${active && !collapsed ? styles.icon : ''}`} />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    </SidebarTooltip>
  )
}

function AccordionSection({
  id,
  label,
  accent,
  items,
  pathname,
  collapsed,
  open,
  onToggle,
  onNavigate,
}: {
  id: string
  label: string
  accent: keyof typeof ACCENT_STYLES
  items: NavItem[]
  pathname: string
  collapsed: boolean
  open: boolean
  onToggle: () => void
  onNavigate?: () => void
}) {
  const styles = ACCENT_STYLES[accent]
  const hasActive = items.some(item => item.href === pathname)

  if (collapsed) {
    return (
      <div className="space-y-1">
        {items.map(item => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href}
            collapsed
            accent={accent}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`nav-section-${id}`}
        className={`flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-white/5 ${
          hasActive ? 'text-slate-100' : 'text-slate-400'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />
        <span className="flex-1 text-xs font-bold uppercase tracking-[0.12em]">{label}</span>
        <svg
          className={`w-4 h-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        id={`nav-section-${id}`}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-0.5 pb-1 pt-0.5 pl-2 border-l border-white/5 ml-4">
            {items.map(item => (
              <NavLink
                key={item.href}
                item={item}
                active={pathname === item.href}
                collapsed={false}
                accent={accent}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SidebarNav({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string
  collapsed: boolean
  onNavigate?: () => void
}) {
  const activeSection = findSectionForPath(pathname)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    spark: true,
    sodamax: true,
    admin: true,
  })

  useEffect(() => {
    if (!activeSection) return
    setOpenSections(prev => ({ ...prev, [activeSection]: true }))
  }, [activeSection])

  const toggle = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <nav className={`flex-1 px-2 py-4 space-y-2 ${collapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
      {NAV_SECTIONS.map(section => (
        <AccordionSection
          key={section.id}
          id={section.id}
          label={section.label}
          accent={section.accent}
          items={section.items}
          pathname={pathname}
          collapsed={collapsed}
          open={openSections[section.id] ?? false}
          onToggle={() => toggle(section.id)}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  )
}
