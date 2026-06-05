# Daily Curation Review — 2026-05-13

**Status:** Concurrent-run incident. Two parallel auto-curation runs published into today's `dev` stage simultaneously (Railway's scheduled Run 6 at BKK 7pm / UTC 12:00, plus an accidental manual `/api/refresh` triggered around the same time). Both ran without a concurrency mutex on `runCurationCycle`, so each completed Call 1 + Call 2 independently and wrote their full selection.

**Final dev count:** 90 articles, IDs 1327–1416, all `dev` stage, all unique URLs.

**Underlying unique stories:** ~46. Each story appears 1×, 2×, or 3× with reworded headlines.

**Cleanup needed:** keep one version per cluster, then run a normal manual-curation trim to the ~24–26 target.

---

## 3-copy clusters — 13 stories / 39 articles

For each: **suggested keep** marked ⭐ (strongest headline / most specific). Others = delete.

### Jack Douglas death (Music · BREAKING)
- 1329 — Jack Douglas, Producer Behind Double Fantasy and Toys in the Attic, Dies at 80 — Rolling Stone
- ⭐ 1365 — Jack Douglas, Producer of Double Fantasy and Toys in the Attic, Dead at 80 — Rolling Stone
- 1390 — Jack Douglas, Producer of Double Fantasy and Toys in the Attic, Dies at 80 — Rolling Stone

### Weird Al Broadway musical (Culture · BREAKING)
- ⭐ 1330 — Weird Al Yankovic Broadway Musical Dare To Be Stupid Is Happening — Stereogum
- 1366 — Weird Al Yankovic Is Getting a Broadway Musical Called Dare To Be Stupid — Stereogum
- 1391 — Weird Al Yankovic Is Getting His Own Broadway Musical — Stereogum

### Pearl Jam Ohana 2026 / no drummer (Music · BREAKING)
- ⭐ 1331 — Pearl Jam Book Ohana 2026 But Still Have No Drummer — Billboard
- 1368 — Pearl Jam Book First Gig Since Matt Cameron Left and Nobody Knows Who's Drumming — Billboard
- 1393 — Pearl Jam Book First Gig Since Matt Cameron Left — No Drummer Yet — Billboard

### World Cup sticker book / 3D printing (Sports/Culture · TREND)
- 1333 — World Cup 2026 Fans Print Their Own Stickers to Dodge $2,000 Bill — Dexerto
- ⭐ 1371 — Fans Are 3D Printing Panini World Cup Stickers to Dodge $2000 Bill — Dexerto
- 1395 — World Cup Sticker Book Costs $2000, So Fans Are Printing Their Own — Dexerto

### Drake 3 albums charting 10 years (Music · BREAKING)
- ⭐ 1335 — Drake Beats Michael Jackson: First Artist With Three Albums Charting 10 Years — Hypebeast
- 1373 — Drake Is First Artist Ever With Three Albums Charting a Decade — Hypebeast
- 1396 — Drake Becomes First Artist Ever With Three Albums Charting for 10 Years — Hypebeast

### KITT speeding ticket (Culture · BREAKING)
- ⭐ 1338 — KITT Got a NYC Speeding Ticket While Sitting in an Illinois Museum — Daily Mail
- 1375 — KITT Got a Speeding Ticket in NYC While Sitting in an Illinois Museum — Daily Mail
- 1398 — KITT Got a NYC Speeding Ticket While Parked in an Illinois Museum — Daily Mail

### Neopets NYC pop-up (Internet · TREND)
- ⭐ 1340 — Neopets Is Getting Its First Ever NYC Pop-Up Store — Inc.
- 1379 — Neopets Is Getting Its First-Ever NYC Pop-Up This August — Inc.
- 1402 — Neopets Is Getting Its First NYC Pop-Up After Nearly 20 Years — Inc.

### Israel Eurovision $1M influence (World/Culture · BREAKING/FEATURE)
- 1341 — Israel Spent $1M to Influence Eurovision Votes, New Investigation Finds — Vanity Fair
- 1381 — Israel Spent $1M to Influence Eurovision and Diplomats Called Broadcasters — Vanity Fair
- ⭐ 1403 — Israel Spent $1M and Used Diplomats to Influence Eurovision Votes — Vanity Fair

### LEGO Minas Tirith $650 (Culture/Gaming · RELEASE)
- 1344 — LEGO Gondor's Minas Tirith Is 8,278 Pieces and Costs $650 — Dexerto
- 1382 — LEGO Minas Tirith Is the Biggest Lord of the Rings Set Ever at $650 — Dexerto
- ⭐ 1405 — LEGO Reveals 8,278-Piece Minas Tirith, Its Biggest LOTR Set Ever — Dexerto

### Boy George / Israel Eurovision drama (Music/Culture · BREAKING)
- 1345 — Israel Qualifies at Eurovision as Boy George Gets Booed Out — Daily Mail
- 1384 — Boy George Out, Israel Through: Eurovision Semi-Final Drama in Vienna — Daily Mail
- ⭐ 1406 — Boy George Exits Eurovision as Israel's Noam Bettan Qualifies Amid Boos — Daily Mail

### Ado / Zipangu 2026 Rose Bowl (Music · FEATURE)
- 1346 — Ado and Japan's Biggest Acts Hit the Rose Bowl May 16 — Hypebeast
- ⭐ 1385 — Ado Headlines Zipangu 2026, J-Pop's Biggest US Show Ever — Hypebeast
- 1408 — Ado Leads Zipangu 2026, Japan's Biggest US Music Event Ever — Hypebeast

### Swatch x AP Royal Pop pocket watch (Fashion · RELEASE)
- ⭐ 1349 — Swatch x Audemars Piguet Royal Pop Is a Pocket Watch Not a Wristwatch — Hypebeast
- 1387 — Swatch x Audemars Piguet Royal Pop Ditches the Wrist — Hypebeast
- 1410 — Audemars Piguet x Swatch Royal Pop Is a $400 Pocket Watch Drop — Hypebeast

### Unitree GD01 mech $650K (Tech · FEATURE/BREAKING)
- 1359 — Unitree's GD01 Is a Real Pilotable Mecha You Can Buy — Wired
- ⭐ 1383 — Unitree Robotics GD01: You Can Now Pilot a Real Mech for $650,000 — Dexerto
- 1392 — Unitree's GD01 Is a Real Rideable Transforming Mech for $650K — The Verge

---

## 2-copy clusters — 18 stories / 36 articles

### Jason Collins NBA death (Sports · BREAKING)
- 1327 — Jason Collins, NBA's First Openly Gay Player, Dies at 47 — Sky Sports
- ⭐ 1363 — NBA Pioneer Jason Collins Dies of Brain Cancer at 47 — Sky Sports

### Brandon Clarke Grizzlies death (Sports · BREAKING)
- ⭐ 1328 — Memphis Grizzlies' Brandon Clarke Dies at 29 in Suspected Overdose — Sky Sports
- 1364 — Memphis Grizzlies' Brandon Clarke Dead at 29, Possible Overdose Investigated — Sky Sports

### OnlyFans pioneers quitting (Internet · FEATURE)
- ⭐ 1332 — OnlyFans First-Gen Creators Are Quitting and Begging the Internet to Forget Them — Wired
- 1369 — OnlyFans Pioneers Are Quitting and Begging the Internet to Forget Them — Wired

### Peter Jackson on Andy Serkis Oscar (Film & TV · INTERVIEW)
- ⭐ 1334 — Peter Jackson Says AI Debate Is Why Andy Serkis Will Never Win an Oscar for Gollum — Variety
- 1372 — Peter Jackson Says AI Debate Is Costing Andy Serkis His Oscar — Variety

### Beyoncé music thief sentenced (Music · BREAKING)
- ⭐ 1336 — Kelvin Evans Gets 2 Years for Stealing Beyoncé's Unreleased Music — The Guardian
- 1374 — Kelvin Evans Gets Two Years for Stealing Unreleased Beyoncé Music — The Guardian

### Ralph Lauren USPS stamps (Fashion · FEATURE)
- ⭐ 1337 — Ralph Lauren Is First Ever to Curate an Official USPS Stamp Set — Highsnobiety
- 1397 — Ralph Lauren Is First Person Ever to Curate USPS Stamps — Highsnobiety

### Ice Cube / Friday 30 years (Culture · FEATURE)
- 1339 — Ice Cube and Mike Epps Toast 30 Years of Friday Live — Hypebeast
- ⭐ 1378 — Ice Cube and Mike Epps Throw a 30-Year Friday Party in Long Beach — Hypebeast

### Maya Higa TED Twitch (Internet · FEATURE)
- ⭐ 1342 — Maya Higa Gets Standing Ovation as First Twitch Streamer at TED — Dexerto
- 1404 — Maya Higa Becomes First Twitch Streamer to Give a TED Talk — Dexerto

### Spike Lee American Utopia 4K (Film & TV · RELEASE)
- ⭐ 1347 — Spike Lee and David Byrne's AMERICAN UTOPIA Returns in 4K August 5 — Hypebeast
- 1409 — Spike Lee's American Utopia Returns in 4K for One Night Only — Hypebeast

### Stormzy / Ian Wright biopic (Film & TV · FEATURE/BREAKING)
- ⭐ 1350 — Stormzy's Merky Films Is Making an Official Ian Wright Biopic — Hypebeast
- 1389 — Stormzy's Merky Films Is Making an Ian Wright Biopic — Hypebeast

### Cate Blanchett RSL Media (AI · FEATURE)
- ⭐ 1352 — Cate Blanchett Co-Founds RSL Media to Give Creators AI Consent Rights — Variety
- 1412 — Cate Blanchett Co-Founds RSL Media to Give AI a Consent Switch — Variety

### Eurovision Vienna chaotic edition (Culture · FEATURE)
- 1353 — Eurovision 2026 in Vienna Is Its Most Chaotic and Serious Edition Ever — THR
- ⭐ 1413 — Eurovision 2026 in Vienna Has 5 Boycotts, Counter-Drones and an FBI Task Force — THR

### ChatGPT GPT-4o kratom/Xanax death (AI · BREAKING)
- 1354 — ChatGPT's GPT-4o Told Sam Nelson Kratom and Xanax Were Safe — Engadget
- ⭐ 1414 — ChatGPT's GPT-4o Drug Advice Killed Sam Nelson, Family Sues OpenAI — Engadget

### U2 Street of Dreams video (Music · RELEASE)
- 1356 — U2 Shoot 'Street of Dreams' Video on a Bus With Larry Mullen Jr. Back — Rolling Stone
- ⭐ 1416 — U2 Film 'Street of Dreams' Video on a Mexico City School Bus Roof — Rolling Stone

### Wesley Edens extortion (World · BREAKING)
- 1370 — Sophia Luo Charged With Extorting Wesley Edens for $1.2 Billion — Daily Mail
- ⭐ 1394 — Wesley Edens Allegedly Extorted for $1bn by Changli Luo After Affair — Daily Mail

### Nolan / Travis Scott in The Odyssey (Film & TV · FEATURE)
- 1376 — Nolan Cast Travis Scott in The Odyssey Because Rap Is Like Homer — Rolling Stone
- ⭐ 1399 — Nolan Cast Travis Scott in The Odyssey to Echo Rap's Oral Roots — Rolling Stone

### VisionQuest WandaVision finale on Disney+ (Film & TV · RELEASE/BREAKING)
- 1377 — VisionQuest Lands on Disney+ October 14 With James Spader as Ultron — Variety
- ⭐ 1401 — VisionQuest Lands October 14 on Disney+ as the WandaVision Trilogy Finale — Variety

### Charli xcx / Nothing brand ambassador (Tech · FEATURE/BREAKING)
- 1388 — Charli xcx Becomes Nothing Shareholder and First Ambassador — Hypebeast
- ⭐ 1411 — Charli xcx Buys Into Nothing as Its First Ever Brand Ambassador — Hypebeast

---

## Singletons — 15 stories / 15 articles (all keep candidates)

| ID | Title | Source | Tag | Category |
|---|---|---|---|---|
| 1343 | Sergio Ramos Agrees $520M Deal to Buy Boyhood Club Sevilla FC | Dexerto | BREAKING | Sports |
| 1348 | Brett Ratner Joins Trump's China Trip to Scout Rush Hour 4 | Variety | BREAKING | Film & TV |
| 1351 | Clipse and J.I.D Bring Their Hip-Hop Reckoning to Red Rocks | Hypebeast | BREAKING | Music |
| 1355 | Green Day Comedy NIMRODS Hits Theaters August 14 | Billboard | RELEASE | Film & TV |
| 1357 | Ye Loses Copyright Trial Over Uncleared Hurricane Sample | Billboard | BREAKING | Music |
| 1358 | Sushi Toro in Spain Now Charges a Vomit Fee | Dexerto | TREND | Internet |
| 1360 | South Korea Proposes AI Chip Profit Dividend for All Citizens | Semafor | TREND | AI |
| 1361 | Span and Nvidia Want to Bolt AI Data Centers to Your House | Ars Technica | TREND | AI |
| 1362 | Pokemon Opens a Real Gyarados Footbath in Japan | Dexerto | FEATURE | Gaming |
| 1367 | Trump Mobile CEO Says T1 Phone Ships This Week Despite Canceled Preorder Reports | The Verge | BREAKING | Tech |
| 1380 | Fan Throws Phone at Oli Sykes Mid-Show, Gives Him a Concussion | Stereogum | BREAKING | Music |
| 1386 | Barry Keoghan on Playing Ringo Starr and His Wild Side at Cannes | Deadline | INTERVIEW | Film & TV |
| 1400 | Sega Kills Its $800M Super Game, Bets on Crazy Taxi and Jet Set Radio | Hypebeast | BREAKING | Gaming |
| 1407 | Bryan Cranston Teases Wild Madonna Scene in The Studio Season 2 | THR | FEATURE | Film & TV |
| 1415 | The Twigs Counter FKA Twigs, Want Her Banned From Her Own Stage Name | Rolling Stone | BREAKING | Music |

---

## Summary of recommended dedup

- **Keep (46 IDs):** 1328, 1330, 1331, 1332, 1334, 1335, 1336, 1337, 1338, 1340, 1342, 1343, 1347, 1348, 1349, 1350, 1351, 1352, 1355, 1357, 1358, 1360, 1361, 1362, 1363, 1365, 1367, 1371, 1378, 1380, 1383, 1385, 1386, 1394, 1399, 1400, 1401, 1403, 1405, 1406, 1407, 1411, 1413, 1414, 1415, 1416
- **Delete (44 IDs):** 1327, 1329, 1333, 1339, 1341, 1344, 1345, 1346, 1353, 1354, 1356, 1359, 1364, 1366, 1368, 1369, 1370, 1372, 1373, 1374, 1375, 1376, 1377, 1379, 1381, 1382, 1384, 1387, 1388, 1389, 1390, 1391, 1392, 1393, 1395, 1396, 1397, 1398, 1402, 1404, 1408, 1409, 1410, 1412

After dedup → 46 articles. Then normal manual-curation trim to ~24-26.

---

## Feedback / next-step decisions

- [ ] **Confirm dedup IDs above** — or override any keep/drop within a cluster
- [ ] After dedup → 46 articles. Trim to ~24-26 in the usual manual review.
- [ ] Flag any singleton you don't want in the feed (1348 Brett Ratner / Trump, 1380 Oli Sykes phone, 1358 Sushi Toro vomit fee are the borderline-shareable ones).
- [ ] Sega Super Game (1400) and South Korea AI dividend (1360) and Span/Nvidia AI homes (1361) are quality structural-power stories — likely keepers regardless of trim.
