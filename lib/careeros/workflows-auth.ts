/** Bearer auth for ops triggers (VERIFY_TOKEN or CRON_SECRET). */
export function isCareerOSWorkflowAdmin(request: Request): boolean {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
  const cronSecret = process.env.CRON_SECRET?.trim()
  const verifyToken = process.env.VERIFY_TOKEN?.trim()
  if (bearer && cronSecret && bearer === cronSecret) return true
  if (bearer && verifyToken && bearer === verifyToken) return true
  return false
}
