"use server"

import { redirect } from "next/navigation"
import { signInWithBetterAuthBridge, signUpWithBetterAuthBridge } from "@/lib/auth-bridge"

type PagePath = "/" | "/login"

function safePagePath(value: string): PagePath {
  return value === "/login" ? "/login" : "/"
}

function safeAfterAuthPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard"
}

export async function junoLoginAction(formData: FormData) {
  const pagePath = safePagePath(String(formData.get("pagePath") ?? "/"))
  const afterAuthPath = safeAfterAuthPath(String(formData.get("afterAuthPath") ?? "/dashboard"))

  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    redirect(`${pagePath}?message=${encodeURIComponent("Email and password are required.")}`)
  }

  try {
    await signInWithBetterAuthBridge({
      email,
      password,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "We couldn't sign you in."
    redirect(`${pagePath}?message=${encodeURIComponent(message)}`)
  }

  redirect(afterAuthPath)
}

export async function junoSignupAction(formData: FormData) {
  const pagePath = safePagePath(String(formData.get("pagePath") ?? "/"))
  const afterAuthPath = safeAfterAuthPath(String(formData.get("afterAuthPath") ?? "/dashboard"))

  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    redirect(`${pagePath}?message=${encodeURIComponent("Email and password are required.")}`)
  }

  if (password.length < 8) {
    redirect(
      `${pagePath}?message=${encodeURIComponent("Passwords must be at least 8 characters long.")}`,
    )
  }

  try {
    await signUpWithBetterAuthBridge({
      email,
      name,
      password,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "We couldn't create your account."
    redirect(`${pagePath}?message=${encodeURIComponent(message)}`)
  }

  redirect(afterAuthPath)
}
