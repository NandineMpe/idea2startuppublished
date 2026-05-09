import { createHash } from "crypto"

export function sha256Hex(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input
  return createHash("sha256").update(buf).digest("hex")
}
