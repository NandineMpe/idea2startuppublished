export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

export function rankByEmbedding<T extends { id: string }>(
  queryVec: number[],
  candidates: Array<T & { embedding: number[] }>,
  topK: number,
): Array<T & { embedding: number[]; similarity: number }> {
  return candidates
    .map((c) => ({ ...c, similarity: cosineSimilarity(queryVec, c.embedding) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
}
