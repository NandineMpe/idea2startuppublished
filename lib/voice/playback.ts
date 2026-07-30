"use client"

let audioCtx: AudioContext | null = null
let audioSource: AudioBufferSourceNode | null = null

/** Call inside a click handler before any await (browser autoplay policy). */
export function unlockAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext()
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume()
  }
  return audioCtx
}

export function stopSpeechPlayback(): void {
  try {
    audioSource?.stop()
  } catch {
    // already stopped
  }
  audioSource = null
}

export async function playSpeechFromTtsRoute(
  text: string,
  options?: { endpoint?: string; onEnd?: () => void },
): Promise<boolean> {
  stopSpeechPlayback()
  const ctx = unlockAudioContext()
  if (!ctx) {
    options?.onEnd?.()
    return false
  }

  const endpoint = options?.endpoint ?? "/api/careeros/voice/tts"

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text }),
    })
    if (!res.ok) {
      options?.onEnd?.()
      return false
    }

    const arrayBuffer = await res.arrayBuffer()
    if (ctx.state === "suspended") await ctx.resume()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    source.onended = () => {
      audioSource = null
      options?.onEnd?.()
    }
    audioSource = source
    source.start(0)
    return true
  } catch {
    options?.onEnd?.()
    return false
  }
}
