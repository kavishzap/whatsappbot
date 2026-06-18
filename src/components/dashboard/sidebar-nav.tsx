'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { NAV_SECTIONS, findSectionForPath, type NavItem } from './nav-config'

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
  onNavigate,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon

  return (
    <SidebarTooltip label={item.label} show={collapsed}>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-label={collapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${
          collapsed ? 'w-9 h-9 mx-auto justify-center' : 'px-3 py-2 min-h-9'
        } ${
          active
            ? 'bg-white/10 text-white'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`}
      >
        <Icon className="w-[18px] h-[18px] shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    </SidebarTooltip>
  )
}

function AccordionSection({
  id,
  label,
  items,
  pathname,
  collapsed,
  open,
  onToggle,
  onNavigate,
}: {
  id: string
  label: string
  items: NavItem[]
  pathname: string
  collapsed: boolean
  open: boolean
  onToggle: () => void
  onNavigate?: () => void
}) {
  const hasActive = items.some(item => item.href === pathname)

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {items.map(item => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname === item.href}
            collapsed
            onNavigate={onNavigate}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`nav-section-${id}`}
        className={`flex w-full items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors hover:bg-white/5 ${
          hasActive ? 'text-slate-200' : 'text-slate-500'
        }`}
      >
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.14em]">{label}</span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
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
          <div className="space-y-0.5 py-1">
            {items.map(item => (
              <NavLink
                key={item.href}
                item={item}
                active={pathname === item.href}
                collapsed={false}
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
    <nav className={`flex-1 px-2 py-3 space-y-3 ${collapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
      {NAV_SECTIONS.map(section => (
        <AccordionSection
          key={section.id}
          id={section.id}
          label={section.label}
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
