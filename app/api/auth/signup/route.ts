import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"

// Create a single Supabase client for interacting with your database
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", process.env.SUPABASE_SERVICE_ROLE_KEY || "")

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase()

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Database error checking user:", checkError)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const { data: user, error: createError } = await supabase
      .from("users")
      .insert({
        email: normalizedEmail,
        name,
        password_hash: hashedPassword,
        provider: "credentials",
        email_verified: false,
      })
      .select()
      .single()

    if (createError) {
      console.error("Error creating user:", createError)
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
    }

    return NextResponse.json(
      {
        message: "User created successfully",
        userId: user.id,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
