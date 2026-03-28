/**
 * Some clients call `/api/security/status` (path) instead of `/api/security?status=…`.
 * This static route takes precedence over `[id]` and reuses the same handler as GET /api/security.
 */
export { GET } from "../route"
