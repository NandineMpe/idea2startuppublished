type SourcePingResult = {
  ok: boolean
  status: number
  sample: unknown
  error?: string
}

export async function pingLayoffsFyi(): Promise<SourcePingResult> {
  return {
    ok: true,
    status: 200,
    sample: "stub - dataset access via Kaggle in Phase 4",
  }
}
