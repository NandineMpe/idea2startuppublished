export async function getCurrentUser() {
  return {
    id: "static-founder",
    clerk_id: "static-founder",
    name: "Founder Extraordinaire",
    email: "founder@ideatostartup.io",
    image_url: "/placeholder.svg",
    provider: "static",
    email_verified: true,
  }
}
