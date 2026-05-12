"use server"

import { redirect } from "next/navigation"
import { signInWithBetterAuthBridge, signUpWithBetterAuthBridge } from "@/lib/auth-bridge"

const VALID_PAGE_PATHS = ["/", "/login", "/creator", "/career"] as const
type PagePath = (typeof VALID_PAGE_PATHS)[number]

function safePagePath(value: string): PagePath {
  return (VALID_PAGE_PATHS as readonly string[]).includes(value)
    ? (value as PagePath)
    : "/"
}

function safeAfterAuthPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard"
}

function pagePathToProduct(pagePath: PagePath) {
  if (pagePath === "/career") return "career" as const
  if (pagePath === "/creator") return "creator" as const
  return "founder" as const
}

export async function junoLoginAction(formData: FormData) {
  const pagePath = safePagePath(String(formData.get("pagePath") ?? "/"))
  const afterAuthPath = safeAfterAuthPath(String(formData.get("afterAuthPath") ?? "/dashboard"))
  const requiredProduct = pagePathToProduct(pagePath)

  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    redirect(`${pagePath}?message=${encodeURIComponent("Email and password are required.")}`)
  }

  try {
    await signInWithBetterAuthBridge({ email, password, requiredProduct })
  } catch (error) {
    const message = error instanceof Error ? error.message : "We couldn't sign you in."
    redirect(`${pagePath}?message=${encodeURIComponent(message)}`)
  }

  redirect(afterAuthPath)
}

export async function junoSignupAction(formData: FormData) {
  const pagePath = safePagePath(String(formData.get("pagePath") ?? "/"))
  const afterAuthPath = safeAfterAuthPath(String(formData.get("afterAuthPath") ?? "/dashboard"))
  const product = pagePathToProduct(pagePath)

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
    await signUpWithBetterAuthBridge({ email, name, password, product })
  } catch (error) {
    const message = error instanceof Error ? error.message : "We couldn't create your account."
    redirect(`${pagePath}?message=${encodeURIComponent(message)}`)
  }

  redirect(afterAuthPath)
}
