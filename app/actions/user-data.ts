"use server"

import { kv } from "@vercel/kv"
import { cookies } from "next/headers"
import { v4 as uuidv4 } from "uuid"

// Comprehensive user data interface to cover all features
export interface UserData {
  id: string
  lastActive: number

  // Business idea analyzer data
  businessIdea?: {
    problem: string
    solution: string
    audience?: string
    location?: string
    analysis?: any
  }

  // Chat history
  chatHistory?: {
    messages: Array<{
      role: "user" | "assistant"
      content: string
      timestamp: number
    }>
  }

  // Pitch data
  pitchData?: {
    elevatorPitch?: string
    investorPitch?: string
    customerPitch?: string
    networkingPitch?: string
    fullPitch?: any
  }

  // Market analysis data
  marketAnalysis?: {
    competitorAnalysis?: any
    marketSize?: any
    goToMarket?: any
    consumerInsights?: any
  }

  // Knowledge base interactions
  knowledgeInteractions?: {
    foundersJourney?: {
      completed: boolean
      notes?: string
    }
    domainKnowledge?: {
      completed: boolean
      notes?: string
    }
    feedback?: {
      submitted: string[]
      insights?: any
    }
  }

  // User settings
  settings?: {
    theme?: "light" | "dark"
    notifications?: boolean
    emailUpdates?: boolean
  }

  // Dashboard state
  dashboardState?: {
    lastVisitedSection?: string
    completedSections?: string[]
    inProgressSections?: string[]
  }
}

// Log KV connection status for debugging
const logKvStatus = async () => {
  try {
    // Simple ping to check connection
    await kv.ping()
    console.log("KV connection successful")
    return true
  } catch (error) {
    console.error("KV connection failed:", error)
    return false
  }
}

// Get or create user ID from cookies
export async function getUserId(): Promise<string> {
  const cookieStore = cookies()
  let userId = cookieStore.get("user_id")?.value

  if (!userId) {
    userId = uuidv4()
    // Set cookie with a long expiration (1 year)
    cookieStore.set("user_id", userId, {
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
      path: "/",
      sameSite: "lax",
    })
  }

  return userId
}

// Get user data from KV
export async function getUserData(): Promise<UserData | null> {
  try {
    const userId = await getUserId()
    if (!userId) return null

    // Check KV connection
    const isConnected = await logKvStatus()
    if (!isConnected) {
      throw new Error("KV connection failed")
    }

    const userData = await kv.get<UserData>(`user:${userId}`)
    return userData
  } catch (error) {
    console.error("Error getting user data:", error)
    return null
  }
}

// Save user data to KV
export async function saveUserData(data: Partial<UserData>): Promise<boolean> {
  try {
    const userId = await getUserId()
    if (!userId) return false

    // Check KV connection
    const isConnected = await logKvStatus()
    if (!isConnected) {
      throw new Error("KV connection failed")
    }

    // Get existing data first
    const existingData = await kv.get<UserData>(`user:${userId}`)

    // Merge with new data
    const updatedData: UserData = {
      ...(existingData || {}),
      ...data,
      id: userId,
      lastActive: Date.now(),
    } as UserData

    await kv.set(`user:${userId}`, updatedData)
    return true
  } catch (error) {
    console.error("Error saving user data:", error)
    return false
  }
}

// Save chat message
export async function saveChatMessage(message: { role: "user" | "assistant"; content: string }): Promise<boolean> {
  try {
    const userData = await getUserData()

    const chatHistory = userData?.chatHistory?.messages || []

    const updatedChatHistory = [
      ...chatHistory,
      {
        ...message,
        timestamp: Date.now(),
      },
    ]

    return await saveUserData({
      chatHistory: {
        messages: updatedChatHistory,
      },
    })
  } catch (error) {
    console.error("Error saving chat message:", error)
    return false
  }
}

// Get chat history
export async function getChatHistory(): Promise<Array<{
  role: "user" | "assistant"
  content: string
  timestamp: number
}> | null> {
  try {
    const userData = await getUserData()
    return userData?.chatHistory?.messages || null
  } catch (error) {
    console.error("Error getting chat history:", error)
    return null
  }
}

// Business Idea functions
export async function saveBusinessIdea(businessIdea: UserData["businessIdea"]): Promise<boolean> {
  try {
    return await saveUserData({
      businessIdea,
    })
  } catch (error) {
    console.error("Error saving business idea:", error)
    return false
  }
}

export async function getBusinessIdea(): Promise<UserData["businessIdea"] | null> {
  try {
    const userData = await getUserData()
    return userData?.businessIdea || null
  } catch (error) {
    console.error("Error getting business idea:", error)
    return null
  }
}

// Pitch data functions
export async function savePitchData(pitchData: Partial<UserData["pitchData"]>): Promise<boolean> {
  try {
    const userData = await getUserData()
    const existingPitchData = userData?.pitchData || {}

    return await saveUserData({
      pitchData: {
        ...existingPitchData,
        ...pitchData,
      },
    })
  } catch (error) {
    console.error("Error saving pitch data:", error)
    return false
  }
}

export async function getPitchData(): Promise<UserData["pitchData"] | null> {
  try {
    const userData = await getUserData()
    return userData?.pitchData || null
  } catch (error) {
    console.error("Error getting pitch data:", error)
    return null
  }
}

// Market analysis functions
export async function saveMarketAnalysis(marketAnalysis: Partial<UserData["marketAnalysis"]>): Promise<boolean> {
  try {
    const userData = await getUserData()
    const existingMarketAnalysis = userData?.marketAnalysis || {}

    return await saveUserData({
      marketAnalysis: {
        ...existingMarketAnalysis,
        ...marketAnalysis,
      },
    })
  } catch (error) {
    console.error("Error saving market analysis:", error)
    return false
  }
}

export async function getMarketAnalysis(): Promise<UserData["marketAnalysis"] | null> {
  try {
    const userData = await getUserData()
    return userData?.marketAnalysis || null
  } catch (error) {
    console.error("Error getting market analysis:", error)
    return null
  }
}

// Knowledge interactions functions
export async function saveKnowledgeInteraction(
  section: keyof UserData["knowledgeInteractions"],
  data: any,
): Promise<boolean> {
  try {
    const userData = await getUserData()
    const existingInteractions = userData?.knowledgeInteractions || {}

    return await saveUserData({
      knowledgeInteractions: {
        ...existingInteractions,
        [section]: data,
      },
    })
  } catch (error) {
    console.error(`Error saving knowledge interaction for ${section}:`, error)
    return false
  }
}

export async function getKnowledgeInteractions(): Promise<UserData["knowledgeInteractions"] | null> {
  try {
    const userData = await getUserData()
    return userData?.knowledgeInteractions || null
  } catch (error) {
    console.error("Error getting knowledge interactions:", error)
    return null
  }
}

// User settings functions
export async function saveUserSettings(settings: any): Promise<boolean> {
  try {
    const userData = await getUserData()
    const existingSettings = userData?.settings || {}

    // Handle nested settings like notifications
    const updatedSettings = { ...existingSettings }

    // Process flat settings
    Object.keys(settings).forEach((key) => {
      if (typeof settings[key] !== "object" || settings[key] === null) {
        updatedSettings[key] = settings[key]
      }
    })

    // Process nested settings
    if (settings.notifications) {
      updatedSettings.notifications = {
        ...(existingSettings.notifications || {}),
        ...settings.notifications,
      }
    }

    return await saveUserData({
      settings: updatedSettings,
    })
  } catch (error) {
    console.error("Error saving user settings:", error)
    return false
  }
}

export async function getUserSettings(): Promise<UserData["settings"] | null> {
  try {
    const userData = await getUserData()
    return userData?.settings || null
  } catch (error) {
    console.error("Error getting user settings:", error)
    return false
  }
}

// Dashboard state functions
export async function saveDashboardState(state: Partial<UserData["dashboardState"]>): Promise<boolean> {
  try {
    const userData = await getUserData()
    const existingState = userData?.dashboardState || {}

    return await saveUserData({
      dashboardState: {
        ...existingState,
        ...state,
      },
    })
  } catch (error) {
    console.error("Error saving dashboard state:", error)
    return false
  }
}

export async function getDashboardState(): Promise<UserData["dashboardState"] | null> {
  try {
    const userData = await getUserData()
    return userData?.dashboardState || null
  } catch (error) {
    console.error("Error getting dashboard state:", error)
    return false
  }
}

// Track section visit
export async function trackSectionVisit(sectionName: string): Promise<boolean> {
  try {
    const dashboardState = (await getDashboardState()) || {}

    return await saveDashboardState({
      ...dashboardState,
      lastVisitedSection: sectionName,
    })
  } catch (error) {
    console.error("Error tracking section visit:", error)
    return false
  }
}

// Mark section as completed
export async function markSectionCompleted(sectionName: string): Promise<boolean> {
  try {
    const dashboardState = (await getDashboardState()) || {}
    const completedSections = dashboardState.completedSections || []

    if (!completedSections.includes(sectionName)) {
      completedSections.push(sectionName)
    }

    // Remove from in-progress if it exists there
    const inProgressSections = dashboardState.inProgressSections || []
    const updatedInProgress = inProgressSections.filter((s) => s !== sectionName)

    return await saveDashboardState({
      ...dashboardState,
      completedSections,
      inProgressSections: updatedInProgress,
    })
  } catch (error) {
    console.error("Error marking section as completed:", error)
    return false
  }
}

// Mark section as in-progress
export async function markSectionInProgress(sectionName: string): Promise<boolean> {
  try {
    const dashboardState = (await getDashboardState()) || {}
    const inProgressSections = dashboardState.inProgressSections || []

    if (!inProgressSections.includes(sectionName)) {
      inProgressSections.push(sectionName)
    }

    return await saveDashboardState({
      ...dashboardState,
      inProgressSections,
    })
  } catch (error) {
    console.error("Error marking section as in-progress:", error)
    return false
  }
}
