import { kv } from "@vercel/kv"

// User data interface
export interface UserData {
  id: string
  businessIdea?: {
    problem: string
    solution: string
    audience?: string
    location?: string
    analysis?: any
  }
  chatHistory?: {
    messages: Array<{
      role: "user" | "assistant"
      content: string
      timestamp: number
    }>
  }
  lastActive: number
}

// Generate a unique user ID if one doesn't exist
export const getUserId = (): string => {
  if (typeof window === "undefined") return ""

  let userId = localStorage.getItem("user_id")
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    localStorage.setItem("user_id", userId)
  }
  return userId
}

// Save user data to KV store
export const saveUserData = async (userData: Partial<UserData>): Promise<void> => {
  try {
    const userId = getUserId()
    if (!userId) return

    // Get existing data first
    const existingData = await kv.get<UserData>(`user:${userId}`)

    // Merge with new data
    const updatedData: UserData = {
      ...(existingData as UserData),
      ...userData,
      id: userId,
      lastActive: Date.now(),
    }

    await kv.set(`user:${userId}`, updatedData)
    console.log("User data saved successfully")
  } catch (error) {
    console.error("Error saving user data:", error)
  }
}

// Get user data from KV store
export const getUserData = async (): Promise<UserData | null> => {
  try {
    const userId = getUserId()
    if (!userId) return null

    const userData = await kv.get<UserData>(`user:${userId}`)
    return userData
  } catch (error) {
    console.error("Error getting user data:", error)
    return null
  }
}

// Save chat message to user data
export const saveChatMessage = async (message: { role: "user" | "assistant"; content: string }): Promise<void> => {
  try {
    const userId = getUserId()
    if (!userId) return

    const userData = await getUserData()

    const chatHistory = userData?.chatHistory?.messages || []

    const updatedChatHistory = [
      ...chatHistory,
      {
        ...message,
        timestamp: Date.now(),
      },
    ]

    await saveUserData({
      chatHistory: {
        messages: updatedChatHistory,
      },
    })
  } catch (error) {
    console.error("Error saving chat message:", error)
  }
}

// Save business idea data
export const saveBusinessIdea = async (businessIdea: UserData["businessIdea"]): Promise<void> => {
  try {
    await saveUserData({
      businessIdea,
    })
  } catch (error) {
    console.error("Error saving business idea:", error)
  }
}
