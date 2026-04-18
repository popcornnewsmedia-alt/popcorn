# Routine: Pool Fetch #5 + Finalize (7:30pm BKK)

Runs daily at **19:30 Asia/Bangkok**.
Covers the final window **3:30pm → 7:30pm BKK** then runs the finalize step
(dedup → selection → enrichment → image pipeline → Supabase dev → review doc).

## What this routine does

1. `git pull` to get the latest pool state.
2. Compute BKK window = today 15:30 → today 19:30 (+07:00).
3. Run `scripts/pool-fetch.ts` — fetch 5 of 5.
4. Run `scripts/pool-finalize.ts` — picks ~12 articles, enriches them,
   processes images (2400px / q95 / source URL persisted), writes them to
   Supabase as stage `dev`, and writes `curation-review/review-YYYY-MM-DD.md`.
5. Commit pool + review doc + any local changes; push.
6. Ping the user: "Review doc ready at curation-review/review-YYYY-MM-DD.md.
   When approved, promote to prod."

## Prompt (paste into the scheduled task)

```
You are running the 5th/final fetch + finalize for the Popcorn curation pipeline.

Working directory: /Users/bharatarora/Desktop/Popcorn

Steps — run them in order and stop on any error:

1. cd /Users/bharatarora/Desktop/Popcorn && git pull --ff-only

2. Compute the BKK time window:
     FEED_DATE = today's date in Asia/Bangkok (YYYY-MM-DD)
     WINDOW_START = FEED_DATE + "T15:30:00+07:00"
     WINDOW_END   = FEED_DATE + "T19:30:00+07:00"

3. Run fetch 5:
     cd artifacts/api-server
     set -a && . ../../.env && set +a
     node --import tsx scripts/pool-fetch.ts \
       --start="<WINDOW_START>" \
       --end="<WINDOW_END>" \
       --feed-date="<FEED_DATE>"

4. Run finalize (picks 12, enriches, writes Supabase dev + review doc):
     node --import tsx scripts/pool-finalize.ts --feed-date="<FEED_DATE>" --target=12

5. Commit and push everything:
     cd /Users/bharatarora/Desktop/Popcorn
     git add artifacts/api-server/data/pool/pool-<FEED_DATE>.json curation-review/review-<FEED_DATE>.md
     git commit -m "chore(curation): final cut for <FEED_DATE>"
     git push

6. Report:
     - Number of articles selected and published to dev
     - Path to review doc (curation-review/review-<FEED_DATE>.md)
     - Remind user to review and promote to prod when ready.
```
