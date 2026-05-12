import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { normalizeReferralCodeParam } from '@/lib/referral-code'
import {
    PREVIEW_MODE_COOKIE,
    isMutatingMethod,
    isPreviewApiAllowed,
} from '@/lib/preview-mode'

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

    const previewSlug = request.cookies.get(PREVIEW_MODE_COOKIE)?.value?.trim() || null
    if (
        previewSlug &&
        request.nextUrl.pathname.startsWith('/api/') &&
        !isPreviewApiAllowed(request.nextUrl.pathname) &&
        isMutatingMethod(request.method)
    ) {
        return NextResponse.json(
            { error: 'Read-only preview. Sign in to make changes.' },
            { status: 403 },
        )
    }

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

    const pathname = request.nextUrl.pathname

    // Unauthenticated users: bounce to the right login door
    if (!user) {
        const protectedPrefixes: Array<[string, string]> = [
            ['/dashboard', '/login'],
            ['/career/dashboard', '/career'],
            ['/creator/dashboard', '/creator'],
            ['/careeros', '/career'],
        ]
        for (const [prefix, loginPath] of protectedPrefixes) {
            if (pathname.startsWith(prefix)) {
                const url = request.nextUrl.clone()
                url.pathname = loginPath
                const redirectResponse = NextResponse.redirect(url)
                applyReferralCaptureCookie(redirectResponse, refFromQuery)
                return redirectResponse
            }
        }
        applyReferralCaptureCookie(supabaseResponse, refFromQuery)
        return supabaseResponse
    }

    // Authenticated users: enforce one-product-per-account.
    // A career user cannot access founder routes, and vice versa.
    const product = (user.user_metadata?.product as string | undefined) ?? 'founder'

    const wrongProduct =
        (product === 'career' && (pathname.startsWith('/dashboard') || pathname.startsWith('/creator/dashboard'))) ||
        (product === 'creator' && (pathname.startsWith('/dashboard') || pathname.startsWith('/career/dashboard') || pathname.startsWith('/careeros'))) ||
        (product === 'founder' && (pathname.startsWith('/career/dashboard') || pathname.startsWith('/careeros') || pathname.startsWith('/creator/dashboard')))

    if (wrongProduct) {
        const homeByProduct: Record<string, string> = {
            founder: '/dashboard',
            career: '/career/dashboard',
            creator: '/creator/dashboard',
        }
        const url = request.nextUrl.clone()
        url.pathname = homeByProduct[product] ?? '/dashboard'
        const redirectResponse = NextResponse.redirect(url)
        applyReferralCaptureCookie(redirectResponse, refFromQuery)
        return redirectResponse
    }

    applyReferralCaptureCookie(supabaseResponse, refFromQuery)
    return supabaseResponse
}
