import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { createUser, getUserByEmail, verifyPassword, createAccount, getAccountByProvider } from "./database"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const user = await verifyPassword(credentials.email, credentials.password)
          if (user) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image_url,
            }
          }
          return null
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    signUp: "/auth/signup",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          // Check if account already exists
          const existingAccount = await getAccountByProvider("google", account.providerAccountId)

          if (existingAccount) {
            // User exists, allow sign in
            user.id = existingAccount.users.id
            return true
          }

          // Check if user exists with this email
          let dbUser = await getUserByEmail(user.email!)

          if (!dbUser) {
            // Create new user
            dbUser = await createUser({
              email: user.email!,
              name: user.name!,
              provider: "google",
              provider_id: account.providerAccountId,
              image_url: user.image,
            })
          }

          // Create account link
          await createAccount({
            user_id: dbUser.id,
            provider: "google",
            provider_account_id: account.providerAccountId,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          })

          user.id = dbUser.id
          return true
        } catch (error) {
          console.error("Google sign in error:", error)
          return false
        }
      }

      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
      }
      if (account?.provider) {
        token.provider = account.provider
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.provider = token.provider as string

        // Fetch fresh user data from database
        try {
          const dbUser = await getUserByEmail(session.user.email!)
          if (dbUser) {
            session.user.name = dbUser.name
            session.user.image = dbUser.image_url
            session.user.emailVerified = dbUser.email_verified
          }
        } catch (error) {
          console.error("Session callback error:", error)
        }
      }
      return session
    },
  },
  events: {
    async signOut({ token }) {
      // Clean up any additional session data if needed
      console.log("User signed out:", token?.email)
    },
  },
}
