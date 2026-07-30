"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  HOME_PATH_BY_PRODUCT,
  PRODUCT_LABELS,
  entitledProducts,
  isProductType,
  primaryProduct,
  type ProductType,
} from "@/lib/products"

export type ProductAccessState = {
  signedIn: boolean
  entitled: ProductType[]
  primary: ProductType
}

/** What the signed-in account may access — drives the OS portal's switcher. */
export async function getProductAccess(): Promise<ProductAccessState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { signedIn: false, entitled: [], primary: "founder" }
  }

  return {
    signedIn: true,
    entitled: entitledProducts(user.user_metadata),
    primary: primaryProduct(user.user_metadata),
  }
}

export type EnableProductResult = { ok: true; href: string } | { ok: false; error: string }

/**
 * Add a product to the signed-in account.
 *
 * Self-service on purpose: anyone can already create a second account for any
 * OS from its own signup page, so granting one to an existing account is not
 * an escalation — it avoids forcing one human to hold several logins.
 *
 * Note for when billing lands: this is the chokepoint that would need an
 * entitlement check, since it is the only path that widens access.
 */
export async function enableProductForCurrentUser(
  product: string,
): Promise<EnableProductResult> {
  if (!isProductType(product)) {
    return { ok: false, error: "Unknown product." }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Sign in first." }
  }

  const current = entitledProducts(user.user_metadata)
  if (current.includes(product)) {
    return { ok: true, href: HOME_PATH_BY_PRODUCT[product] }
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      // Preserve `product` as the primary/default OS; `products` is the set.
      product: primaryProduct(user.user_metadata),
      products: [...current, product],
    },
  })

  if (error) {
    return { ok: false, error: `Could not enable ${PRODUCT_LABELS[product]}: ${error.message}` }
  }

  revalidatePath("/")
  return { ok: true, href: HOME_PATH_BY_PRODUCT[product] }
}
