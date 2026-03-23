# Obsidian → GitHub as Juno’s company brain

Juno can read your **Obsidian vault** as markdown from a **GitHub repository**. Every agent that calls `getCompanyContext()` receives a section **“OBSIDIAN VAULT (GITHUB MARKDOWN)”** in the assembled prompt, **in addition to** your Supabase profile, uploaded assets, and Supermemory.

## Flow

1. **Obsidian** — You write notes locally (links, graph, folders — all stay in Obsidian).
2. **obsidian-git** — Auto-commit and push to a **private** (or public) GitHub repo ([obsidian-git](https://github.com/Vinzent03/obsidian-git)).
3. **Juno** — On each context build, the server uses the **GitHub API** to list `.md` files (recursive tree), fetch blob contents, and inject them into agent prompts.

No Obsidian plugin talks to Juno directly — **GitHub is the integration surface**.

## What you configure in the app

Under **My Context → Knowledge Base**, set:

| Field | Meaning |
|--------|--------|
| **GitHub owner** | User or org name (e.g. `your-org`) |
| **Repository** | Repo name only (e.g. `my-vault`) |
| **Branch** | Usually `main` |
| **Path prefix** | Optional subfolder inside the repo (e.g. `notes/`). Leave empty to read all `.md` from the repo root. |

`.obsidian/` and `node_modules/` paths are skipped automatically.

## Server environment (Vercel)

| Variable | Required? | Purpose |
|----------|-------------|---------|
| `GITHUB_VAULT_TOKEN` | **Yes for private repos** | Fine-grained PAT or classic PAT with **Contents: Read** on the vault repo |
| `GITHUB_TOKEN` | Fallback | Same as above if `GITHUB_VAULT_TOKEN` is unset |

For a **public** repo you can omit the token; GitHub’s unauthenticated rate limit is low (60 req/hr), so a token is still recommended in production.

**Fine-grained PAT:** Repository access → only the vault repo → Permissions → **Contents: Read**.

## Database

Migration `009_github_obsidian_vault.sql` adds to `company_profile`:

- `github_vault_owner`, `github_vault_repo`, `github_vault_branch`, `github_vault_path`

Run migrations in Supabase after deploy.

## Limits (sensible defaults)

The reader caps volume so prompts stay usable:

- ~40 markdown files max  
- ~72k characters total across the vault  
- ~14k characters per file (then truncated with a note)

Tune in `lib/github-vault.ts` if needed.

## API

- `GET /api/settings/github-vault` — current saved pointer  
- `POST /api/settings/github-vault` — save `{ owner, repo, branch?, path? }`; empty `owner`/`repo` clears the link. Returns a **probe** with `fileCount` and any error from GitHub.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `fileCount: 0`, no error | Path prefix wrong, or repo has no `.md` at that path |
| Private repo 404 | Set `GITHUB_VAULT_TOKEN` with access to that repo |
| Rate limit | Add a token; reduce vault size or polling frequency |
| Old content | Juno reads **latest branch tip** each time — push from Obsidian first |

## Security

- The token lives **only** in server env — never in the browser.
- Founders only store **which repo** to read, not the PAT, in `company_profile`.

Future option: per-user GitHub OAuth or user-supplied PAT (encrypted) for multi-tenant SaaS.
