import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

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
    modelId: 'eleven_flash_v2_5',
    outputFormat: 'mp3_44100_128', // universally supported by browsers
  })

  const chunks: Uint8Array[] = []
  for await (const chunk of audio) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'no-store',
    },
  })
}
