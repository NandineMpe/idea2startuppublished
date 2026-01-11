"use client"

import { useState } from "react"
import { Search, Bell, Settings, LogOut, User, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"

export function TopNavbar() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")

  const handleSignOut = () => {
    router.push("/")
  }

  const user = {
    fullName: "Guest Founder",
    imageUrl: "", // Empty string will trigger fallback
    email: "founder@ideatostartup.io",
    isVerified: false,
    joinDate: "2026"
  }

  return (
    <header className="bg-black/40 backdrop-blur-md border-b border-white/5 sticky top-0 z-40 transition-all duration-300">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Search */}
        <div className="flex items-center flex-1 max-w-md group">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 group-focus-within:text-primary transition-colors h-4 w-4" />
            <Input
              type="text"
              placeholder="Track your progress..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary/50 focus:ring-primary/20 transition-all duration-300 rounded-full h-10 w-full"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-6">
          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative text-white/70 hover:text-primary hover:bg-white/5 transition-all duration-300">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(39,174,96,0.6)]"></span>
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-white/10 hover:border-primary/50 transition-all duration-300 p-0">
                <Avatar className="h-full w-full">
                  <AvatarImage src={user.imageUrl} alt={user.fullName} />
                  <AvatarFallback className="bg-primary text-black font-bold">FE</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80 bg-black/90 backdrop-blur-xl border border-white/10 text-white shadow-2xl" align="end" forceMount>
              <DropdownMenuLabel className="font-normal p-4">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10 border border-primary/20">
                      <AvatarImage src={user.imageUrl} />
                      <AvatarFallback className="bg-primary text-black">FE</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-white">{user.fullName}</p>
                      <p className="text-xs text-white/50">{user.email}</p>
                    </div>
                  </div>

                  {user.isVerified && (
                    <Badge variant="secondary" className="bg-primary/20 text-primary border-none text-[10px] w-fit">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified Founder
                    </Badge>
                  )}

                  <div className="flex items-center space-x-2 text-[10px] text-white/40 pt-1">
                    <span>Member since {user.joinDate}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem className="p-3 focus:bg-white/5 cursor-pointer">
                <User className="mr-3 h-4 w-4 text-primary" />
                <span className="text-sm">Founder Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-3 focus:bg-white/5 cursor-pointer">
                <Settings className="mr-3 h-4 w-4 text-primary" />
                <span className="text-sm">Account Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={handleSignOut} className="p-3 focus:bg-red-500/10 text-red-400 cursor-pointer">
                <LogOut className="mr-3 h-4 w-4" />
                <span className="text-sm font-medium">Exit Dashboard</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
