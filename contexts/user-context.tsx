"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { getUserData, saveUserData, type UserData } from "@/lib/kv"

interface UserContextType {
  userData: UserData | null
  loading: boolean
  updateUserData: (data: Partial<UserData>) => Promise<void>
}

const UserContext = createContext<UserContextType>({
  userData: null,
  loading: true,
  updateUserData: async () => {},
})

export const useUser = () => useContext(UserContext)

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const data = await getUserData()
        if (data) {
          setUserData(data)
        }
      } catch (error) {
        console.error("Error loading user data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [])

  const updateUserData = async (data: Partial<UserData>) => {
    try {
      await saveUserData(data)
      // Update local state
      setUserData((prev) => (prev ? { ...prev, ...data } : null))
    } catch (error) {
      console.error("Error updating user data:", error)
    }
  }

  return <UserContext.Provider value={{ userData, loading, updateUserData }}>{children}</UserContext.Provider>
}
