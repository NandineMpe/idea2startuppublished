import { ChevronRight } from "lucide-react"
import Link from "next/link"

import { ProgressBar } from "@/components/dashboard/progress-bar"
import { Button } from "@/components/ui/button"

interface ProjectCardProps {
  title: string
  progress: number
  stage: string
  updatedDays: number
  href: string
}

export function ProjectCard({ title, progress, stage, updatedDays, href }: ProjectCardProps) {
  return (
    <div className="space-y-4 p-4 rounded-lg border border-border/40 bg-background/30 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{title}</h3>
        <span className="text-sm text-muted-foreground">Updated {updatedDays} days ago</span>
      </div>
      <ProgressBar value={progress} />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Stage: {stage}</span>
        <span className="text-sm font-medium text-primary">{progress}%</span>
      </div>
      <Button variant="link" asChild className="px-0 text-primary hover:text-primary/80">
        <Link href={href}>
          View details <ChevronRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}
