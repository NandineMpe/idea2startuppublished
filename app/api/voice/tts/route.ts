import { NextRequest, NextResponse } from 'next/server'
import { createElevenLabsClient } from '@/lib/voice/elevenlabs'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { text, voiceId = 'JBFqnCBsd6RMkjVDRZzb' } = await req.json()

  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  // Constructed per request: the SDK throws on a missing key, and at module
  // scope that failure happens during `next build` page-data collection and
  // takes down the whole build rather than this one route.
  const elevenlabs = createElevenLabsClient()
  if (!elevenlabs) {
    return NextResponse.json({ error: 'ELEVENLABS_API_KEY is not configured' }, { status: 503 })
  }

  try {
    const audio = await elevenlabs.textToSpeech.convert(voiceId, {
      text,
      modelId: 'eleven_flash_v2_5',
      outputFormat: 'mp3_44100_128',
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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[TTS] ElevenLabs error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
