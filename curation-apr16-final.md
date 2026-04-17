# CURATION FINAL — 2026-04-16 (v2, pinned Allbirds)
# Window: Apr 15 7:30pm BKK → Apr 16 8:00pm BKK (UTC: 2026-04-15T12:30 → 2026-04-16T13:00)
# Auto-selected: 5 | Manual adds (indices): 6 | Manual adds (raw/fetched from Wired RSS): 1 | Final: 12
# Feed order is now score-driven — Allbirds pinned to #1 (signal_score=99)

================================================================================
## FINAL FEED ORDER (top → bottom, as shown in app)
================================================================================

feed-pos  1 | score=99 | [MANUAL-RAW ] | seq NEW     | AI         | Allbirds Is Ditching Sneakers for AI Infrastructure
feed-pos  2 | score=94 | [AUTO       ] | seq #62     | Industry   | Live Nation Found Guilty of Running Illegal Monopoly
feed-pos  3 | score=88 | [AUTO       ] | seq #29     | Music      | Massive Attack Return With Tom Waits on 'Boots on the Ground'
feed-pos  4 | score=85 | [AUTO       ] | seq #49     | Film & TV  | Amazon MGM CinemaCon: Spaceballs 2, Rocky and Thomas Crown Revealed
feed-pos  5 | score=82 | [MANUAL     ] | seq #58     | AI         | ChatGPT Called a Fart Song Cinematic and We Have Questions
feed-pos  6 | score=82 | [MANUAL     ] | seq #1      | Film & TV  | Ariana Grande Joins Ben Stiller in Focker In-Law Trailer
feed-pos  7 | score=82 | [AUTO       ] | seq #69     | World      | Ukraine Says Russian Soldiers Are Surrendering to Robots
feed-pos  8 | score=78 | [MANUAL     ] | seq #24     | Tech       | Sabi's Beanie Wants to Read Your Thoughts
feed-pos  9 | score=78 | [AUTO       ] | seq #80     | AI         | Berklee Students Are Furious About Its New AI Songwriting Class
feed-pos 10 | score=74 | [MANUAL     ] | seq #73     | Internet   | Saying 'Jessica' Apparently Stops Toddler Tantrums Cold
feed-pos 11 | score=74 | [MANUAL     ] | seq #7      | AI         | Starbucks and ChatGPT's Collab Is Deeply Weird
feed-pos 12 | score=71 | [MANUAL     ] | seq #14     | Culture    | Pedro Pascal Is Suing a Chilean Pisco Brand

================================================================================
## NOTES
================================================================================

Fixes landed this session (artifacts/api-server/src/lib/rss-enricher.ts):
  1. RSS per-feed cap raised from 12 → 40 items.
     Root cause of the Allbirds miss: Wired publishes >12 items/day, so by the
     time we fetched (Apr 17 ~01:30 UTC), Allbirds (Apr 15 14:58 UTC) was at
     position 13+ in the feed and silently dropped — even though it was well
     inside the curation window. At 40 items we cover 2+ days of even the
     fastest publishers.
  2. Selection prompt recalibrated based on today's manual adds:
     - SHAREABILITY section rewritten: "wait, what?" stories now pass on the
       hook alone, no need for societal-shift justification.
     - New NOVELTY AND CURIOSITY examples including D2C pivot weirdness
       (Allbirds) and wearable tech claims (beanie).
     - New "ABSURDITY AND WAIT-WHAT STORIES" section — explicit greenlight
       for named-entity + surreal-action pattern.
     - New "MAINSTREAM ANCHORS" section — explicit exception to the
       promotional penalty for recognisable-IP trailers (e.g. Focker In-Law).
     - New "INTERNET-NATIVE TRENDS" section — memes/TikTok patterns elevated
       from novelty filler to first-class material.
     - New "FEED COMPOSITION TARGET" — 1 mainstream anchor, 1 absurdist,
       1 internet-native minimum, substance spine ≤ half the feed.
     - Explicit "too safe is a real failure mode" instruction.
  3. Server restart bug found: Claude Code shell sets ANTHROPIC_API_KEY=""
     which overrides node --env-file. Fixed locally via helper script
     (/tmp/start-popcorn.sh). Consider adding a loud startup check.

Post-rebuild: all new curation runs pick up the fixes automatically.
