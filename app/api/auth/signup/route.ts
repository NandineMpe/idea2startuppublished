import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    // Basic validation
    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Password validation
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 })
    }

    // Check if user already exists (in a real app, you'd check your database)
    // For demo purposes, we'll simulate this check
    const existingUsers = ["existing@example.com", "test@example.com"]
    if (existingUsers.includes(email.toLowerCase())) {
      return NextResponse.json({ error: "User already exists with this email" }, { status: 409 })
    }

    // Hash password (in a real app, you'd save this to your database)
    const hashedPassword = await bcrypt.hash(password, 12)

    // In a real application, you would:
    // 1. Save user to database with hashed password
    // 2. Send verification email
    // 3. Return user data (without password)

    console.log("User registration attempt:", {
      email,
      name,
      hashedPassword: hashedPassword.substring(0, 10) + "...",
    })

    return NextResponse.json(
      {
        message: "User registered successfully",
        user: { email, name },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
