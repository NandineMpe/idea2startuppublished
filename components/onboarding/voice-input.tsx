"use client"

type Props = {
  hasSpeechAPI: boolean
  isListening: boolean
  isJunoSpeaking: boolean
  textInput: string
  onTextChange: (v: string) => void
  onTextSubmit: () => void
  onMicDown: () => void
  onMicUp: () => void
}

export function VoiceInput({
  hasSpeechAPI,
  isListening,
  isJunoSpeaking,
  textInput,
  onTextChange,
  onTextSubmit,
  onMicDown,
  onMicUp,
}: Props) {
  return (
    <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-[680px] items-center gap-2 px-5 py-4">
        {hasSpeechAPI && (
          <button
            type="button"
            aria-label={isListening ? "Stop recording" : "Hold to speak"}
            onMouseDown={onMicDown}
            onMouseUp={onMicUp}
            onMouseLeave={onMicUp}
            onTouchStart={(e) => {
              e.preventDefault()
              onMicDown()
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              onMicUp()
            }}
            disabled={isJunoSpeaking}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg text-white transition-colors disabled:opacity-50 ${
              isListening ? "bg-red-500" : "bg-foreground"
            }`}
          >
            {isListening ? "■" : "🎤"}
          </button>
        )}
        <input
          type="text"
          value={textInput}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onTextSubmit()}
          placeholder={hasSpeechAPI ? "Or type here…" : "Type your response…"}
          disabled={isJunoSpeaking}
          className="flex-1 rounded-lg border border-input bg-background px-4 py-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onTextSubmit}
          disabled={!textInput.trim() || isJunoSpeaking}
          className="rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
      {hasSpeechAPI && (
        <p className="pb-3 text-center text-[11px] text-muted-foreground">
          Hold the mic button and speak, or type below
        </p>
      )}
    </div>
  )
}
