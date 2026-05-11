import { z } from "zod"

export const PersonalisedNoteSchema = z.object({
  note: z.string().min(20).max(700),
  suggested_action: z.string().min(5).max(200).optional().nullable(),
})

export const PERSONALISED_NOTE_SCHEMA_VERSION = 1
