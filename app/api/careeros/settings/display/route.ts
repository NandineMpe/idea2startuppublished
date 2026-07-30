import { NextResponse } from "next/server"
import {
  careerDisplayPreferencesToJson,
  parseCareerDisplayPreferences,
  type CareerDisplayPreferences,
} from "@/lib/careeros/display-preferences"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

async function loadPrefs(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("careeros")
    .from("user_settings")
    .select("privacy_preferences")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw error
  return parseCareerDisplayPreferences(data?.privacy_preferences)
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const prefs = await loadPrefs(user.id)
    return NextResponse.json({
      display_name: prefs.displayName,
      hide_email: prefs.hideEmail,
    })
  } catch (error) {
    console.error("[careeros/settings/display GET]", error)
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      display_name?: unknown
      hide_email?: unknown
    }

    const current = await loadPrefs(user.id)

    let displayName: string | null = current.displayName
    if (body.display_name !== undefined) {
      if (body.display_name === null || body.display_name === "") {
        displayName = null
      } else if (typeof body.display_name === "string") {
        const trimmed = body.display_name.trim().slice(0, 80)
        displayName = trimmed.length > 0 ? trimmed : null
      } else {
        return NextResponse.json({ error: "display_name must be a string" }, { status: 400 })
      }
    }

    let hideEmail = current.hideEmail
    if (body.hide_email !== undefined) {
      if (typeof body.hide_email !== "boolean") {
        return NextResponse.json({ error: "hide_email must be a boolean" }, { status: 400 })
      }
      hideEmail = body.hide_email
    }

    const next: CareerDisplayPreferences = { displayName, hideEmail }

    const { data: existing } = await supabase
      .schema("careeros")
      .from("user_settings")
      .select(
        "notification_preferences, region_override_code, onboarding_state, privacy_preferences",
      )
      .eq("user_id", user.id)
      .maybeSingle()

    const prevPrivacy =
      existing?.privacy_preferences && typeof existing.privacy_preferences === "object"
        ? (existing.privacy_preferences as Record<string, unknown>)
        : {}

    const privacy_preferences = {
      ...prevPrivacy,
      ...careerDisplayPreferencesToJson(next),
    }

    const { error } = await supabase.schema("careeros").from("user_settings").upsert(
      {
        user_id: user.id,
        notification_preferences:
          (existing?.notification_preferences as object | undefined) ?? {},
        region_override_code: existing?.region_override_code ?? null,
        onboarding_state: (existing?.onboarding_state as object | undefined) ?? {},
        privacy_preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

    if (error) throw error

    return NextResponse.json({
      display_name: next.displayName,
      hide_email: next.hideEmail,
    })
  } catch (error) {
    console.error("[careeros/settings/display PATCH]", error)
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
