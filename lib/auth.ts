import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"

// Create a single Supabase client for interacting with your database
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "")

// Validate environment variables
if (!process.env.NEXTAUTH_SECRET) {
  console.warn("Warning: NEXTAUTH_SECRET is not set. This is unsafe in production.")
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: Supabase environment variables are not set.")
}

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === "development",
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
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
          // Normalize email to lowercase
          const email = credentials.email.toLowerCase()

          // Find user by email
          const { data: user, error } = await supabase.from("users").select("*").eq("email", email).single()

          if (error || !user || !user.password_hash) {
            console.log("User not found or no password hash:", email)
            return null
          }

          // Verify password
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash)

          if (!isPasswordValid) {
            console.log("Invalid password for user:", email)
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image_url,
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        return false
      }

      // For Google authentication
      if (account?.provider === "google") {
        try {
          // Normalize email to lowercase
          const email = user.email.toLowerCase()

          // Check if user exists
          const { data: existingUser, error } = await supabase.from("users").select("*").eq("email", email).single()

          if (error && error.code !== "PGRST116") {
            console.error("Database error:", error)
            return false
          }

          // If user doesn't exist, create a new one
          if (!existingUser) {
            const { error: insertError } = await supabase.from("users").insert({
              email: email,
              name: user.name || "User",
              provider: "google",
              provider_id: account.providerAccountId,
              image_url: user.image,
              email_verified: true,
            })

            if (insertError) {
              console.error("Failed to create user:", insertError)
              return false
            }
          }
          // If user exists but was created with credentials, update provider info
          else if (existingUser.provider === "credentials") {
            const { error: updateError } = await supabase
              .from("users")
              .update({
                provider: "google",
                provider_id: account.providerAccountId,
                image_url: user.image || existingUser.image_url,
              })
              .eq("id", existingUser.id)

            if (updateError) {
              console.error("Failed to update user:", updateError)
              return false
            }
          }

          // Store OAuth account info
          if (account.access_token) {
            const { error: accountError } = await supabase.from("accounts").upsert(
              {
                user_id: existingUser?.id,
                provider: "google",
                provider_account_id: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
              { onConflict: "provider, provider_account_id" },
            )

            if (accountError) {
              console.error("Failed to store account:", accountError)
            }
          }
        } catch (error) {
          console.error("Google sign in error:", error)
          return false
        }
      }

      return true
    },
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.provider = account?.provider || "credentials"
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.provider = token.provider as string

        // Fetch fresh user data from database
        try {
          const { data: dbUser } = await supabase.from("users").select("*").eq("email", session.user.email).single()

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
  pages: {
    signIn: "/auth/signin",
    signUp: "/auth/signup",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
}
