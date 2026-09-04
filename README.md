# Honeymoon · Adi & Netanel · Taiwan and Japan 2026

Trip site: **https://honeymoon-netanel-adi.netlify.app**

36 days, September 1 – October 8, 2026. A single Hebrew (RTL) web app that holds the
itinerary, hotels, flights, saved places, expenses and reminders. It works offline, and
it syncs between Netanel's phone and Adi's.

---

## The tabs

In tab-bar order — right to left, like the rest of the page. Tab labels below are the
Hebrew text as it appears in the app, with an English gloss.

| Tab | What's in it |
|---|---|
| 🧭 **סקירה** (Overview) | The "today" panel — tonight's hotel, tomorrow's move, the next reminder, the weather, today's spending and the cash left for the day. Countdown and general info below it. |
| 🗓️ **היומן · 36 ימים** (Itinerary) | A card per day with an hour-by-hour schedule, free-text search, and personal notes. |
| 💸 **הוצאות** (Expenses) | Day-to-day spending on the road — each entry converted to ₪ at the rate of the moment, card purchases in foreign currency with their estimated conversion fee — a daily cash wallet (how much cash you took, how much is left), and the prepaid budget underneath. |
| 🍜 **איפה אוכלים** (Where to eat) | 82 recommendations; each card opens straight in Google Maps. |
| 📍 **כל המקומות** (All places) | 475 saved places, grouped by day and by saved list. |
| 🗺️ **מפת המסלול** (Route map) | The whole route on one map. |
| 🏨 **מלונות** (Hotels) | All 13 hotels with addresses, dates and costs. |
| ✈️ **טיסות ורכב** (Flights & car) | Boarding passes for all five flights, plus the car rental details. |
| ⏰ **תזכורות** (Reminders) | What still needs booking or doing, ordered by urgency. |
| ✅ **צ׳קליסט** (Checklist) | Packing and gear list. |
| 🧰 **כלים** (Tools) | Clocks, a currency converter on live rates, weather, emergency and insurance numbers, backup and restore. |

The order follows when things get used: what you touch daily on the trip comes first,
what you close out before departure comes after, and tools last.

---

## Changing things while you're travelling

**Most changes need no code at all.** Open the site on a phone and edit in place:

| What | Where in the app |
|---|---|
| Log an expense on the road | **💸 הוצאות** tab, "new expense" button (or from the Overview, in the "today's spending" box) |
| How much cash you took for the day | **💸 הוצאות** tab, the "cash for the day" card (or the button in the Overview's "today's spending" box). Every cash expense you log that day comes off the balance. |
| The conversion fee your card charges | **💸 הוצאות** tab, the percentage next to "conversion fee" in the summary (per device, default 1%) |
| Add, edit or delete a budget line | **💸 הוצאות** tab, inside "the full breakdown" |
| Add, edit or delete a reminder | **⏰ תזכורות** tab |
| A personal note on a given day | At the bottom of each day card in the itinerary |
| A new place on Maps | **📍 כל המקומות** tab, add button at the top |
| A checklist item, or ticking one off | **✅ צ׳קליסט** tab |
| Back up or restore everything | **🧰 כלים** tab, "our changes" card |

Everything is saved and synced between Netanel and Adi automatically — every 45 seconds,
and again whenever the app regains focus. It works with no connection too: changes are
stored locally and pushed once signal returns.

Wherever there is a "restore the original list" button, it only clears what you added or
edited. It never touches the rest of the site.

## When a new version ships

After a change to the site, a banner appears at the top: **"✨ יש גרסה חדשה של האתר"**
(a new version of the site is available). One tap on "רענון" (refresh) loads it. There is
no need to refresh twice.

## When the structure itself needs to change

Rewriting a day in the itinerary, adding a train table, adding a tab — that does need a
code change. Open **Claude in the app**, pick this repo, and ask for it. Every push to
`main` publishes the site automatically within about a minute.

---

## Project layout

| File | Role |
|---|---|
| `index.html` | The entire site — one file. Hebrew RTL page, no build pipeline. |
| `sw.js` | Service worker — offline use and the update banner. |
| `manifest.webmanifest` + the icons | Install to the home screen as an app. |
| `build.mjs` | Copies the source files into `dist/` (the publish directory) and stamps the service worker version with a fingerprint of the page content. |
| `netlify.toml` | Automatic deploy configuration. |
| `deploy.mjs` | Manual deploy from a local machine through the API. Not needed while automatic deploys are in place. |
| `netlify/functions/trip.js` | The shared store — Netlify Blobs, merged per item by timestamp. |
| `CLAUDE.md` | All project context and history. **Read it before any significant change.** |
| `טיול ירח דבש.docx` | The source itinerary document. |
| `הוצאות ירח דבש.xlsx` | The expenses spreadsheet. |
| `csv-source/` | Saved place lists exported from Google Maps (Takeout). |
| `*.pdf` | Source documents: the insurance policy and the flight itinerary. |

**Important:** only `dist/` is published to the web. The Word file, the spreadsheet and
the PDFs are never reachable from the site. `dist/` itself is a build artifact and is not
kept in git.

That protects the *website*, not the *repository*: anyone who can see the repo can read
those files, and some of them carry personal data. Check the repo's visibility before
assuming they are private.

## Deploying

Automatic on every push to `main` — Netlify runs `node build.mjs` and publishes `dist/`.
Manual deploy from a local machine: `node deploy.mjs` (needs `.netlify-token.txt`, which
is not in the repo).
