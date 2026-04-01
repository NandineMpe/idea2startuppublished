/** Shared Connect project environment (must match token + server SDK usage). */
export function getPipedreamProjectEnvironment(): "development" | "production" {
  const explicit = (process.env.PIPEDREAM_PROJECT_ENVIRONMENT ?? process.env.PIPEDREAM_ENVIRONMENT ?? "").trim()
  if (explicit === "development" || explicit === "production") return explicit
  if (process.env.NODE_ENV !== "production") return "development"
  return "production"
}
