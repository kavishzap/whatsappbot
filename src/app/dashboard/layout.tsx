'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/auth'
import { ToastProvider } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { PAGE_META } from '@/components/dashboard/nav-config'
import { DashboardHeaderProvider } from '@/components/dashboard/dashboard-header-context'
import { DashboardTopBar } from '@/components/dashboard/dashboard-top-bar'
import { SiteFooter } from '@/components/ui/site-footer'

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
  }
  return (email?.[0] ?? 'U').toUpperCase()
}

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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const pageMeta = PAGE_META[pathname] ?? PAGE_META['/dashboard/whatsapp-bot']
  const sidebarCollapsed = collapsed && isLargeScreen

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsLargeScreen(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setProfile({
        id: user.id,
        email: user.email ?? null,
        full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
        phone: null,
        avatar_url: null,
        system_role: 'admin',
        is_active: true,
      })
    })
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } finally {
      window.location.href = '/auth/logout'
    }
  }

  const displayName = profile?.full_name ?? profile?.email?.split('@')[0] ?? 'User'
  const displayEmail = profile?.email ?? ''
  const initials = getInitials(profile?.full_name ?? null, profile?.email ?? null)

  return (
    <ToastProvider>
      <DashboardHeaderProvider>
        <div className="flex h-[100dvh] overflow-hidden bg-[var(--canvas)]">
          <ConfirmDialog
            open={showLogoutModal}
            title="Sign out?"
            description="You'll need to sign in again to access the dashboard."
            confirmLabel="Sign out"
            variant="danger"
            loading={loggingOut}
            onCancel={() => setShowLogoutModal(false)}
            onConfirm={handleLogout}
          />

          {mobileOpen && (
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-ink-950/60 backdrop-blur-sm z-40 lg:hidden"
            />
          )}

          <aside
            className={`bg-sidebar-gradient border-r border-white/5 flex flex-col shrink-0 transition-all duration-300 z-50 overflow-visible
              fixed lg:relative inset-y-0 left-0 text-slate-300 w-[17.5rem]
              ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
              ${sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[17.5rem]'}
            `}
          >
            <div
              className={`h-14 px-3 border-b border-white/10 flex items-center gap-2 shrink-0 ${
                sidebarCollapsed ? 'lg:justify-center' : 'justify-between'
              }`}
            >
              {!sidebarCollapsed && (
                <Link href="/dashboard/whatsapp-bot" className="px-1.5 min-w-0 flex items-center h-full">
                  <Image
                    src="/_C9BFF9E0-617F-45DD-91B5-57549414608C_-removebg-preview.png"
                    alt="Spark Distributors"
                    width={80}
                    height={32}
                    className="object-contain brightness-0 invert opacity-90 h-7 w-auto"
                  />
                </Link>
              )}
              <SidebarTooltip label={sidebarCollapsed ? 'Expand' : 'Collapse'} show={sidebarCollapsed}>
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  className="hidden lg:flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors shrink-0 w-9 h-9"
                  aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    {sidebarCollapsed ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
                    )}
                  </svg>
                </button>
              </SidebarTooltip>
              <button
                onClick={() => setMobileOpen(false)}
                className="lg:hidden inline-flex items-center justify-center min-w-9 min-h-9 rounded-lg text-slate-400 hover:bg-white/5"
                aria-label="Close sidebar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <SidebarNav
              pathname={pathname}
              collapsed={sidebarCollapsed}
              onNavigate={() => setMobileOpen(false)}
            />

            <div
              className={`px-3 py-4 border-t border-white/10 space-y-2 ${
                sidebarCollapsed ? 'lg:flex lg:flex-col lg:items-center lg:overflow-visible' : ''
              }`}
            >
              {sidebarCollapsed ? (
                <SidebarTooltip label={displayName} show>
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-slate-200">
                    {initials[0]}
                  </div>
                </SidebarTooltip>
              ) : (
                <div className="flex items-center gap-3 px-2 py-1">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate capitalize">{displayName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{displayEmail}</p>
                  </div>
                </div>
              )}
              <SidebarTooltip label={loggingOut ? 'Logging out…' : 'Sign out'} show={sidebarCollapsed}>
                <button
                  onClick={() => setShowLogoutModal(true)}
                  disabled={loggingOut}
                  aria-label="Sign out"
                  className={`flex items-center gap-2 text-xs text-slate-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-60 rounded-lg transition-all ${
                    sidebarCollapsed ? 'lg:w-9 lg:h-9 lg:justify-center' : 'px-3 py-2 w-full min-h-9'
                  }`}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {!sidebarCollapsed && (loggingOut ? 'Signing out…' : 'Sign out')}
                </button>
              </SidebarTooltip>
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 shrink-0 border-b border-ink-200/80 bg-white flex items-center gap-2 px-4 sm:px-5">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden inline-flex items-center justify-center w-9 h-9 -ml-1 rounded-lg text-ink-500 hover:bg-ink-100 transition-colors shrink-0"
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <DashboardTopBar title={pageMeta.title} />
            </header>

            <main className="flex-1 flex flex-col min-h-0 overflow-hidden p-3 sm:p-4 lg:p-5">
              <div className="w-full flex flex-col flex-1 min-h-0 gap-3">{children}</div>
            </main>
            <SiteFooter variant="dashboard" />
          </div>
        </div>
      </DashboardHeaderProvider>
    </ToastProvider>
  )
}
