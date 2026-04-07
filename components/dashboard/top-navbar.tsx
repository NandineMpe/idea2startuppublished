"use client"

import { useEffect, useState } from "react"
import {
  Search,
  Bell,
  Mail,
  Settings,
  LogOut,
  User as UserIcon,
  Command,
  CreditCard,
  Gift,
} from "lucide-react"
import Link from "next/link"
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
import { authClient } from "@/lib/better-auth-client"
import { createClient } from "@/lib/supabase/client"
import { InviteFriendsDialog } from "@/components/dashboard/invite-friends-dialog"
import { User } from "@supabase/supabase-js"

export function TopNavbar() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [supabase] = useState(() => createClient())
  const [inviteFriendsOpen, setInviteFriendsOpen] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [supabase])

  const handleSignOut = async () => {
    try {
      await authClient.signOut()
    } catch {
      // Best effort so Better Auth cookies do not linger if the route is unavailable.
    }

    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const userEmail = user?.email || "guest@ideatostartup.io"
  const userInitials = userEmail.substring(0, 2).toUpperCase()
  const userName = user?.user_metadata?.full_name || userEmail.split("@")[0]

  return (
    <header className="sticky top-0 z-40 flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button className="flex w-64 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground">
          <Search className="h-3.5 w-3.5" />
          <span>Search intelligence...</span>
          <kbd className="ml-auto flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground/60">
            <Command className="h-2.5 w-2.5" /> K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="relative h-8 w-8 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </Button>

        <Button variant="ghost" size="sm" className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-foreground" asChild>
          <Link
            href="/dashboard/integrations"
            title="Email and integrations (Gmail and more)"
            aria-label="Open email and integrations"
          >
            <Mail className="h-4 w-4" />
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full p-0 transition-all hover:ring-2 hover:ring-border"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src="" alt={userName} />
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 border-border bg-popover" align="end" forceMount>
            <DropdownMenuLabel className="p-3 font-normal">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <p className="truncate text-sm font-medium capitalize text-foreground">
                    {userName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer px-3 py-2 text-[13px]"
              onSelect={() => setInviteFriendsOpen(true)}
            >
              <Gift className="mr-2.5 h-4 w-4 text-muted-foreground" />
              Invite friends
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer px-3 py-2 text-[13px]">
              <UserIcon className="mr-2.5 h-4 w-4 text-muted-foreground" />
              Founder Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer px-3 py-2 text-[13px]"
              onClick={() => router.push("/dashboard/settings")}
            >
              <Settings className="mr-2.5 h-4 w-4 text-muted-foreground" />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer px-3 py-2 text-[13px]"
              onClick={() => router.push("/paywall")}
            >
              <CreditCard className="mr-2.5 h-4 w-4 text-muted-foreground" />
              Billing & Access
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer px-3 py-2 text-[13px] text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2.5 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <InviteFriendsDialog open={inviteFriendsOpen} onOpenChange={setInviteFriendsOpen} />
    </header>
  )
}
