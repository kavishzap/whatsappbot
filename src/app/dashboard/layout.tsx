'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserProfile } from '@/lib/auth'
import { ToastProvider } from '@/components/ui/toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.127 1.534 5.868L.057 23.57a.75.75 0 00.916.916l5.702-1.477A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.89 0-3.659-.52-5.17-1.427l-.37-.22-3.83.993.993-3.83-.22-.37A9.972 9.972 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  )
}

function getInitials(name: string | null, email: string | null): string {
  if (name) {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }
  return (email?.[0] ?? 'U').toUpperCase()
}

function OrdersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  )
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
      <div
        role="tooltip"
        className="absolute left-[calc(100%+0.625rem)] top-1/2 -translate-y-1/2 z-[100] px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium whitespace-nowrap shadow-lg opacity-0 invisible translate-x-1 group-hover/tooltip:opacity-100 group-hover/tooltip:visible group-hover/tooltip:translate-x-0 group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:visible group-focus-within/tooltip:translate-x-0 transition-all duration-150 pointer-events-none"
      >
        {label}
        <span className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gray-900" />
      </div>
    </div>
  )
}

function SidebarContent({
  collapsed,
  pathname,
  profile,
  loggingOut,
  onLogoutClick,
  onNavClick,
}: {
  collapsed: boolean
  pathname: string
  profile: UserProfile | null
  loggingOut: boolean
  onLogoutClick: () => void
  onNavClick?: () => void
}) {
  const displayName = profile?.full_name ?? profile?.email?.split('@')[0] ?? 'User'
  const displayEmail = profile?.email ?? ''
  const initials = getInitials(profile?.full_name ?? null, profile?.email ?? null)

  const navItems = [
    { href: '/dashboard/whatsapp-bot', label: 'WhatsApp Bot', icon: WhatsAppIcon },
    { href: '/dashboard/orders', label: 'WhatsApp Orders', icon: OrdersIcon },
  ]

  return (
    <>
      <nav className={`flex-1 px-2 py-4 space-y-1 ${collapsed ? 'overflow-visible' : ''}`}>
        {!collapsed && (
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
            Automation
          </p>
        )}
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <SidebarTooltip key={href} label={label} show={collapsed}>
              <Link
                href={href}
                onClick={onNavClick}
                aria-label={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-all ${
                  collapsed
                    ? 'w-10 h-10 mx-auto justify-center'
                    : 'px-3 py-2.5'
                } ${
                  active
                    ? collapsed
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25'
                      : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                    : collapsed
                      ? 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    active
                      ? collapsed
                        ? 'text-white'
                        : 'text-emerald-500'
                      : 'text-gray-400 group-hover/tooltip:text-gray-600'
                  }`}
                />
                {!collapsed && label}
              </Link>
            </SidebarTooltip>
          )
        })}
      </nav>

      <div className={`px-3 py-4 border-t border-gray-100 space-y-3 ${collapsed ? 'flex flex-col items-center overflow-visible' : ''}`}>
        {collapsed ? (
          <SidebarTooltip label={displayName} show>
            <div
              className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-semibold text-emerald-700 cursor-default"
              aria-label={displayName}
            >
              {initials[0]}
            </div>
          </SidebarTooltip>
        ) : (
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-semibold text-emerald-700 shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate capitalize">{displayName}</p>
              <p className="text-[10px] text-gray-400 truncate">{displayEmail}</p>
            </div>
          </div>
        )}
        <SidebarTooltip label={loggingOut ? 'Logging out…' : 'Logout'} show={collapsed}>
          <button
            onClick={onLogoutClick}
            disabled={loggingOut}
            aria-label="Logout"
            className={`flex items-center gap-2 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-60 rounded-xl transition-all ${
              collapsed ? 'w-10 h-10 justify-center' : 'px-3 py-2 w-full'
            }`}
          >
            {loggingOut ? (
              <svg className="w-3.5 h-3.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            )}
            {!collapsed && (loggingOut ? 'Logging out…' : 'Logout')}
          </button>
        </SidebarTooltip>
      </div>
    </>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const headerMeta: Record<string, { title: string; subtitle: string }> = {
    '/dashboard/whatsapp-bot': {
      title: 'WhatsApp Bot Dashboard',
      subtitle: 'Manage products and automated order responses',
    },
    '/dashboard/orders': {
      title: 'Orders',
      subtitle: 'View and search WhatsApp bot orders',
    },
  }
  const { title: headerTitle, subtitle: headerSubtitle } =
    headerMeta[pathname] ?? headerMeta['/dashboard/whatsapp-bot']

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      supabase
        .from('user_profiles')
        .select('id, full_name, email, phone, avatar_url, system_role, is_active')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) setProfile(data as UserProfile)
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

  return (
    <ToastProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <ConfirmDialog
          open={showLogoutModal}
          title="Log out?"
          description="You will be signed out of the WhatsApp Bot Dashboard. You can sign back in anytime."
          confirmLabel="Log out"
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
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}

        <aside
          className={`bg-white border-r border-gray-100 flex flex-col shrink-0 transition-all duration-300 z-50 overflow-visible
            fixed lg:relative inset-y-0 left-0
            ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            ${collapsed ? 'w-16' : 'w-64'}
          `}
        >
          <div className={`py-4 px-3 border-b border-gray-100 flex items-center gap-2 ${collapsed ? 'justify-center overflow-visible' : 'justify-between'}`}>
            {!collapsed && (
              <Image
                src="/_C9BFF9E0-617F-45DD-91B5-57549414608C_-removebg-preview.png"
                alt="Spark Distributors"
                width={120}
                height={50}
                className="object-contain"
                priority
              />
            )}
            <SidebarTooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} show={collapsed}>
              <button
                onClick={() => setCollapsed(!collapsed)}
                className={`hidden lg:flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0 ${
                  collapsed ? 'w-10 h-10' : 'p-1.5'
                }`}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  {collapsed ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
                  )}
                </svg>
              </button>
            </SidebarTooltip>
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <SidebarContent
            collapsed={collapsed}
            pathname={pathname}
            profile={profile}
            loggingOut={loggingOut}
            onLogoutClick={() => setShowLogoutModal(true)}
            onNavClick={() => setMobileOpen(false)}
          />
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center gap-4 shrink-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{headerTitle}</h1>
              <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">{headerSubtitle}</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium ring-1 ring-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Bot active
            </div>
          </header>

          <main className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
