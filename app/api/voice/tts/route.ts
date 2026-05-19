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
    modelId: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
  })

  // Collect the async iterable into a buffer
  const chunks: Uint8Array[] = []
  for await (const chunk of audio) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length.toString(),
    },
  })
}
