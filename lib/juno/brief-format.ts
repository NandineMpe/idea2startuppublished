/** WhatsApp-friendly truncation (Twilio segment limits). */
export function formatBriefForWhatsApp(markdown: string, maxLen = 1550): string {
  const plain = markdown.replace(/#{1,6}\s+/g, "").replace(/\*\*/g, "")
  if (plain.length <= maxLen) return plain
  return plain.slice(0, maxLen - 1) + "…"
}
