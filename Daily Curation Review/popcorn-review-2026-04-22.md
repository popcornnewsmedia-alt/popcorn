# Popcorn — Daily Curation Review (Apr 22, 2026)

**Total: 19 articles** | 5 fetches across BKK Apr 21 19:30 → Apr 22 19:30

## Run Summary

| Fetch | BKK Window | UTC Window | Initial | After dedup/dups | Final added |
|------:|------------|------------|--------:|-----------------:|------------:|
| 1 | Apr 21 19:30 → Apr 22 00:30 | Apr 21 12:30 → 17:30 | 9 | 5 (4 in-fetch dups removed) | +5 |
| 2 | Apr 22 00:30 → 05:30 | Apr 21 17:30 → 22:30 | 5 | 4 (1 in-fetch dup removed) | +4 |
| 3 | Apr 22 05:30 → 10:30 | Apr 21 22:30 → Apr 22 03:30 | 3 | 3 | +3 |
| 4 | Apr 22 10:30 → 15:30 | Apr 22 03:30 → 08:30 | 3 | 3 | +3 |
| 5 | Apr 22 15:30 → 19:30 | Apr 22 08:30 → 12:30 | 4 | 4 | +4 |
| **Total** | | | **24** | **19** | **19** |

## Pipeline Changes Applied This Run

1. **Headline prompt tightened** (rss-enricher.ts, both call sites) — replaced "12-13 word soft recommendation, flex to 14-16" with "**HARD TARGET 11-13, HARD CAP 14, ABSOLUTE MAX 16 only when a named cause/quote is the hook.**" Includes a self-check pass instruction: count words, look for filler verbs / decorative adjectives / stacked prepositional phrases.
2. **`PATCH /api/curation/set-title` endpoint added** (curation.ts + curated-store.ts) — completes the long-pending TODO from MEMORY.md. Updates Supabase + in-memory atomically, no server restart needed. Mirrors `set-image` pattern. Used in this run to patch the 4 over-cap Fetch 1 headlines.
3. **In-fetch dedup gap surfaced** — Fetch 1 produced 4 duplicate articles (Drake / Devil Wears Prada / Burger King / Parke each appeared twice from different sources). Manual removal applied. Worth investigating: the dedup checks against historical titles but apparently not against same-fetch siblings. Fetch 2 also produced 1 in-fetch dup (Florida OpenAI investigation appearing twice).

## Category Distribution

- **AI** (5): Florida vs OpenAI, Meta keystroke training, SpaceX-Cursor deal, Pangram Pope detection
  - Note: Apr 21 was 5 AI; today also 5 AI. Stays at the soft cap.
- **Film & TV** (3): Devil Wears Prada 2 premiere, Hulk Hogan Netflix doc, A24 Texas Chainsaw
- **Culture** (3): Burger King × Star Wars menu, Chipotle Honey Chipotle return, Rihanna's weed / Jonah Hill, Congress NPR funding
- **Music** (2): Drake ice block attack, Karol G stadium tour
- **Tech** (2): Amazon price-fixing emails unsealed, DoorDash stablecoin
- **Fashion** (2): Parke → Target, thisisneverthat × Starbucks
- **Gaming** (1): Xbox Game Pass cut + Call of Duty
- **Internet** (1): Bluesky social media problems

## Articles (in feed order, with FINAL headlines after patches)

| # | ID | Cat | Tag | Headline | Words |
|---|---|-----|-----|----------|-----:|
| 1 | 820 | Music | BREAKING | Drake Fans Attack Giant Ice Block With Pickaxes and Fire as Police Step In | 14 |
| 2 | 821 | Film & TV | FEATURE | Devil Wears Prada 2 Premiere Brings Lady Gaga, Hathaway and Streep Together | 12 |
| 3 | 822 | Culture | RELEASE | Burger King Launches Full Star Wars Menu for The Mandalorian and Grogu Movie | 13 |
| 4 | 823 | Fashion | FEATURE | Parke Went From $100K to $16 Million and Now It's Landing at Target | 13 |
| 5 | 827 | Gaming | BREAKING | Xbox Cuts Game Pass Ultimate to $23 But Call of Duty Skips Day One | 14 |
| 6 | 829 | AI | BREAKING | Florida Criminally Investigates OpenAI After ChatGPT Advised a Mass Shooter | 10 |
| 7 | 830 | AI | BREAKING | Meta Is Recording Employee Mouse Clicks and Keystrokes to Train Its AI Agents | 13 |
| 8 | 832 | Culture | BREAKING | Chipotle Honey Chipotle Chicken Returns to Menus April 28 After Fan Outcry | 12 |
| 9 | 833 | Tech | FEATURE | Unsealed Amazon Emails Show How Amazon Allegedly Colluded to Raise Prices Across the Internet | 14 |
| 10 | 834 | AI | BREAKING | SpaceX Strikes $60 Billion Deal for the Right to Buy Coding Startup Cursor | 13 |
| 11 | 835 | Tech | TREND | DoorDash Plans to Pay Dashers in Stablecoin via Blockchain Partner Tempo | 12 |
| 12 | 836 | Culture | HOT TAKE | Rihanna's Weed Reportedly Made Jonah Hill's Friend Lose All Bowel Control | 11 |
| 13 | 837 | Film & TV | FEATURE | Hulk Hogan Netflix Doc Reveals Fentanyl Use and Decades of Hidden Scandals | 12 |
| 14 | 838 | Internet | HOT TAKE | Bluesky Exploded After Trump's Win but Now Faces the Same Old Social Media Problems | 14 |
| 15 | 839 | Film & TV | BREAKING | A24 Taps Obsession Director Curry Barker to Reimagine The Texas Chainsaw Massacre | 12 |
| 16 | 840 | Music | BREAKING | Karol G Announces 39-Stadium 'Viajando Por El Mundo Tropitour' World Tour | 11 |
| 17 | 841 | Fashion | RELEASE | thisisneverthat and Starbucks Drop First-Ever Vintage-Inspired Coffee Capsule | 9 |
| 18 | 842 | AI | HOT TAKE | Pangram Labs Tool Flags Pope's AI Warnings as AI-Generated Content | 11 |
| 19 | 843 | Culture | FEATURE | Congress Cut Public Radio Funding and a Billionaire Wrote NPR an $80 Million Check | 14 |

**Mean: 12.3 words. Range: 9-14. All within the new HARD CAP of 14.**

### Headline patches applied (set-title, mid-run)

These four came in from Fetch 1 before the prompt was tightened (the Fetch 1 batch ran on the old "soft 12-13" prompt). All patched in-place via `PATCH /api/curation/set-title`:

| ID | Before (words) | After (words) |
|---|----|----|
| 820 | "Drake Fans Attacked a Giant Ice Structure With Pickaxes and Fire, So Toronto Police Had to Step In" (19) | "Drake Fans Attack Giant Ice Block With Pickaxes and Fire as Police Step In" (14) |
| 821 | "The Devil Wears Prada 2 Premiere Brought Lady Gaga, Anne Hathaway and Meryl Streep Together and the Internet Lost Its Mind" (22) | "Devil Wears Prada 2 Premiere Brings Lady Gaga, Hathaway and Streep Together" (12) |
| 822 | "Burger King Just Launched a Full Star Wars Menu Tied to The Mandalorian and Grogu Movie" (16) | "Burger King Launches Full Star Wars Menu for The Mandalorian and Grogu Movie" (13) |
| 827 | "Xbox Cuts Game Pass Ultimate to $23 But New Call of Duty Games Leave Day One" (16) | "Xbox Cuts Game Pass Ultimate to $23 But Call of Duty Skips Day One" (14) |

### In-fetch duplicates removed

| Removed ID | Reason |
|---|---|
| 824 | Drake ice block — duplicate of #820 (different source phrasing) |
| 825 | Devil Wears Prada premiere — duplicate of #821 (different angle from same event) |
| 826 | Burger King menu — duplicate of #822 (different source) |
| 828 | Parke / Target — duplicate of #823 (different source) |
| 831 | Florida criminal investigation OpenAI — duplicate of #829 (different source phrasing) |

## Feed Health Check (against MEMORY editorial guidelines)

**Strong coverage axes:**
- Power × tech: Florida criminal investigation against OpenAI (state-level move on AI), Amazon price-fixing emails unsealed (DOJ trove), SpaceX-Cursor $60B deal (Musk's AI consolidation play)
- Tech-with-cultural-stakes: Meta keystroke surveillance for AI training, ChatGPT advised a mass shooter, Pangram tool says Pope's AI warnings are themselves AI-generated
- Cultural delight + absurdism: Rihanna's weed / Jonah Hill bowel control, Drake fans attacking the ice block from yesterday's story, Burger King × Star Wars Mandalorian menu
- Legacy IP / franchise: A24 Texas Chainsaw, Hulk Hogan Netflix doc, Devil Wears Prada 2 premiere
- Editorial / civic: Congress cut public radio funding & billionaire $80M check
- Fashion drops: Parke → Target, thisisneverthat × Starbucks (Apr 21 had Lancôme+Kering, today's are different stories)

**Anti-patterns flagged:**
- AI count: 5 (Florida OpenAI, Meta keystrokes, SpaceX-Cursor, Pangram Pope, but most have a cultural/political twist not pure business — only SpaceX-Cursor is pure deal). Within soft cap of 5.
- Crime/scandal: 1 (Florida shooter / OpenAI) — under cap.
- Pure red-carpet/premiere story: 1 (Devil Wears Prada 2) — Apr 21 review **rejected** the same story from yesterday's feed. **TBD whether to keep or cut** — the new framing this time is the Lady Gaga + Hathaway + Streep coming-together moment which has stronger cultural shareability than yesterday's "they showed up" beat. Flag for manual review.
- Continuity callback: Drake ice block (#820) is a follow-up to yesterday's #798 "Drake blew up a Toronto ice block to reveal album date". The follow-up shows fans turning violent — this is a legitimate continuation, not a duplicate. Worth keeping.

**Suggested manual review:**
- #821 Devil Wears Prada 2 premiere — yesterday's same-event coverage was rejected. Today's is the "celebrity grouping" angle. Decide: keep one rule (no premiere coverage) or allow when there's a viral grouping moment.
- #842 Pope AI warnings — meta-recursive AI story (a tool says the Pope's AI warnings are AI). Strong shareability but verify the source isn't a satire site.
- #836 Rihanna's weed / Jonah Hill — verify this is a real anecdote (not a meme), and that the framing isn't gross-out for its own sake.
- #823 Parke → Target — confirm Parke is the correct spelling and the $100K → $16M figure is actually from this story (not a generic founder myth).

## Fetch 5 Full Pool (the only one preserved on disk)

Per the user's note that yesterday's review was incomplete — **note that the uncurated capture file overwrites between fetches**, so only the LAST fetch's full pool was preserved. Fetches 1-4 left no rejected-article record. (Fix proposed at end of file.)

**Fetch 5 raw breakdown:**
- 182 raw items pulled from RSS
- 178 unique stories after URL-dedup
- 100 sent to Claude for ranking
- 4 deduplicated against historical titles
- 96 rejected by Claude in first pass
- 82 marked "selected" by Claude in first pass — only 4 of these survived to enrichment + publish (820-843 series)

**Fetch 5 "selected but not published" (78 stories Claude scored positively that didn't make the final cut):**

Music / culture:
- Karol G Tropitour stadium tour (Hypebeast variant) — published as #840 from a different source
- Zara Larsson Dazed interview ("the second I come home, all my clothes come off")
- Vilma Jää opera profile
- Lorne Michaels SNL movie takeaways
- Gwendoline Riley new novel review
- The Pope's Warnings About AI Were AI-Generated — published as #842 from a different source

Film & TV / industry:
- Daredevil showrunner reveals Marvel character
- Helldivers 2 Exo Experts Warbond
- Marathon Changes Announced
- Elden Ring Movie Set Photos Leak
- Pokémon Doubles Down on Penalty for Pro Player
- Stranger Things Tales From '85 timing
- Fallout: New Vegas 2 evaporated
- Shawna Thomas joins MS NOW after CBS Mornings
- Soccer Couple Rebekah/Jamie Vardy ITV reality show
- 'The Deb' co-star accused Rebel Wilson
- 4 Takeaways From 'Lorne' SNL movie

Tech / business:
- Anker AI chip
- Anthropic Mythos unauthorized access investigation (already covered as Apr 21 #797 — proper dedup catch)
- New Gas-Powered Data Centers Could Emit More Greenhouse Gases Than Entire Nations
- YouTube deepfake takedown changes
- Macy's closing more stores 2026
- Deloitte cuts perks
- Duolingo AI U-turn warning
- Anthropic CEO white-collar wipeout pushback (Nobel economist)
- VC warns AI boom won't last
- Mark Cuban's 3 Claude prompts
- Amazon biggest trade of decade

Fashion / streetwear:
- Edison Chen × CLOT × adidas Originals Mundial collection
- Bob the newest Labubu × USM × Kasing Lung
- 101 Years of Lee × Feng Chen Wang
- New Balance popsicle-flavored dad shoe
- Jordan minimalist baller

Internet / culture / lifestyle:
- TikTok child skincare influencers (BoF investigation)
- Dog walks itself to day care
- NHL fans rain glass on opposition coach
- Pat Sajak's daughter goes public with Savannah Bananas star
- Drake trolls Bears QB rollout (ESPN)
- Bruins Game 2
- Kentucky governor on UK basketball
- One town's scheme for geese
- That One Week You Forget Allergies (New Yorker)
- Kardashians Explain Everything (New Yorker)
- Macy's stores closing
- LACMA new home
- LA going underground
- There is no nature anymore
- 3 things Michelle Kim is into
- Teacher Samuel Paty Cannes drama 'Forsaken'
- Ian McKellen Q&A
- Red Light Therapy mask ranking
- École des Sables dance school
- Mystery of the missing Time cocaine cover
- Gloria Steinem brownstone group discussion
- Imagining the Manosphere
- Exit 8 review
- Olto Infinite Machine review
- African pop global success
- LinkedIn 360 Brew algorithm tips
- Instacart founder sneaker test for entrepreneurs
- 5 stats Apple Tim Cook era stock dominance
- Real estate investor strategy shift
- BlackRock 4 biggest market trends
- Wealth management AI / FIRE risk
- Husband won't help manage money

Politics (rejected/rejected_by_claude as not-Popcorn-fit):
- Americans give Congress a thumbs down (Semafor)
- Barrasso on Sanders/Schumer/Israel
- El-Sayed Democratic moderates
- Warsh hearing Fed onus on Trump

**Why these didn't make the cut:** Either (a) thinner news beat than picked alternatives in the same category, (b) audience-niche (NHL/MLB game recaps, business / personal-finance trade pieces, hard-politics), (c) duplicates of stories picked from a different source, or (d) listicle/SEO-bait formatting.

## Pipeline Improvements Identified This Run (TODO)

### 1. In-fetch dedup gap (HIGH priority)
Fetch 1 produced 4 same-fetch duplicates (Drake / DWP / BK / Parke each appearing twice from different RSS sources). Fetch 2 produced 1 (Florida OpenAI). The historical-title dedup runs against `_allPublishedTitles`, but in-fetch sibling dedup may not run before enrichment. **Fix:** add a Jaccard-similarity pass within the batch before sending to enrichment, dropping any item with `>= 0.6` overlap with another in the same batch.

### 2. Uncurated dump overwrites between fetches (MEDIUM priority)
Currently `data/uncurated/uncurated-2026-04-22.json` is replaced on each fetch. The user's request to "Create the file with ALL articles fetched, not just the published ones" can't be fulfilled fully because Fetches 1-4 dumps were overwritten by Fetch 5. **Fix:** append to a per-day-per-fetch file (e.g. `uncurated-2026-04-22-fetch1.json`, `-fetch2.json`...) OR concatenate into a single per-day file with a `fetch` field on each item.

### 3. Headline prompt enforcement (FIXED this run, monitor)
The "soft 12-13" prompt was producing 14-22 word output (especially when source headlines stuffed every detail). New prompt with HARD CAP 14 + word-counting self-check produced 9-14 across Fetches 2-5 (mean 12.0). Fetch 1 ran on old prompt — 4 needed manual patches. Watch this over the next 2-3 days to see if the new prompt holds.

### 4. set-title endpoint shipped (FIXED this run)
`PATCH /api/curation/set-title` now exists. Updates Supabase + in-memory atomically. No more "patch Supabase + restart server" workflow. Used 4× in this run.

## Continuity Notes

- **Drake follow-up:** today's #820 (fans attacking the ice block) is a legitimate continuation of yesterday's #798 (Drake reveals album via ice block). Not flagged as a dupe — different beat (release stunt → mob response).
- **Anthropic Mythos:** yesterday's #797 covered the original government alarm; today an "unauthorized access" follow-up was in Fetch 5 selected pool but not picked — correct call, would have been a redundant beat.
- **Devil Wears Prada 2:** yesterday's was rejected on review (red-carpet rule). Today's came back with a stronger Lady Gaga / Hathaway / Streep grouping framing. **Flagged for user review** — keep or apply the rule consistently.
