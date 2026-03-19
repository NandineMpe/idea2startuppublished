"use client"

import { useParams } from "next/navigation"
import { ROLE_CONFIGS } from "@/lib/paperclip"
import { RolePage } from "@/components/dashboard/role-page"
import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function TeamRolePage() {
  const params = useParams()
  const roleSlug = params.role as string
  const config = ROLE_CONFIGS[roleSlug]

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-2xl font-bold text-white mb-2">Role not found</h1>
          <p className="text-white/50 mb-6">The role &quot;{roleSlug}&quot; doesn&apos;t exist in your organization.</p>
          <Link
            href="/dashboard/team"
            className="text-primary hover:text-primary/80 flex items-center gap-2 justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Team Overview
          </Link>
        </motion.div>
      </div>
    )
  }

  return <RolePage config={config} />
}
