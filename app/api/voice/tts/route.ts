import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { NextRequest, NextResponse } from 'next/server'

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
})

export async function POST(req: NextRequest) {
  const { text, voiceId = 'JBFqnCBsd6RMkjVDRZzb' } = await req.json()

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  const audio = await elevenlabs.textToSpeech.convert(voiceId, {
    text,
    modelId: 'eleven_flash_v2_5', // ~75% lower latency than multilingual_v2
    outputFormat: 'mp3_22050_32',  // lower bitrate = faster first byte
  })

  // Stream chunks directly — no buffering
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of audio) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
