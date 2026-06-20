'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { isAllowedRole } from '@/lib/auth'
import { getLoginErrorMessage } from '@/lib/error-messages'
import { SiteFooter } from '@/components/ui/site-footer'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('error') === 'unauthorized') {
      setError(
        'Your account does not have access to this dashboard. Only owners and admins can sign in.'
      )
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setError(getLoginErrorMessage(signInError))
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('system_role')
      .eq('id', data.user.id)
      .single()

    if (profileError || !isAllowedRole(profile?.system_role)) {
      await supabase.auth.signOut()
      setError(
        'Your account does not have access to this dashboard. Only owners and admins can sign in.'
      )
      setLoading(false)
      return
    }

    router.push('/dashboard/whatsapp-bot')
    router.refresh()
  }

  return (
    <main className="min-h-[100dvh] bg-auth-canvas flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">
        <section className="hidden lg:flex flex-col justify-center px-4">
          <div className="inline-flex items-center gap-2 badge-success w-fit mb-6">
            <WhatsAppDot />
            WhatsApp Automation
          </div>
          <h1 className="text-4xl font-bold text-ink-900 tracking-tight leading-tight">
            Spark & SodaMax — one platform for WhatsApp commerce.
          </h1>
          <p className="text-ink-500 mt-4 text-lg leading-relaxed max-w-md">
            Manage catalogs, orders, and bot flows for both brands from a single dashboard.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-ink-600">
            {['Spark product catalog & order approval', 'SodaMax machines & ecommerce products', 'WhatsApp test tools for both lines'].map(item => (
              <li key={item} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel shadow-panel p-6 sm:p-8 lg:p-10">
          <div className="mb-8">
            <Image
              src="/_C9BFF9E0-617F-45DD-91B5-57549414608C_-removebg-preview.png"
              alt="Spark Distributors"
              width={150}
              height={64}
              className="object-contain"
              priority
            />
          </div>
          <h2 className="text-2xl font-bold text-ink-900 tracking-tight">Sign in</h2>
          <p className="text-sm text-ink-500 mt-1 mb-8">Spark & SodaMax commerce platform</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                className="input-field"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading ? (
                <>
                  <Spinner />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="text-xs text-ink-400 mt-8 text-center">
            <Link href="/privacy" className="hover:text-brand-600 transition-colors">Privacy</Link>
            {' · '}
            <Link href="/data-deletion" className="hover:text-brand-600 transition-colors">Data deletion</Link>
          </p>
        </section>
      </div>
      </div>
      <SiteFooter />
    </main>
  )
}

function WhatsAppDot() {
  return <span className="w-2 h-2 rounded-full bg-brand-500" />
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
