import { Webhook } from "svix"
import { headers } from "next/headers"
import type { WebhookEvent } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  // Get the webhook secret from environment variables
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error("Missing CLERK_WEBHOOK_SECRET")
    return new Response("Webhook secret not provided", { status: 500 })
  }

  // Get the headers
  const headerPayload = headers()
  const svix_id = headerPayload.get("svix-id")
  const svix_timestamp = headerPayload.get("svix-timestamp")
  const svix_signature = headerPayload.get("svix-signature")

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  // Verify the webhook
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error("Error verifying webhook:", err)
    return new Response("Error verifying webhook", { status: 400 })
  }

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials")
    return new Response("Supabase credentials not provided", { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Handle the webhook event
  const eventType = evt.type

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, image_url, first_name, last_name, username } = evt.data

    const primaryEmail = email_addresses?.[0]?.email_address
    const name = first_name && last_name ? `${first_name} ${last_name}` : username || "User"

    if (!primaryEmail) {
      return new Response("No email found for user", { status: 400 })
    }

    try {
      // Check if user already exists
      const { data: existingUser } = await supabase.from("users").select("*").eq("clerk_id", id).single()

      if (existingUser) {
        // Update existing user
        await supabase
          .from("users")
          .update({
            email: primaryEmail,
            name,
            image_url: image_url,
            updated_at: new Date().toISOString(),
          })
          .eq("clerk_id", id)
      } else {
        // Create new user
        await supabase.from("users").insert({
          clerk_id: id,
          email: primaryEmail,
          name,
          image_url: image_url,
          provider: "clerk",
          email_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Error syncing user to Supabase:", error)
      return new Response("Error syncing user to Supabase", { status: 500 })
    }
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data

    try {
      // Delete user from Supabase
      await supabase.from("users").delete().eq("clerk_id", id)

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Error deleting user from Supabase:", error)
      return new Response("Error deleting user from Supabase", { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
