# Intelligent Systems Quiz

A community-driven exam prep app built with Next.js, React, and Supabase. Features 40 random questions per session, flagging, review mode, score history, PDF export, and question contribution.

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding Questions via JSON

`questions.json` at the repo root mirrors the Supabase question database. Editing it and pushing to `master` automatically syncs the changes via GitHub Actions.

### Steps

1. Open `questions.json` and append a new entry — **omit `id`**, it is assigned automatically:

```json
{
  "text": "Your question here?",
  "options": ["Option A", "Option B", "Option C"],
  "correct_answer": 0
}
```

`correct_answer` is the **zero-based index** of the correct option (`0` = first option, `2` = third, etc.).

2. Commit and push to `master` — the sync workflow fires automatically.

### Sync overview

| Direction | Trigger | Behaviour |
|---|---|---|
| JSON → Supabase | Push to `master` (when `questions.json` changed) | Upserts existing questions; inserts new ones (no `id` needed) |
| Supabase → JSON | Cron every 30 min | Fetches DB, commits `questions.json` if anything changed |

> Deletions are intentionally not synced — remove questions directly in Supabase to avoid accidental data loss.

### Required GitHub Secrets

Add these in **Settings → Secrets → Actions** for the workflows to run:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used by the Supabase → JSON cron
- `SUPABASE_SERVICE_ROLE_KEY` — used by the JSON → Supabase sync (bypasses RLS to allow updates)

### Running sync locally

```bash
node scripts/supabase-to-json.mjs   # Supabase → questions.json
node scripts/json-to-supabase.mjs   # questions.json → Supabase
```
