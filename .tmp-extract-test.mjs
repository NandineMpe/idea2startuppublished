
import { qwenGenerateObject } from "./lib/careeros/ai/qwen.ts"
import { ProfileExtractionSchema } from "./lib/careeros/schemas/profile-extraction.v1.ts"
import { PROFILE_EXTRACT_SYSTEM_PROMPT, buildProfileExtractUserPrompt } from "./lib/careeros/prompts/profile-extract.v1.ts"

const userPrompt = buildProfileExtractUserPrompt({
  resumeText: null,
  linkedinText: null,
  llmMarkdownText: process.env.TEST_MD,
  userStatedRole: "3 PQE Solicitor",
  userStatedYearsExperience: 3,
})
try {
  const result = await qwenGenerateObject({
    schema: ProfileExtractionSchema,
    systemPrompt: PROFILE_EXTRACT_SYSTEM_PROMPT,
    userPrompt,
  })
  console.log("OK skills:", result.object.skills?.length, "roles:", result.object.past_roles?.length)
  console.log("sample:", JSON.stringify(result.object.skills?.slice(0,3), null, 2))
} catch (e) {
  console.error("FAIL:", e instanceof Error ? e.message : e)
  if (e?.cause) console.error("cause:", e.cause)
  process.exit(1)
}
