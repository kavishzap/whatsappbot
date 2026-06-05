import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'
import { isAllowedRole } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard')
  const isLoginPage = request.nextUrl.pathname === '/'

  if (isDashboard) {
    if (!user) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('system_role')
      .eq('id', user.id)
      .single()

    if (!isAllowedRole(profile?.system_role)) {
      await supabase.auth.signOut()
      const url = new URL('/', request.url)
      url.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(url)
    }
  }

  if (isLoginPage && user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('system_role')
      .eq('id', user.id)
      .single()

    if (isAllowedRole(profile?.system_role)) {
      return NextResponse.redirect(new URL('/dashboard/whatsapp-bot', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
}
