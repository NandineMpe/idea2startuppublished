import { ReadableStream } from "stream/web"

export function GeminiStream(response: Response): ReadableStream<Uint8Array> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error("Response body is not readable")
  }

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            break
          }

          // Parse the chunk as text
          const text = new TextDecoder().decode(value)

          try {
            // Parse the text as JSON
            const lines = text
              .split("\n")
              .filter((line) => line.trim() !== "")
              .map((line) => {
                try {
                  return JSON.parse(line)
                } catch (e) {
                  return null
                }
              })
              .filter(Boolean)

            // Process each line
            for (const line of lines) {
              if (line.error) {
                throw new Error(line.error.message || "Unknown error")
              }

              if (line.candidates?.[0]?.content?.parts?.[0]?.text) {
                const content = line.candidates[0].content.parts[0].text
                const bytes = new TextEncoder().encode(content)
                controller.enqueue(bytes)
              }
            }
          } catch (e) {
            // If JSON parsing fails, just pass through the raw text
            controller.enqueue(value)
          }
        }
        controller.close()
      } catch (e) {
        controller.error(e)
      }
    },
    async cancel() {
      reader.cancel()
    },
  })
}
