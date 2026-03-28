/** Shared Connect project environment (must match token + server SDK usage). */
export function getPipedreamProjectEnvironment(): "development" | "production" {
  if (process.env.PIPEDREAM_PROJECT_ENVIRONMENT === "development") return "development"
  if (process.env.NODE_ENV !== "production") return "development"
  return "production"
}
