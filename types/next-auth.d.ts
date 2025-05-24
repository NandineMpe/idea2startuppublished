import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      provider?: string
      emailVerified?: boolean
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    provider?: string
    emailVerified?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    provider?: string
  }
}
