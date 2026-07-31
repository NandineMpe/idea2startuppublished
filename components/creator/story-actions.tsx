"use client"

import { ItemActions } from "@/components/creator/item-actions"

/**
 * Clear a story once it is dealt with.
 *
 * Thin wrapper over the shared control so the tooltip can say what archiving a
 * story specifically does: the thesis stays on the synthesis do-not-repeat list,
 * which is what stops the same take resurfacing next week. Any Desk item the
 * story was promoted to moves with it.
 */
export function StoryActions({ storyId }: { storyId: string }) {
  return (
    <ItemActions
      entity="story"
      id={storyId}
      noun="story"
      archiveHint="Archive — keeps the thesis so it is not proposed again"
    />
  )
}
