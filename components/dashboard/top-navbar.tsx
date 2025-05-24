"use client"

import { Bell, Grid, HelpCircle, Search, User, Construction, ArrowUpRightIcon } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Announcement, AnnouncementTag, AnnouncementTitle } from "@/components/ui/announcement"

export function TopNavbar() {
  return (
    <div className="flex h-16 items-center justify-between border-b border-primary/10 bg-black px-6">
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative h-8 w-8">
            <Image
              src="https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/ideatostartup%20logo-T5tDhi08w5P7UbKugr2K20yDZbMe4h.png"
              alt="IdeaToStartup Logo"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <span className="text-xl font-bold text-white">ideatostartup.io</span>
        </Link>
      </div>

      <div className="flex-1 mx-4 flex justify-center items-center">
        <Announcement themed className="bg-yellow-900/20 text-yellow-500 border-yellow-500/30 animate-pulse">
          <AnnouncementTag className="bg-yellow-500/20 text-yellow-400">
            <Construction className="h-3 w-3 mr-1 inline" />
            Alert
          </AnnouncementTag>
          <AnnouncementTitle>
            This app is under insane construction!
            <ArrowUpRightIcon size={16} className="shrink-0 opacity-70" />
          </AnnouncementTitle>
        </Announcement>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-[300px] pl-10 pr-4 py-2 glass-input rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 border-primary/10"
          />
        </div>

        <Button variant="ghost" size="icon" className="text-white hover:text-primary hover:bg-primary/10 rounded-full">
          <Bell className="h-5 w-5" />
        </Button>

        <Button variant="ghost" size="icon" className="text-white hover:text-primary hover:bg-primary/10 rounded-full">
          <HelpCircle className="h-5 w-5" />
        </Button>

        <Link href="/dashboard">
          <Button
            variant="outline"
            size="sm"
            className="hidden md:flex items-center gap-2 border-primary/20 bg-black hover:bg-primary/10 hover:border-primary/50 rounded-full"
          >
            <Grid className="h-4 w-4 text-primary" />
            <span className="text-white">My Dashboard</span>
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full overflow-hidden border border-primary/20 hover:border-primary/50"
            >
              <User className="h-5 w-5 text-primary" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass border-primary/20 w-56">
            <DropdownMenuLabel className="text-white">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-primary/20" />
            <DropdownMenuItem className="text-white hover:text-primary focus:text-primary hover:bg-primary/10 focus:bg-primary/10 cursor-pointer">
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="text-white hover:text-primary focus:text-primary hover:bg-primary/10 focus:bg-primary/10 cursor-pointer">
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="text-white hover:text-primary focus:text-primary hover:bg-primary/10 focus:bg-primary/10 cursor-pointer">
              Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-primary/20" />
            <DropdownMenuItem className="text-white hover:text-primary focus:text-primary hover:bg-primary/10 focus:bg-primary/10 cursor-pointer">
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
