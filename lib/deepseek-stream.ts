import { createParser } from "eventsource-parser"

export function DeepseekStream(res: Response) {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let controller: ReadableStreamController<Uint8Array>
  const parser = createParser((event) => {
    if (event.type === "event" && event.data !== "[DONE]") {
      try {
        const data = JSON.parse(event.data)
        const text = data.choices[0]?.delta?.content || ""
        const queue = encoder.encode(text)
        controller.enqueue(queue)
      } catch (e) {
        controller.error(e)
      }
    } else if (event.type === "event" && event.data === "[DONE]") {
      controller.close()
    }
  })

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl
      // Feed the response body to the parser
      function onParse(chunk: Uint8Array) {
        parser.feed(decoder.decode(chunk))
      }

      // Handle the response stream
      const reader = res.body?.getReader()
      if (!reader) {
        controller.close()
        return
      }

      function push() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              controller.close()
              return
            }
            onParse(value)
            push()
          })
          .catch((err) => {
            controller.error(err)
          })
      }

      push()
    },
  })

  return stream
}
