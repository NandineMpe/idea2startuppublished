"use client"

import { useState, useEffect } from "react"
import { Search, Bell, Settings, LogOut, User as UserIcon, Command } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { User } from "@supabase/supabase-js"

export function TopNavbar() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  const userEmail = user?.email || "guest@ideatostartup.io"
  const userInitials = userEmail.substring(0, 2).toUpperCase()
  const userName = user?.user_metadata?.full_name || userEmail.split("@")[0]

  return (
    <header className="h-[52px] border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-4 shrink-0">
      {/* Search trigger */}
      <button className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground bg-surface-2 hover:bg-surface-3 border border-border rounded-md px-3 py-1.5 transition-colors w-64">
        <Search className="h-3.5 w-3.5" />
        <span>Search intelligence…</span>
        <kbd className="ml-auto text-[11px] text-muted-foreground/60 bg-background border border-border rounded px-1.5 py-0.5 font-mono flex items-center gap-0.5">
          <Command className="h-2.5 w-2.5" /> K
        </kbd>
      </button>

      {/* Right side */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-primary rounded-full" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0 hover:ring-2 hover:ring-border transition-all">
              <Avatar className="h-7 w-7">
                <AvatarImage src="" alt={userName} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{userInitials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 bg-popover border-border" align="end" forceMount>
            <DropdownMenuLabel className="font-normal p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <p className="text-sm font-medium text-foreground capitalize truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="py-2 px-3 cursor-pointer text-[13px]">
              <UserIcon className="mr-2.5 h-4 w-4 text-muted-foreground" />
              Founder Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="py-2 px-3 cursor-pointer text-[13px]">
              <Settings className="mr-2.5 h-4 w-4 text-muted-foreground" />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="py-2 px-3 cursor-pointer text-[13px] text-destructive focus:text-destructive">
              <LogOut className="mr-2.5 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
