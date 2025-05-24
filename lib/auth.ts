import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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
          const { data: user, error } = await supabase.from("users").select("*").eq("email", credentials.email).single()

          if (error || !user) {
            return null
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash)

          if (!isPasswordValid) {
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
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          const { data: existingUser, error } = await supabase
            .from("users")
            .select("*")
            .eq("email", user.email)
            .single()

          if (error && error.code !== "PGRST116") {
            console.error("Database error:", error)
            return false
          }

          if (!existingUser) {
            const { error: insertError } = await supabase.from("users").insert({
              email: user.email!,
              name: user.name || "",
              provider: "google",
              provider_id: user.id,
              image_url: user.image,
              email_verified: true,
            })

            if (insertError) {
              console.error("Failed to create user:", insertError)
              return false
            }
          }
        } catch (error) {
          console.error("Sign-in error:", error)
          return false
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string

        // Fetch fresh user data from Supabase
        try {
          const { data: dbUser } = await supabase.from("users").select("*").eq("email", session.user.email).single()

          if (dbUser) {
            session.user.name = dbUser.name
            session.user.image = dbUser.image_url
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
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
}
