# ElevenLabs ConvAI — Juno CareerOS

Agent: **My Agent**  
Agent ID: `agent_6601ks30cwkzfw6t48433aw8w5yq`

## What we use in this app

| Deploy doc method | In CareerOS? | Where |
|-----------------|--------------|--------|
| **3. Embeddable widget** | Yes (primary) | `CareerConvaiFloatingLoader` → official ElevenLabs FAB |
| **1. React SDK (@elevenlabs/client)** | Optional | `career-convai-sdk-floating.tsx` (not mounted by default) |
| **6. WebRTC** | Yes | Widget `use-rtc="true"` for public agents; token via `/api/careeros/voice/session` for SDK path |
| **1. React SDK** | Partial | `@elevenlabs/client` in `career-voice-agent.tsx` (not mounted; widget is default) |
| Custom LLM (same brain as text chat) | Yes | `POST /api/careeros/voice/llm/v1/chat/completions` |
| Career context | Yes | `dynamic-variables` → `{{career_context}}` on the agent |
| Text + voice in widget | Yes | `text-input` + `transcript` attributes |

Not used in-app: React Native, Python SDK, raw WebSocket (handled inside widget/SDK).

## Vercel env

```env
ELEVENLABS_API_KEY=...          # Must be valid; 401 in ElevenLabs log = regenerate key in dashboard → Vercel
ELEVENLABS_CAREEROS_AGENT_ID=agent_6601ks30cwkzfw6t48433aw8w5yq
ELEVENLABS_CAREEROS_LLM_SECRET=...          # Bearer for custom LLM endpoint
ELEVENLABS_CAREEROS_AGENT_REQUIRES_AUTH=false  # true only if agent auth is ON in ElevenLabs
NEXT_PUBLIC_ELEVENLABS_CAREEROS_AGENT_ID=agent_6601ks30cwkzfw6t48433aw8w5yq
NEXT_PUBLIC_ELEVENLABS_SERVER_LOCATION=us  # must match agent (us → api.us.elevenlabs.io)
NEXT_PUBLIC_ELEVENLABS_USE_RTC=false  # default: widget websocket; set true to force WebRTC
ELEVENLABS_CAREEROS_FETCH_CONVERSATION_TOKEN=false  # optional server token fetch (not needed for public widget)
```

## ElevenLabs dashboard (agent)

1. **System prompt** — paste `CAREEROS_ELEVENLABS_AGENT_PROMPT` from `lib/careeros/careeros-elevenlabs-voice-prompt.ts` (must keep `{{career_context}}`). Or copy from `GET /api/careeros/voice/session` field `agentPromptTemplate`.
2. **Custom LLM** (recommended for parity with text chat):
   - URL: `https://usejuno-ai.com/api/careeros/voice/llm/v1/chat/completions`
   - Auth header: `Authorization: Bearer <ELEVENLABS_CAREEROS_LLM_SECRET>`
   - Streaming: required (`stream: true`)
   - **Custom LLM extra body** (enable in agent): `{ "user_id": "{{user_id}}" }` so each turn reloads CareerOS data from Supabase (same as text chat).
3. **Auth**
   - **Public** (default): disable auth, keep `ELEVENLABS_CAREEROS_AGENT_REQUIRES_AUTH=false` → widget uses `agent-id` + WebRTC.
   - **Private**: enable auth, set `ELEVENLABS_CAREEROS_AGENT_REQUIRES_AUTH=true`, allowlist `https://usejuno-ai.com` → app passes `signed-url` (websocket).
4. **Widget / RTC** — enable WebRTC in agent widget settings if not using `use-rtc` attribute alone.

## Widget embed (matches deploy snippet)

```html
<elevenlabs-convai agent-id="agent_6601ks30cwkzfw6t48433aw8w5yq"></elevenlabs-convai>
<script src="https://elevenlabs.io/convai-widget/index.js" async type="text/javascript"></script>
```

Our loader tries that CDN first, then `unpkg.com/@elevenlabs/convai-widget-embed`.

## APIs

- `GET /api/careeros/voice/session` — signed URL, career context snippet, `userId`, `agentId`
- `POST /api/careeros/voice/llm/v1/chat/completions` — OpenAI-style SSE for custom LLM
- `POST /api/careeros/chat` — text CareerOS brain (still available for other surfaces)

## Navbar

Brain icon in `CareerTopNavbar` calls `startCareerConvaiConversation()` on the floating widget.
