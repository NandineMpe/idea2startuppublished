/**
 * Product entitlement.
 *
 * One human can legitimately be several things — a founder who is also a
 * content creator, say — so entitlement is a SET, not a scalar.
 *
 * Storage is deliberately backward-compatible with the original
 * one-product-per-account model:
 *  - `user_metadata.products` (string[]) is the entitlement set, when present.
 *  - `user_metadata.product`  (string)   remains the *primary* product: the
 *    OS a user lands on by default, and the sole source of truth for the
 *    accounts created before this existed.
 *
 * Nothing needs backfilling: an account with only `product` resolves to a
 * single-item set, which reproduces the old behaviour exactly.
 */

export const PRODUCTS = ["founder", "career", "creator"] as const
export type ProductType = (typeof PRODUCTS)[number]

export const DEFAULT_PRODUCT: ProductType = "founder"

export function isProductType(value: unknown): value is ProductType {
  return typeof value === "string" && (PRODUCTS as readonly string[]).includes(value)
}

type UserMetadata = { product?: unknown; products?: unknown } | null | undefined

/** The account's primary product — where it lands when no specific OS was requested. */
export function primaryProduct(metadata: UserMetadata): ProductType {
  const raw = metadata?.product
  return isProductType(raw) ? raw : DEFAULT_PRODUCT
}

/**
 * Every product this account may access. Always contains the primary product,
 * so a malformed or empty `products` array can never lock a user out.
 */
export function entitledProducts(metadata: UserMetadata): ProductType[] {
  const primary = primaryProduct(metadata)
  const raw = metadata?.products
  const extra = Array.isArray(raw) ? raw.filter(isProductType) : []
  return [...new Set<ProductType>([primary, ...extra])]
}

export function hasProduct(metadata: UserMetadata, product: ProductType): boolean {
  return entitledProducts(metadata).includes(product)
}

export const HOME_PATH_BY_PRODUCT: Record<ProductType, string> = {
  founder: "/dashboard",
  career: "/career/dashboard",
  creator: "/creator/dashboard",
}

export const LOGIN_PATH_BY_PRODUCT: Record<ProductType, string> = {
  founder: "/login",
  career: "/career",
  creator: "/creator",
}

export const PRODUCT_LABELS: Record<ProductType, string> = {
  founder: "Founder OS",
  career: "Career OS",
  creator: "Creator OS",
}

/** Route prefixes that belong to each product, for access checks. */
const PREFIXES_BY_PRODUCT: Record<ProductType, string[]> = {
  founder: ["/dashboard"],
  career: ["/career/dashboard", "/careeros"],
  creator: ["/creator/dashboard"],
}

/** Which product a path belongs to, or null when the path is not product-gated. */
export function productForPath(pathname: string): ProductType | null {
  for (const product of PRODUCTS) {
    if (PREFIXES_BY_PRODUCT[product].some((prefix) => pathname.startsWith(prefix))) {
      return product
    }
  }
  return null
}
