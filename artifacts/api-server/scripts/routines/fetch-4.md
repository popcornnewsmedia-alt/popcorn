# Routine: Pool Fetch #4 (3:30pm BKK)

Runs daily at **15:30 Asia/Bangkok**.
Covers the window **10:30am → 3:30pm BKK** (the 4th of 5 fetches in a 24h cycle).

## What this routine does

1. `git pull` to get the latest pool state.
2. Compute BKK window = today 10:30 → today 15:30 (+07:00).
3. Run `scripts/pool-fetch.ts` with that window.
4. `git add data/pool/pool-YYYY-MM-DD.json && git commit && git push` so the
   next fetch and the finalize routine see the updated pool.

## Prompt (paste into the scheduled task)

```
You are running the 4th of 5 daily RSS fetches for the Popcorn curation pipeline.

Working directory: /Users/bharatarora/Desktop/Popcorn

Steps — run them in order and stop on any error:

1. cd /Users/bharatarora/Desktop/Popcorn && git pull --ff-only

2. Compute the BKK time window:
     FEED_DATE = today's date in Asia/Bangkok (YYYY-MM-DD)
     WINDOW_START = FEED_DATE + "T10:30:00+07:00"
     WINDOW_END   = FEED_DATE + "T15:30:00+07:00"

3. Run the fetch:
     cd artifacts/api-server
     set -a && . ../../.env && set +a
     node --import tsx scripts/pool-fetch.ts \
       --start="<WINDOW_START>" \
       --end="<WINDOW_END>" \
       --feed-date="<FEED_DATE>"

4. Commit and push the updated pool file:
     cd /Users/bharatarora/Desktop/Popcorn
     git add artifacts/api-server/data/pool/pool-<FEED_DATE>.json
     git commit -m "chore(curation): pool fetch 4 for <FEED_DATE>"
     git push

5. Report a one-line summary: fetch run number, items added this run,
   pool totals (potential / rejected / clusters).
```
