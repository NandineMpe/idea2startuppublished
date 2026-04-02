import "server-only"

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { betterAuth } from "better-auth"
import { parseSetCookieHeader } from "better-auth/cookies"
import { nextCookies } from "better-auth/next-js"
import { cookies } from "next/headers"
import { resolveAppUrl } from "@/lib/app-url"
import { supabaseBetterAuthAdapter } from "@/lib/better-auth/supabase-adapter"
import { getServerEnv } from "@/lib/server-env"

function resolveBetterAuthBaseUrl() {
  return (
    getServerEnv("BETTER_AUTH_URL") ??
    getServerEnv("NEXT_PUBLIC_BETTER_AUTH_URL") ??
    resolveAppUrl()
  )
}

export async function hashBetterAuthPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const derivedKey = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${derivedKey}`
}

export async function verifyBetterAuthPassword({
  hash,
  password,
}: {
  hash: string
  password: string
}) {
  const [salt, expected] = hash.split(":")
  if (!salt || !expected) return false

  const derivedKey = scryptSync(password, salt, 64)
  const expectedKey = Buffer.from(expected, "hex")
  if (derivedKey.length !== expectedKey.length) return false

  return timingSafeEqual(derivedKey, expectedKey)
}

export async function applyBetterAuthResponseHeaders(responseHeaders: Headers) {
  const setCookie = responseHeaders.get("set-cookie")
  if (!setCookie) return

  const cookieStore = await cookies()
  const parsedCookies = parseSetCookieHeader(setCookie)

  parsedCookies.forEach((value, key) => {
    if (!key) return

    cookieStore.set(key, value.value, {
      domain: value.domain,
      expires: value.expires,
      httpOnly: value.httponly,
      maxAge: value["max-age"],
      path: value.path,
      sameSite: value.samesite,
      secure: value.secure,
    })
  })
}

export const auth = betterAuth({
  appName: "Juno AI",
  baseURL: resolveBetterAuthBaseUrl(),
  secret: getServerEnv("BETTER_AUTH_SECRET") ?? getServerEnv("AUTH_SECRET"),
  database: supabaseBetterAuthAdapter,
  plugins: [nextCookies()],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    password: {
      hash: hashBetterAuthPassword,
      verify: verifyBetterAuthPassword,
    },
  },
  user: {
    modelName: "better_auth_users",
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    additionalFields: {
      supabaseUserId: {
        fieldName: "supabase_user_id",
        required: false,
        type: "string",
      },
    },
  },
  session: {
    modelName: "better_auth_sessions",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      userId: "user_id",
    },
  },
  account: {
    modelName: "better_auth_accounts",
    fields: {
      accountId: "account_id",
      providerId: "provider_id",
      userId: "user_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "better_auth_verifications",
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
})
