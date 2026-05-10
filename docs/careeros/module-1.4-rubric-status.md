# Module 1.4 — Skill Graph Storage: Rubric Status (codebase audit)

This document compares the **repository today** against the Module 1.4 success rubric. Operational items (5 production users, preview curls, benchmark runs) require human verification on deployed environments.

**Overall:** **Do not tick the curriculum box.** Critical gaps block Sections 3.1 (embeddings), 4 (embedding pipeline), 5 (vector quality at scale), and parts of 6–7 until addressed.

---

## Section 1 — Prerequisites

| Item | Status | Evidence |
|------|--------|----------|
| Module 1.1 | **Cannot verify from code** | Onboarding routes + `user_documents` / `user_profiles` writes exist; production adoption unknown. |
| Module 1.2 | **Partial** | `careeros/profile.extract` Inngest (`profile-extract.ts`) writes `user_document_extractions`, upserts `user_profiles`, inserts `user_skills`. Quality thresholds / eval report are operational. |
| Module 1.3 | **Partial** | `careeros/profile.onet-map` updates `onet_soc_code`, maps `onet_skill_id` where fuzzy match ≥ threshold. |
| 5 real users E2E | **Fail (unverified)** | Not observable in repo. |

**Gate:** Stop full validation until prerequisites are confirmed on production.

---

## Section 2 — Schema readiness

| Item | Status | Evidence |
|------|--------|----------|
| `user_profiles` shape | **Pass** | `careeros_20260509_phase1_foundations_identity_skill_graph.sql` |
| `user_skills` shape | **Pass** | Same migration + partial unique on `(user_id, canonical_skill_key) WHERE is_active` |
| `user_skill_embeddings` + vector(1536) | **Pass** | Phase 1 migration |
| HNSW index | **Pass** | `careeros_user_skill_embeddings_hnsw_idx` |
| Unique `(user_skill_id, embedding_version)` | **Pass** | Constraint in migration |
| pgvector | **Pass** | `create extension if not exists vector` |
| RLS user_* tables | **Pass** | Policies `auth.uid() = user_id` |
| Cross-user JWT test | **Not run** | Requires manual Supabase auth test |

---

## Section 3 — Data population

### 3.1 Per-user completeness

| Item | Status | Evidence |
|------|--------|----------|
| Profile row + fields | **Partial** | Extraction upserts role/years; location depends on onboarding filling `location_region_code`. |
| `onet_soc_code` / confidence | **Partial** | Set by O*NET map job when search succeeds; confidence thresholds not enforced at >0.6 in SQL. |
| ≥5 active skills | **Data-dependent** | Extraction schema drives count. |
| **Every active skill has embedding** | **Fail** | **No code path inserts `user_skill_embeddings`.** Grep shows zero TS references. |
| Evidence / source_type | **Partial** | `profile-extract` sets `evidence_payload`, `source_type` from extraction. |
| Completeness score | **Partial** | Not stored on profile; derivable in diagnostic route only. |

### 3.2 Re-extraction idempotency

| Item | Status | Evidence |
|------|--------|----------|
| Old skills deactivated | **Pass** | `update … is_active = false` before insert (`profile-extract.ts`). |
| New rows inserted | **Pass** | Batch insert new active skills. |
| Old embeddings retained | **N/A / Fail** | Embeddings never written; deactivated rows may retain future embedding FKs if pipeline added. |
| No duplicate active canonical keys | **Pass** | Dedup within extraction batch + deactivate-all pattern. |
| `generation_runs` audit | **Pass** | Insert per extraction run. |

### 3.3 Edge cases

| Item | Status | Notes |
|------|--------|-------|
| Zero mappable O*NET skills | **Partial** | Rows can keep `onet_skill_id` null; UI does not surface “needs review” list. |
| Resume-only | **Pass** | `source_type` per skill. |
| Non-English | **Not explicitly tested** | Depends on Qwen extraction behaviour. |

---

## Section 4 — Embedding pipeline

| Item | Status | Evidence |
|------|--------|----------|
| Standardised model (text-embedding-3-small, 1536) | **Fail** | No `careeros/skills.embed` (or equivalent) workflow in codebase. |
| Inngest generates embeddings | **Fail** | Not implemented. |
| step.run per skill | **Fail** | N/A |
| Embedding text construction documented | **Fail** | N/A |
| `embedding_version` | **Fail** | No writes. |
| Service-role-only writes | **Pass by absence** | Clients cannot insert embeddings without a workflow; table exists with RLS. |

**Section 4.2 / 4.3:** Reports blocked — see `module-1.4-embedding-quality.md`.

---

## Section 5 — Query correctness & performance

| Item | Status | Evidence |
|------|--------|----------|
| Vector similarity “Python neighbours” | **Blocked** | No embeddings → nothing to query; diagnostic computes cosine in-process **if** rows exist. |
| Performance benchmarks | **Blocked** | `module-1.4-performance.md` stub |

---

## Section 6 — Integration

### 6.1 UI (`/careeros`)

| Item | Status | Evidence |
|------|--------|----------|
| Reads profile + active skills | **Pass** | `app/(careeros)/careeros/page.tsx` |
| Source attribution | **Pass** | Resume vs LinkedIn sections. |
| O*NET mapping visible | **Fail** | Does not show SOC, cache title, or mapping state. |
| Unmapped skills section | **Fail** | Not rendered. |

### 6.2 Write paths

| Item | Status | Evidence |
|------|--------|----------|
| 1.2 → `user_skills` | **Pass** | `profile-extract.ts` |
| 1.3 → profile + mapping | **Pass** | `profile-onet-map.ts` |
| Embedding after skills | **Fail** | No enqueue after extract. |

### 6.3 Diagnostic route

| Item | Status | Evidence |
|------|--------|----------|
| `GET …/_verify/skill-graph?token=&user_id=` | **Implemented** | `app/api/careeros/[verify]/skill-graph/route.ts` (dynamic `[verify]`; URL uses `_verify`). Returns rubric-shaped JSON, `issues` array, masked-safe (no vector logging). |

---

## Section 7 — Verification protocol

| Step | Status |
|------|--------|
| Branch / preview / curl | **Human** |
| Quality / perf / embedding docs | **Stubs committed** — fill after pipeline + runs |

---

## Required docs (curriculum)

| File | Status |
|------|--------|
| `module-1.4-quality-report.md` | Stub — blocked until E2E validation |
| `module-1.4-performance.md` | Stub — blocked until benchmarks |
| `module-1.4-embedding-quality.md` | Stub — blocked until embedding pipeline |

---

## Recommended next engineering steps (sequencing)

1. Implement **`careeros/skills.embed`** (Inngest): after `profile.extract` (or chained from same completion), load active `user_skills` without embeddings, call OpenAI `text-embedding-3-small`, insert `user_skill_embeddings` with shared `embedding_version`, `step.run` per skill or batched chunks.
2. Re-run / backfill embeddings for test users; then fill **Section 4.2** cosine sanity doc with real numbers.
3. Extend **`/careeros` UI** with O*NET occupation title (join `onet_occupations_cache`), SOC, and an “Unmapped” chip list.
4. Run rubric **Section 7** curls on Preview → Production; update quality/performance docs.
