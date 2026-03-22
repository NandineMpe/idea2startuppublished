/**
 * Inngest / background jobs — thin wrapper around the unified company context engine.
 * Prefer importing getCompanyContext from @/lib/company-context with a queryHint.
 */

import type { GetCompanyContextOptions } from "@/lib/company-context"
import { getCompanyContextPrompt } from "@/lib/company-context"

/**
 * @deprecated Prefer `getCompanyContext(userId, options)` from `@/lib/company-context` for structured data.
 * Returns the assembled prompt block string only.
 */
export async function getCompanyContextForJobs(
  userId: string,
  options: GetCompanyContextOptions = {},
): Promise<string> {
  return getCompanyContextPrompt(userId, options)
}

export type { GetCompanyContextOptions, CompanyContext, CompanyProfile, CompanyAsset } from "@/lib/company-context"
