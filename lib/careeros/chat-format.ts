/**
 * Plain-text cleanup for Juno CareerOS chat (no markdown asterisks in the UI).
 */
export function stripCareerChatMarkdown(text: string): string {
  let s = text

  // Bold **text** and __text__
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1")
  s = s.replace(/__([^_]+)__/g, "$1")

  // Italic *word* (avoid touching list bullets at line start)
  s = s.replace(/(?<![*\w])\*([^*\n]+)\*(?![*])/g, "$1")

  // Stray emphasis markers
  s = s.replace(/\*\*/g, "")
  s = s.replace(/__/g, "")

  // Markdown headings
  s = s.replace(/^#{1,6}\s+/gm, "")

  // Inline code backticks
  s = s.replace(/`([^`]+)`/g, "$1")

  return s.trim()
}
