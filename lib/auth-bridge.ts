import "server-only"

import { randomUUID } from "node:crypto"
import { cookies, headers } from "next/headers"
import { auth, applyBetterAuthResponseHeaders, hashBetterAuthPassword } from "@/lib/better-auth"
import { supabaseAdmin } from "@/lib/supabase"
import { createClient } from "@/lib/supabase/server"
import { recordReferralAttributionIfEligible } from "@/lib/referrals"

type BetterAuthUserRow = {
  id: string
  name: string
  email: string
  supabase_user_id: string | null
}

type BetterAuthAccountRow = {
  id: string
  user_id: string
  provider_id: string
  account_id: string
  password: string | null
}

type SupabaseAuthUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function fallbackNameFromEmail(email: string) {
  return email.split("@")[0] || "Founder"
}

function infrastructureErrorMessage(error: unknown) {
  const message =
    typeof error === "string" ? error : error instanceof Error ? error.message : ""

  if (
    /better_auth_/i.test(message) &&
    /(does not exist|relation .* does not exist|schema cache|could not find the table)/i.test(
      message,
    )
  ) {
    return "Authentication setup is incomplete. Apply supabase/migrations/040_better_auth_bridge.sql and try again."
  }

  return null
}

function toErrorMessage(error: unknown, fallback: string) {
  const infraMessage = infrastructureErrorMessage(error)
  if (infraMessage) {
    return infraMessage
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return fallback
}

async function requestHeaders() {
  return new Headers(await headers())
}

async function findBetterAuthUserByEmail(email: string) {
  const { data, error } = await supabaseAdmin
    .from("better_auth_users")
    .select("id,name,email,supabase_user_id")
    .eq("email", email)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as BetterAuthUserRow | null
}

async function findBetterAuthCredentialAccount(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("better_auth_accounts")
    .select("id,user_id,provider_id,account_id,password")
    .eq("user_id", userId)
    .eq("provider_id", "credential")
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as BetterAuthAccountRow | null
}

async function syncBetterAuthUserRecord({
  betterAuthUserId,
  name,
  supabaseUserId,
}: {
  betterAuthUserId: string
  name: string
  supabaseUserId: string
}) {
  const { error } = await supabaseAdmin
    .from("better_auth_users")
    .update({
      name,
      supabase_user_id: supabaseUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", betterAuthUserId)

  if (error) throw error
}

async function upsertBetterAuthCredentialPassword({
  betterAuthUserId,
  password,
}: {
  betterAuthUserId: string
  password: string
}) {
  const passwordHash = await hashBetterAuthPassword(password)
  const account = await findBetterAuthCredentialAccount(betterAuthUserId)

  if (account) {
    const { error } = await supabaseAdmin
      .from("better_auth_accounts")
      .update({
        password: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id)

    if (error) throw error
    return
  }

  const { error } = await supabaseAdmin.from("better_auth_accounts").insert({
    id: randomUUID().replaceAll("-", ""),
    account_id: betterAuthUserId,
    provider_id: "credential",
    user_id: betterAuthUserId,
    password: passwordHash,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  if (error) throw error
}

async function findSupabaseUserByEmail(email: string): Promise<SupabaseAuthUser | null> {
  try {
    const { data, error } = await supabaseAdmin
      .schema("auth")
      .from("users")
      .select("id,email,user_metadata")
      .eq("email", email)
      .maybeSingle()

    if (!error && data) {
      return data as SupabaseAuthUser
    }
  } catch {
    // Fall back to the admin API scan below if auth schema access is unavailable.
  }

  let page = 1
  const perPage = 1000

  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error

    const match = (data.users ?? []).find((user) => normalizeEmail(user.email ?? "") === email)
    if (match) return match as SupabaseAuthUser
    if ((data.users ?? []).length < perPage) break

    page += 1
  }

  return null
}

function mergeUserMetadata(
  currentMetadata: Record<string, unknown> | null | undefined,
  name: string,
) {
  return {
    ...(currentMetadata ?? {}),
    full_name: name,
  }
}

async function createSupabaseUser({
  email,
  password,
  name,
}: {
  email: string
  password: string
  name: string
}) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: {
      full_name: name,
    },
  })

  if (error || !data.user) {
    throw new Error(error?.message || "Unable to create the Supabase account.")
  }

  return data.user as SupabaseAuthUser
}

async function syncSupabaseCredentials({
  user,
  password,
  name,
}: {
  user: SupabaseAuthUser
  password: string
  name: string
}) {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password,
    user_metadata: mergeUserMetadata(user.user_metadata, name),
  })

  if (error || !data.user) {
    throw new Error(error?.message || "Unable to sync the Supabase account.")
  }

  return data.user as SupabaseAuthUser
}

async function signIntoSupabase({
  email,
  password,
}: {
  email: string
  password: string
}) {
  const supabase = await createClient()
  const result = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return {
    error: result.error,
    user: (result.data.user ?? null) as SupabaseAuthUser | null,
  }
}

function resolvedName({
  email,
  formName,
  storedName,
}: {
  email: string
  formName?: string
  storedName?: string | null
}) {
  return formName?.trim() || storedName?.trim() || fallbackNameFromEmail(email)
}

async function ensureBetterAuthForSupabaseUser({
  email,
  password,
  name,
  supabaseUser,
}: {
  email: string
  password: string
  name: string
  supabaseUser: SupabaseAuthUser
}) {
  const existingBetterAuthUser = await findBetterAuthUserByEmail(email)

  if (!existingBetterAuthUser) {
    const response = await auth.api.signUpEmail({
      body: {
        email,
        name,
        password,
      },
      headers: await requestHeaders(),
      returnHeaders: true,
    })
    const betterAuthUser = response.response.user

    await syncBetterAuthUserRecord({
      betterAuthUserId: betterAuthUser.id,
      name,
      supabaseUserId: supabaseUser.id,
    })

    await applyBetterAuthResponseHeaders(response.headers)
    return
  }

  await syncBetterAuthUserRecord({
    betterAuthUserId: existingBetterAuthUser.id,
    name,
    supabaseUserId: supabaseUser.id,
  })
  await upsertBetterAuthCredentialPassword({
    betterAuthUserId: existingBetterAuthUser.id,
    password,
  })

  const response = await auth.api.signInEmail({
    body: {
      email,
      password,
    },
    headers: await requestHeaders(),
    returnHeaders: true,
  })

  await applyBetterAuthResponseHeaders(response.headers)
}

async function ensureSupabaseForBetterAuthUser({
  betterAuthUser,
  password,
}: {
  betterAuthUser: { id: string; email: string; name: string }
  password: string
}) {
  const existingSupabaseUser = await findSupabaseUserByEmail(betterAuthUser.email)

  const supabaseUser = existingSupabaseUser
    ? await syncSupabaseCredentials({
        user: existingSupabaseUser,
        password,
        name: betterAuthUser.name,
      })
    : await createSupabaseUser({
        email: betterAuthUser.email,
        name: betterAuthUser.name,
        password,
      })

  await syncBetterAuthUserRecord({
    betterAuthUserId: betterAuthUser.id,
    name: betterAuthUser.name,
    supabaseUserId: supabaseUser.id,
  })

  return supabaseUser
}

export async function signUpWithBetterAuthBridge({
  email,
  name,
  password,
}: {
  email: string
  name: string
  password: string
}) {
  const normalizedEmail = normalizeEmail(email)
  const displayName = resolvedName({
    email: normalizedEmail,
    formName: name,
  })

  const existingBetterAuthUser = await findBetterAuthUserByEmail(normalizedEmail)
  if (existingBetterAuthUser) {
    throw new Error("An account with this email already exists. Sign in instead.")
  }

  const existingSupabaseUser = await findSupabaseUserByEmail(normalizedEmail)
  if (existingSupabaseUser) {
    throw new Error("An account with this email already exists. Sign in instead.")
  }

  try {
    const response = await auth.api.signUpEmail({
      body: {
        email: normalizedEmail,
        name: displayName,
        password,
      },
      headers: await requestHeaders(),
      returnHeaders: true,
    })
    const betterAuthUser = response.response.user

    const supabaseUser = await createSupabaseUser({
      email: normalizedEmail,
      name: displayName,
      password,
    })

    await syncBetterAuthUserRecord({
      betterAuthUserId: betterAuthUser.id,
      name: displayName,
      supabaseUserId: supabaseUser.id,
    })

    try {
      const cookieStore = await cookies()
      const refRaw = cookieStore.get("juno_ref")?.value
      if (refRaw?.trim()) {
        await recordReferralAttributionIfEligible({
          referredUserId: supabaseUser.id,
          referralCodeFromCookie: refRaw,
        })
      }
      cookieStore.delete("juno_ref")
    } catch {
      // Referral capture is best effort; sign-up should still succeed.
    }

    await applyBetterAuthResponseHeaders(response.headers)

    const signInResult = await signIntoSupabase({
      email: normalizedEmail,
      password,
    })

    if (signInResult.error) {
      throw new Error(signInResult.error.message)
    }
  } catch (error) {
    throw new Error(toErrorMessage(error, "We couldn't create your account right now."))
  }
}

export async function signInWithBetterAuthBridge({
  email,
  password,
}: {
  email: string
  password: string
}) {
  const normalizedEmail = normalizeEmail(email)

  const supabaseSignIn = await signIntoSupabase({
    email: normalizedEmail,
    password,
  })

  if (!supabaseSignIn.error && supabaseSignIn.user) {
    const name = resolvedName({
      email: normalizedEmail,
      storedName: String(supabaseSignIn.user.user_metadata?.full_name ?? ""),
    })

    await ensureBetterAuthForSupabaseUser({
      email: normalizedEmail,
      password,
      name,
      supabaseUser: supabaseSignIn.user,
    })

    return
  }

  try {
    const betterAuthSignIn = await auth.api.signInEmail({
      body: {
        email: normalizedEmail,
        password,
      },
      headers: await requestHeaders(),
      returnHeaders: true,
    })
    const betterAuthUser = betterAuthSignIn.response.user

    await applyBetterAuthResponseHeaders(betterAuthSignIn.headers)
    await ensureSupabaseForBetterAuthUser({
      betterAuthUser: {
        email: normalizedEmail,
        id: betterAuthUser.id,
        name: betterAuthUser.name,
      },
      password,
    })

    const supabaseRetry = await signIntoSupabase({
      email: normalizedEmail,
      password,
    })

    if (supabaseRetry.error) {
      throw new Error(supabaseRetry.error.message)
    }
  } catch (error) {
    throw new Error(
      toErrorMessage(
        error,
        supabaseSignIn.error?.message || "We couldn't sign you in with that email and password.",
      ),
    )
  }
}
