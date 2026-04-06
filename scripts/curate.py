#!/usr/bin/env python3
"""
Popcorn Curation Script
Fetches RSS feeds, scores every article using the Cultural Lens framework via
Claude, and outputs a sorted table for manual selection.

Two modes — always anchored to NOW, not to curation time:

  Main run (default)
    python3 scripts/curate.py
    Pulls ALL articles from the last 24 hours. Use for primary daily review.

  Late sweep
    python3 scripts/curate.py --sweep
    Pulls only the last 2–3 hours. Use close to publish time to catch
    breaking news and viral moments that landed after the main run.

  Custom window (UTC)
    python3 scripts/curate.py 2026-04-02T16:30 2026-04-03T16:30

Both modes return ALL fetched articles — no filtering — sorted by score.
"""

import os, sys, json, re, html, gzip, math
import urllib.request, urllib.error
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

# ─── Mode + time window ───────────────────────────────────────────────────────

SWEEP_MODE = "--sweep" in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith("--")]

if len(args) == 2:
    WINDOW_START = datetime.fromisoformat(args[0]).replace(tzinfo=timezone.utc)
    WINDOW_END   = datetime.fromisoformat(args[1]).replace(tzinfo=timezone.utc)
elif SWEEP_MODE:
    WINDOW_END   = datetime.now(timezone.utc)
    WINDOW_START = WINDOW_END - timedelta(hours=3)
else:
    WINDOW_END   = datetime.now(timezone.utc)
    WINDOW_START = WINDOW_END - timedelta(hours=24)

MODE_LABEL = "LATE SWEEP (last 3h)" if SWEEP_MODE else "MAIN RUN (last 24h)"
print(f"\n{'─'*60}", file=sys.stderr)
print(f"  {MODE_LABEL}", file=sys.stderr)
print(f"  {WINDOW_START.strftime('%b %d %H:%M')} → {WINDOW_END.strftime('%b %d %H:%M')} UTC", file=sys.stderr)
print(f"{'─'*60}\n", file=sys.stderr)

# ─── Feeds ────────────────────────────────────────────────────────────────────
# Tier 1 = 60 (high trust / editorial validation)
# Tier 2 = 55 (core discovery)
# Tier 3 = 50 (early signal / detection only)
# Removed: The Face (404), i-D (defunct), Business of Fashion (404),
#          Daily Mail (SSL/low quality), Highsnobiety (stale)

FEEDS = [
    # ── MUSIC ──────────────────────────────────────────────────────────────────
    ("https://www.rollingstone.com/feed/",                     "Rolling Stone",           2),
    ("https://www.billboard.com/feed/",                        "Billboard",               2),
    ("https://pitchfork.com/rss/news/",                        "Pitchfork",               2),
    ("https://www.stereogum.com/feed",                         "Stereogum",               2),  # fixed: removed trailing /
    ("https://consequence.net/feed/",                          "Consequence",             2),
    ("https://www.nme.com/feed",                               "NME",                     2),

    # ── FILM & TV ──────────────────────────────────────────────────────────────
    ("https://variety.com/feed/",                              "Variety",                 2),
    ("https://www.hollywoodreporter.com/feed/",                "The Hollywood Reporter",  2),
    ("https://www.indiewire.com/feed/",                        "IndieWire",               2),
    ("https://www.vulture.com/feeds/flipboard.rss",            "Vulture",                 2),

    # ── GAMING ─────────────────────────────────────────────────────────────────
    ("https://www.polygon.com/rss/index.xml",                  "Polygon",                 2),
    ("https://feeds.feedburner.com/ign/all",                   "IGN",                     2),
    ("https://www.dexerto.com/feed/",                          "Dexerto",                 3),

    # ── CULTURE / FASHION / TRENDS ─────────────────────────────────────────────
    ("https://hypebeast.com/feed",                             "Hypebeast",               2),
    ("https://www.dazeddigital.com/rss",                       "Dazed",                   2),
    ("https://www.gq.com/feed/rss",                            "GQ",                      2),

    # ── LONG-FORM / HIGH-SIGNAL ────────────────────────────────────────────────
    ("https://www.theatlantic.com/feed/all/",                  "The Atlantic",            1),
    ("https://www.wired.com/feed/rss",                         "Wired",                   1),
    ("https://www.theguardian.com/culture/rss",                "The Guardian Culture",    1),
    ("https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml",  "NYT Arts",                1),
    ("https://www.newyorker.com/feed/everything",              "The New Yorker",          1),

    # ── INTERNET / AI / PLATFORM CULTURE ──────────────────────────────────────
    ("https://www.theverge.com/rss/index.xml",                 "The Verge",               2),
    ("https://techcrunch.com/feed/",                           "TechCrunch",              2),
    ("https://www.platformer.news/feed",                       "Platformer",              1),
    ("https://www.404media.co/rss/",                           "404 Media",               2),
    ("https://knowyourmeme.com/newsfeed.rss",                  "Know Your Meme",          3),

    # ── BUSINESS OF CULTURE / POWER ────────────────────────────────────────────
    ("https://www.ft.com/rss/home",                            "Financial Times",         1),
    ("https://www.semafor.com/rss.xml",                        "Semafor",                 2),
    ("https://puck.news/feed/",                                "Puck",                    1),

    # ── GLOBAL / NON-WESTERN ──────────────────────────────────────────────────
    ("https://restofworld.org/feed/",                          "Rest of World",           2),
    ("https://www.soompi.com/feed/",                           "Soompi",                  2),

    # ── CREATOR ECONOMY ────────────────────────────────────────────────────────
    ("https://www.tubefilter.com/feed/",                       "Tubefilter",              2),  # gzip — handled below

    # ── SPORTS (cultural crossover only) ──────────────────────────────────────
    ("https://www.espn.com/espn/rss/news",                     "ESPN",                    2),

    # ── INTELLECTUAL / IDEAS ──────────────────────────────────────────────────
    ("https://nautil.us/feed",                                 "Nautilus",                1),  # fixed URL
    ("https://aeon.co/feed.rss",                               "Aeon",                    1),
    ("https://psyche.co/feed.rss",                             "Psyche",                  1),  # fixed URL
    ("https://www.technologyreview.com/feed/",                 "MIT Technology Review",   2),
    ("https://www.quantamagazine.org/feed/",                   "Quanta Magazine",         1),

    # ── LOW-TRUST / EARLY SIGNAL ──────────────────────────────────────────────
    ("https://pagesix.com/feed/",                              "Page Six",                3),
]

TIER_BASE = {1: 60, 2: 55, 3: 50}

# Minor secondary keyword signals (±5 max — must not dominate)
HIGH_SIGNAL_KW = [r'\balbum\b', r'\btour\b', r'\barrest', r'\bdead\b|\bdies\b|\bdeath\b', r'\blawsuit\b', r'\bfired\b', r'\bannounce', r'\bdebut\b', r'\bviral\b', r'\bmeme\b', r'\bcancel', r'\bcharged\b|\bindicted\b', r'\bworld cup\b', r'\bcoachella\b']
LOW_SIGNAL_KW  = [r'\bbest .{0,20} deal', r'\b\$\d+.*off\b', r'\bcoupon\b', r'\bvoucher\b', r'\bpromo code\b', r'\bhow to\b', r'\btips for\b']

def keyword_modifier(title):
    t = title.lower()
    for p in LOW_SIGNAL_KW:
        if re.search(p, t): return -5
    for p in HIGH_SIGNAL_KW:
        if re.search(p, t): return +3
    return 0

# ─── RSS Fetch ────────────────────────────────────────────────────────────────

def parse_date(s):
    if not s: return None
    try: return parsedate_to_datetime(s)
    except: pass
    for fmt in ["%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ"]:
        try:
            dt = datetime.strptime(s.strip(), fmt)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except: pass
    return None

def clean(s):
    if not s: return ""
    s = html.unescape(s)
    s = re.sub(r'<[^>]+>', '', s)
    return ' '.join(s.split())

def get_image(item_el):
    for ns in ['http://search.yahoo.com/mrss/']:
        mc = item_el.find(f'{{{ns}}}content')
        if mc is not None:
            url = mc.get('url', '')
            if url: return url
    enc = item_el.find('enclosure')
    if enc is not None:
        url = enc.get('url', '')
        if url and any(x in url.lower() for x in ['jpg', 'jpeg', 'png', 'webp']): return url
    return ""

def fetch_feed(url, name):
    import xml.etree.ElementTree as ET
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; Popcorn/1.0)',
        'Accept': 'application/rss+xml,application/xml,text/xml,*/*',
        'Accept-Encoding': 'gzip, deflate',
    })
    try:
        with urllib.request.urlopen(req, timeout=14) as r:
            raw = r.read()
            # Handle gzip
            if raw[:2] == b'\x1f\x8b':
                raw = gzip.decompress(raw)
        root = ET.fromstring(raw)
    except Exception as e:
        return None, str(e)[:80]

    items = []
    for item in root.iter('item'):
        title = clean(getattr(item.find('title'), 'text', '') or '')
        link  = getattr(item.find('link'), 'text', '') or ''
        desc_el = item.find('description') or item.find('{http://purl.org/rss/1.0/modules/content/}encoded')
        desc  = clean(getattr(desc_el, 'text', '') or '')[:400]
        pub   = getattr(item.find('pubDate'), 'text', '') or ''
        if not pub:
            dc = item.find('{http://purl.org/dc/elements/1.1/}date')
            pub = getattr(dc, 'text', '') or ''
        img = get_image(item)
        dt = parse_date(pub)
        if title and dt:
            items.append({'dt': dt, 'title': title, 'link': link, 'description': desc, 'pubDate': dt.isoformat(), 'source': name, 'imageUrl': img})

    # Try Atom if no RSS items
    if not items:
        for entry in root.iter('{http://www.w3.org/2005/Atom}entry'):
            title_el = entry.find('{http://www.w3.org/2005/Atom}title')
            title = clean(getattr(title_el, 'text', '') or '')
            pub_el = entry.find('{http://www.w3.org/2005/Atom}published') or entry.find('{http://www.w3.org/2005/Atom}updated')
            pub = getattr(pub_el, 'text', '') or ''
            dt = parse_date(pub)
            if title and dt:
                items.append({'dt': dt, 'title': title, 'link': '', 'description': '', 'pubDate': dt.isoformat(), 'source': name, 'imageUrl': ''})

    return items, None

# ─── Claude Cultural Lens Scoring ─────────────────────────────────────────────

CLAUDE_BATCH = 30  # articles per API call

# ─── Load editorial notes ─────────────────────────────────────────────────────
def load_editorial_notes():
    notes_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'editorial-notes.md')
    try:
        with open(notes_path) as f:
            return f.read().strip()
    except Exception:
        return ""

EDITORIAL_NOTES = load_editorial_notes()

def score_with_claude(articles):
    """Score articles using Cultural Lens framework. Returns list of (index, score) tuples."""
    api_key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not api_key:
        print("WARNING: No ANTHROPIC_API_KEY — falling back to tier+keyword scoring only", file=sys.stderr)
        return {}

    import json as _json
    import http.client, ssl

    scores = {}
    batch_count = math.ceil(len(articles) / CLAUDE_BATCH)

    for b in range(batch_count):
        batch = articles[b * CLAUDE_BATCH:(b + 1) * CLAUDE_BATCH]
        offset = b * CLAUDE_BATCH

        article_list = "\n\n---\n\n".join(
            f"[{offset + i + 1}] SOURCE: {a['source']}\nTITLE: {a['title']}\nDESCRIPTION: {a['description'][:200] or '(none)'}"
            for i, a in enumerate(batch)
        )

        editorial_block = ("EDITORIAL LEARNINGS FROM PAST CURATION SESSIONS (apply these to scoring):\n" + EDITORIAL_NOTES + "\n\n") if EDITORIAL_NOTES else ""

        prompt = f"""You are the editorial intelligence for Popcorn, a cultural lens app for pop culture, music, film, gaming, fashion, internet, and creator economy.

Score each article 0–100 based on the Cultural Lens framework:

A. Cultural relevance (0–20): Is this actively part of current cultural conversation? Reflects or influences music, film, internet, fashion, gaming, or celebrity culture?
B. Signal strength (0–20): Is this breaking, emerging, or already widely discussed? Traction beyond original publication?
C. Cross-domain impact (0–20): Does it extend beyond its niche (gaming→mainstream, tech→culture, music→social media)?
D. Internet amplification potential (0–20): Likely to become a meme, trend, discourse topic, or social conversation?
E. Power/industry significance (0–20): Reflects meaningful shifts in media, tech, business, or entertainment industries?

SCORING GUIDANCE:
- 80–100: Major cultural moment — album release, viral event, industry shake-up, cross-platform discourse
- 60–79: Strong cultural story — notable release, interesting trend, relevant industry news
- 40–59: Moderate interest — niche-relevant but limited broader impact
- 20–39: Low signal — deals, product reviews, listicles, generic advice, pure politics/finance without cultural angle
- 0–19: Not culturally relevant for Popcorn

Be strict. Most articles should score 30–65. Reserve 80+ for genuinely significant moments.

EDITORIAL CONTEXT — score these lower (20 or below):
- Follow-up or update stories on already established narratives (e.g. a new mugshot or court date for an ongoing case, a sequel headline to last week's story). Only select if there is a genuinely major new development that changes the story.
- Minor celebrity lifestyle milestones with low cultural ripple — debut appearances, personal announcements, or social media moments from celebrities that are unlikely to drive broader cultural conversation.
- World/politics stories unless they have a direct, strong cultural dimension (music boycotts, film censorship, tech regulation with cultural impact).

{editorial_block}ARTICLES:
{article_list}

Respond with ONLY a valid JSON array, one object per article:
[{{"index": N, "score": 0-100, "reason": "≤10 words"}}]"""

        body = _json.dumps({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 1500,
            "messages": [{"role": "user", "content": prompt}]
        }).encode()

        try:
            ctx = ssl.create_default_context()
            conn = http.client.HTTPSConnection("api.anthropic.com", context=ctx, timeout=60)
            conn.request("POST", "/v1/messages", body=body, headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Length": str(len(body)),
            })
            resp = conn.getresponse()
            data = _json.loads(resp.read())
            text = data.get("content", [{}])[0].get("text", "")
            match = re.search(r'\[[\s\S]*?\]', text)
            if match:
                parsed = _json.loads(match.group())
                for item in parsed:
                    scores[item['index']] = item['score']
            print(f"  Batch {b+1}/{batch_count}: scored {len(parsed)} articles", file=sys.stderr)
        except Exception as e:
            print(f"  Batch {b+1}/{batch_count} failed: {e}", file=sys.stderr)
        finally:
            try: conn.close()
            except: pass

    return scores

# ─── Main ─────────────────────────────────────────────────────────────────────

print("Fetching feeds...", file=sys.stderr)
all_articles = []
failed = []
no_window = []

for url, name, tier in FEEDS:
    items, err = fetch_feed(url, name)
    if items is None:
        failed.append((name, err))
        continue
    in_window = [a for a in items if WINDOW_START <= a['dt'] <= WINDOW_END]
    if in_window:
        for a in in_window:
            a['tier'] = tier
            all_articles.append(a)
    elif items:
        dates = [a['dt'] for a in items]
        no_window.append((name, min(dates).strftime('%b %d %H:%M'), max(dates).strftime('%b %d %H:%M'), len(items)))

print(f"Fetched {len(all_articles)} articles in window from {len(FEEDS) - len(failed) - len(no_window)} feeds", file=sys.stderr)

if failed:
    print(f"\nFailed feeds ({len(failed)}):", file=sys.stderr)
    for n, e in failed:
        print(f"  ✗ {n}: {e}", file=sys.stderr)

if no_window:
    print(f"\nNo articles in window ({len(no_window)}):", file=sys.stderr)
    for n, mn, mx, cnt in no_window:
        print(f"  - {n}: {cnt} items ({mn} → {mx})", file=sys.stderr)

# Score with Claude
print(f"\nScoring {len(all_articles)} articles with Cultural Lens...", file=sys.stderr)
claude_scores = score_with_claude(all_articles)

# Compute final scores
for i, a in enumerate(all_articles, 1):
    tier_base   = TIER_BASE[a['tier']]
    claude_raw  = claude_scores.get(i)
    kw_mod      = keyword_modifier(a['title'])

    if claude_raw is not None:
        # Claude is primary (70%), tier is a quality signal (30%), keywords secondary
        final = round(0.70 * claude_raw + 0.25 * tier_base + 0.05 * (tier_base + kw_mod * 2))
    else:
        # Fallback: tier + keyword only
        final = min(100, max(5, tier_base + kw_mod))

    a['final_score'] = final

# Sort strictly by score, highest first
all_articles.sort(key=lambda x: -x['final_score'])

# ─── Output table ─────────────────────────────────────────────────────────────
label = "LATE SWEEP" if SWEEP_MODE else "MAIN RUN"
print(f"\n{'─'*60}", file=sys.stderr)
print(f"  {label} COMPLETE — {len(all_articles)} articles", file=sys.stderr)
print(f"{'─'*60}\n", file=sys.stderr)

print(f"{'#':<5} {'SCORE':<7} {'SOURCE':<30} HEADLINE")
print("─" * 120)
for i, a in enumerate(all_articles, 1):
    print(f"{i:<5} {a['final_score']:<7} {a['source']:<30} {a['title']}")

# ─── Save full data for publish step ─────────────────────────────────────────
# Main run → overwrites today's curate file
# Late sweep → saves separately so main run candidates are preserved
out = [{
    'title': a['title'], 'link': a['link'], 'description': a['description'],
    'pubDate': a['pubDate'], 'source': a['source'], 'imageUrl': a['imageUrl'],
    'score': a['final_score'],
} for a in all_articles]

today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
suffix = '-sweep' if SWEEP_MODE else ''
outpath = f'/tmp/popcorn-curate-{today}{suffix}.json'
with open(outpath, 'w') as f:
    json.dump(out, f)
print(f"\nSaved {len(out)} articles → {outpath}", file=sys.stderr)

# ─── Save human-readable candidate list ──────────────────────────────────────
# First-pass picks: score ≥ 65, capped at 15
FIRST_PASS_THRESHOLD = 65
FIRST_PASS_MAX = 15
first_pass = [a for a in all_articles if a['final_score'] >= FIRST_PASS_THRESHOLD][:FIRST_PASS_MAX]
first_pass_indices = {all_articles.index(a) + 1 for a in first_pass}

window_label = f"{WINDOW_START.strftime('%b %d %H:%M')} → {WINDOW_END.strftime('%b %d %H:%M')} UTC"
lines = []
lines.append("═" * 100)
lines.append(f"  POPCORN CANDIDATES — {today}   ({MODE_LABEL})")
lines.append(f"  {window_label}   {len(all_articles)} articles fetched")
lines.append("═" * 100)
lines.append("")

lines.append(f"── FIRST PASS — my picks (score ≥ {FIRST_PASS_THRESHOLD}) {'─' * 50}")
if first_pass:
    for a in first_pass:
        idx = all_articles.index(a) + 1
        lines.append(f"  #{idx:<4} {a['final_score']:<5} {a['source']:<28} {a['title']}")
else:
    lines.append("  (no articles met the threshold)")
lines.append("")

lines.append(f"── ALL CANDIDATES (sorted by score) {'─' * 57}")
for i, a in enumerate(all_articles, 1):
    marker = " ✓" if i in first_pass_indices else "  "
    lines.append(f"{marker} #{i:<4} {a['final_score']:<5} {a['source']:<28} {a['title']}")
lines.append("")
lines.append("═" * 100)
lines.append("  Reply with the sequence numbers (#N) you want published.")
lines.append("  ✓ = already in my first pass.  Add or remove as you see fit.")
lines.append("═" * 100)

# Save to /tmp (ephemeral, legacy)
txtpath = f'/tmp/popcorn-candidates-{today}{suffix}.txt'
with open(txtpath, 'w') as f:
    f.write('\n'.join(lines) + '\n')
print(f"Saved candidate list → {txtpath}", file=sys.stderr)

# Save to Uncurated Lists folder (permanent, dd_mm_yy format)
import os as _os
_script_dir = _os.path.dirname(_os.path.abspath(__file__))
_uncurated_dir = _os.path.join(_script_dir, '..', 'Uncurated Lists')
_os.makedirs(_uncurated_dir, exist_ok=True)
from datetime import date as _date
_d = _date.fromisoformat(today)
_fname = f"{_d.day:02d}_{_d.month:02d}_{str(_d.year)[2:]}_uncurated_list.txt"
_fpath = _os.path.join(_uncurated_dir, _fname)
with open(_fpath, 'w') as f:
    f.write('\n'.join(lines) + '\n')
print(f"Saved uncurated list → {_fpath}", file=sys.stderr)
