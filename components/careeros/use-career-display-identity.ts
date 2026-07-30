"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  parseCareerDisplayPreferences,
  resolveCareerDisplayIdentity,
} from "@/lib/careeros/display-preferences"
import { DEMO_PROFILE } from "@/lib/careeros/demo-data"

export function useCareerDisplayIdentity() {
  const [name, setName] = useState(DEMO_PROFILE.name)
  const [email, setEmail] = useState<string | null>(DEMO_PROFILE.email)
  const [initials, setInitials] = useState(DEMO_PROFILE.initials)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoaded(true)
      return
    }

    const { data: settings } = await supabase
      .schema("careeros")
      .from("user_settings")
      .select("privacy_preferences")
      .eq("user_id", user.id)
      .maybeSingle()

    const prefs = parseCareerDisplayPreferences(settings?.privacy_preferences)
    const identity = resolveCareerDisplayIdentity(prefs, {
      email: user.email,
      user_metadata: user.user_metadata as Record<string, unknown> | undefined,
    })
    setName(identity.name)
    setEmail(identity.email)
    setInitials(identity.initials)
    setLoaded(true)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onSaved = () => void refresh()
    window.addEventListener("careeros-display-prefs-updated", onSaved)
    return () => window.removeEventListener("careeros-display-prefs-updated", onSaved)
  }, [refresh])

  return { name, email, initials, loaded, refresh }
}
