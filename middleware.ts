import { NextResponse, type NextRequest } from 'next/server'

// Temporary: disable Supabase auth/session handling so the app runs without login
export async function middleware(request: NextRequest) {
    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
