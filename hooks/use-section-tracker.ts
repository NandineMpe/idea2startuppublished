"use client"

import { useEffect } from "react"
import { trackSectionVisit, markSectionInProgress, markSectionCompleted } from "@/app/actions/user-data"

interface UseSectionTrackerOptions {
  markInProgress?: boolean
  markCompleted?: boolean
}

export function useSectionTracker(sectionName: string, options: UseSectionTrackerOptions = {}) {
  useEffect(() => {
    const track = async () => {
      // Track the visit
      await trackSectionVisit(sectionName)

      // Optionally mark as in-progress
      if (options.markInProgress) {
        await markSectionInProgress(sectionName)
      }

      // Optionally mark as completed
      if (options.markCompleted) {
        await markSectionCompleted(sectionName)
      }
    }

    track()
  }, [sectionName, options.markInProgress, options.markCompleted])

  const completeSection = async () => {
    await markSectionCompleted(sectionName)
  }

  return { completeSection }
}
