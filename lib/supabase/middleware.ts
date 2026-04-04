import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { normalizeReferralCodeParam } from '@/lib/referral-code'

function applyReferralCaptureCookie(response: NextResponse, ref: string | null) {
    if (!ref) return
    response.cookies.set('juno_ref', ref, {
        path: '/',
        maxAge: 60 * 60 * 24 * 90,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
    })
}

export async function updateSession(request: NextRequest) {
    const refFromQuery = normalizeReferralCodeParam(request.nextUrl.searchParams.get('ref'))

    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "https://pvdpwpextjdoghfuusrd.supabase.co",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_raYAFG0lYJqSiZBtBc2Icw_26NMAJpX",
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Do not run Supabase code if we are processing a static asset or API route that doesn't need auth
    // This prevents issues with Supabase trying to set cookies on static files
    if (
        request.nextUrl.pathname.startsWith('/_next') ||
        request.nextUrl.pathname.startsWith('/api/inngest') ||
        request.nextUrl.pathname.startsWith('/api/webhooks') ||
        request.nextUrl.pathname.startsWith('/api/gaap-analysis') ||
        request.nextUrl.pathname.startsWith('/api/comparable-companies') ||
        request.nextUrl.pathname.includes('.')
    ) {
        return supabaseResponse
    }

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/auth') &&
        request.nextUrl.pathname.startsWith('/dashboard')
    ) {
        // no user, potentially respond by redirecting the user to the login page
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        const redirectResponse = NextResponse.redirect(url)
        applyReferralCaptureCookie(redirectResponse, refFromQuery)
        return redirectResponse
    }

    applyReferralCaptureCookie(supabaseResponse, refFromQuery)
    return supabaseResponse
}
