import { currentUser } from "@clerk/nextjs/server"
import { createClient } from "@supabase/supabase-js"

export async function getCurrentUser() {
  try {
    const user = await currentUser()

    if (!user) {
      return null
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase credentials")
      return null
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from Supabase
    const { data: supabaseUser, error } = await supabase.from("users").select("*").eq("clerk_id", user.id).single()

    if (error) {
      console.error("Error fetching user from Supabase:", error)

      // If user doesn't exist in Supabase yet, create a basic record
      if (error.code === "PGRST116") {
        const primaryEmail = user.emailAddresses[0]?.emailAddress
        const name = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username || "User"

        if (primaryEmail) {
          const { data: newUser, error: insertError } = await supabase
            .from("users")
            .insert({
              clerk_id: user.id,
              email: primaryEmail,
              name,
              image_url: user.imageUrl,
              provider: "clerk",
              email_verified: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (insertError) {
            console.error("Error creating user in Supabase:", insertError)
            return null
          }

          return newUser
        }
      }

      return null
    }

    return supabaseUser
  } catch (error) {
    console.error("Error in getCurrentUser:", error)
    return null
  }
}
