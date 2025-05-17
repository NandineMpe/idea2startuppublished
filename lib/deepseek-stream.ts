import { createParser, type ParsedEvent, type ReconnectInterval } from "eventsource-parser"

export interface DeepseekChatCompletionChunk {
  id: string
  object: string
  created: number
  model: string
  choices: {
    index: number
    delta: {
      content?: string
      role?: string
    }
    finish_reason: null | string
  }[]
}

export async function DeepseekStream(res: Response) {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      // callback
      function onParse(event: ParsedEvent | ReconnectInterval) {
        if (event.type === "event") {
          const data = event.data
          // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
          if (data === "[DONE]") {
            controller.close()
            return
          }
          try {
            const json = JSON.parse(data) as DeepseekChatCompletionChunk
            const text = json.choices[0]?.delta?.content || ""
            const queue = encoder.encode(text)
            controller.enqueue(queue)
          } catch (e) {
            // maybe parse error
            controller.error(e)
          }
        }
      }

      // stream response (SSE) from Deepseek may be fragmented into multiple chunks
      // this ensures we properly read chunks and invoke an event for each SSE event stream
      const parser = createParser(onParse)
      // https://web.dev/streams/#asynchronous-iteration
      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk))
      }
    },
  })

  return stream
}

export function StreamingTextResponse(res: ReadableStream) {
  return new Response(res, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}
