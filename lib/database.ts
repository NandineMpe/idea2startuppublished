import { supabaseAdmin } from "./supabase"
import bcrypt from "bcryptjs"

export interface User {
  id: string
  email: string
  name: string
  provider: string
  provider_id?: string
  image_url?: string
  email_verified: boolean
  created_at: string
  updated_at: string
}

export interface CreateUserData {
  email: string
  name: string
  password?: string
  provider?: string
  provider_id?: string
  image_url?: string
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = "DatabaseError"
  }
}

export async function createUser(userData: CreateUserData): Promise<User> {
  try {
    const { email, name, password, provider = "credentials", provider_id, image_url } = userData

    // Hash password if provided
    let password_hash: string | null = null
    if (password) {
      password_hash = await bcrypt.hash(password, 12)
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .insert({
        email: email.toLowerCase(),
        name,
        password_hash,
        provider,
        provider_id,
        image_url,
        email_verified: provider === "google", // Auto-verify Google users
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation
        throw new DatabaseError("User already exists with this email", "USER_EXISTS")
      }
      throw new DatabaseError(`Failed to create user: ${error.message}`, error.code)
    }

    return data
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error
    }
    throw new DatabaseError("Failed to create user")
  }
}

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const { data, error } = await supabaseAdmin.from("users").select("*").eq("email", email.toLowerCase()).single()

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null
      }
      throw new DatabaseError(`Failed to get user: ${error.message}`, error.code)
    }

    return data
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error
    }
    return null
  }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const { data, error } = await supabaseAdmin.from("users").select("*").eq("id", id).single()

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null
      }
      throw new DatabaseError(`Failed to get user: ${error.message}`, error.code)
    }

    return data
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error
    }
    return null
  }
}

export async function verifyPassword(email: string, password: string): Promise<User | null> {
  try {
    const user = await getUserByEmail(email)
    if (!user || !user.password_hash) {
      return null
    }

    const isValid = await bcrypt.compare(password, user.password_hash)
    return isValid ? user : null
  } catch (error) {
    return null
  }
}

export async function createAccount(accountData: {
  user_id: string
  provider: string
  provider_account_id: string
  access_token?: string
  refresh_token?: string
  expires_at?: number
  token_type?: string
  scope?: string
  id_token?: string
}) {
  try {
    const { data, error } = await supabaseAdmin.from("accounts").insert(accountData).select().single()

    if (error) {
      throw new DatabaseError(`Failed to create account: ${error.message}`, error.code)
    }

    return data
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error
    }
    throw new DatabaseError("Failed to create account")
  }
}

export async function getAccountByProvider(provider: string, provider_account_id: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("accounts")
      .select("*, users(*)")
      .eq("provider", provider)
      .eq("provider_account_id", provider_account_id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null
      }
      throw new DatabaseError(`Failed to get account: ${error.message}`, error.code)
    }

    return data
  } catch (error) {
    return null
  }
}

export async function createSession(user_id: string, session_token: string, expires_at: Date) {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_sessions")
      .insert({
        user_id,
        session_token,
        expires_at: expires_at.toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw new DatabaseError(`Failed to create session: ${error.message}`, error.code)
    }

    return data
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error
    }
    throw new DatabaseError("Failed to create session")
  }
}

export async function getSessionByToken(session_token: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_sessions")
      .select("*, users(*)")
      .eq("session_token", session_token)
      .gt("expires_at", new Date().toISOString())
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null
      }
      throw new DatabaseError(`Failed to get session: ${error.message}`, error.code)
    }

    return data
  } catch (error) {
    return null
  }
}

export async function deleteSession(session_token: string) {
  try {
    const { error } = await supabaseAdmin.from("user_sessions").delete().eq("session_token", session_token)

    if (error) {
      throw new DatabaseError(`Failed to delete session: ${error.message}`, error.code)
    }
  } catch (error) {
    // Silently fail for session deletion
  }
}

export async function deleteExpiredSessions() {
  try {
    const { error } = await supabaseAdmin.from("user_sessions").delete().lt("expires_at", new Date().toISOString())

    if (error) {
      console.error("Failed to delete expired sessions:", error)
    }
  } catch (error) {
    console.error("Failed to delete expired sessions:", error)
  }
}
