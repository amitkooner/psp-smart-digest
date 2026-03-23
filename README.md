# 🌿 PSP Smart Digest

**AI-powered daily digest that filters your Park Slope Parents listserv emails and surfaces only what's relevant to your family.**

Built with Google Apps Script + Claude API. Zero maintenance — your child's age updates automatically and the relevance filters adapt as they grow.

---

## The Problem

The [Park Slope Parents](https://www.parkslopeparents.com/) listserv is an incredible community resource — but it's *high volume*. On a typical day you'll receive 20-30 emails containing hundreds of individual listings across classifieds, advice threads, and event announcements. When you have a 6-month-old, you don't need to see 5T clothing bundles, middle school advice, or adult furniture listings.

## The Solution

PSP Smart Digest runs daily in your Google account and:

1. **Pulls** all new PSP emails from the last 24 hours
2. **Parses** digest emails into individual listings, extracting View/Reply links for each one
3. **Pre-filters** obviously irrelevant items using keyword matching (~60-70% dropped before AI)
4. **Classifies** remaining items with Claude, using your child's auto-calculated age to determine relevance
5. **Sends** a clean, categorized HTML digest email to you (and your partner)
6. **Labels** relevant Gmail threads by category for easy browsing

### What Gets Surfaced

| Category | What it catches | Examples |
|----------|----------------|---------|
| 🍼 Baby Gear | Age-appropriate gear, toys, furniture | Play gyms, jumpers, high chairs, carriers |
| 👗 Clothes | Only in your child's current size range | 6-9M onesies (not 3T jackets) |
| 📅 Activities | Baby-friendly events, meetups, swaps | Babywearing demos, The Big Swap |
| 🆓 Free Stuff | Free items useful for your family | Breast pumps, toy organizers |
| 🏡 Housing | Listings near your locations of interest | Sublets, weekend rentals |

Everything else is filtered out — older kid clothes, school advice, pet supplies, adult furniture, etc.

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────────┐
│  Gmail       │    │ Google Apps   │    │  Claude API  │    │ Digest Email  │
│  (PSP emails)│───▶│ Script       │───▶│  (Haiku)     │───▶│ (to you +     │
│              │    │ (daily 7am)  │    │  classify    │    │  partner)     │
└─────────────┘    └──────────────┘    └──────────────┘    └───────────────┘
                          │
                    ┌─────┴──────┐
                    │ Pre-filter  │  ← Drops ~60-70% of listings
                    │ (keywords)  │    before API call
                    └────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ Gmail Labels  │
                   │ PSP/Baby Gear │
                   │ PSP/Activities│
                   │ PSP/Free Stuff│
                   │ PSP/Housing   │
                   └──────────────┘
```

## Cost

| Component | Cost |
|-----------|------|
| Google Apps Script | Free |
| Claude API (Haiku) | ~$0.01–0.03/day |
| **Monthly estimate** | **~$0.50–1.00** |

The three-layer cost optimization (keyword pre-filter → aggressive text truncation → Haiku model) keeps daily runs well under $0.05.

## Setup (10 minutes)

### Prerequisites

- A Gmail account subscribed to [Park Slope Parents](https://www.parkslopeparents.com/)
- A Claude API key from [console.anthropic.com](https://console.anthropic.com/settings/keys) (add ~$5 in credits)

### Step 1: Create the Google Apps Script

1. Go to [script.google.com](https://script.google.com) and click **New Project**
2. Delete any default code in the editor
3. Copy and paste the entire contents of [`Code.gs`](Code.gs)
4. Rename the project to "PSP Smart Digest" (click "Untitled project" at top)

### Step 2: Configure

Edit the `CONFIG` section at the top of the script:

```javascript
BABY_BIRTHDATE: "2025-10-01",  // ← Your child's birthdate
DIGEST_RECIPIENTS: [
  "you@gmail.com",              // ← Your email
  "partner@gmail.com",          // ← Partner's email (optional)
],
LOCATIONS_OF_INTEREST: [
  "Williamsburg",               // ← Add/remove your locations
  "upstate",
  "Hudson Valley",
  // ...
],
```

### Step 3: Store Your API Key

1. In the Apps Script editor, click **⚙️ Project Settings**
2. Scroll to **Script Properties** → **Add Script Property**
3. Key: `ANTHROPIC_API_KEY`
4. Value: your `sk-ant-...` key
5. Click **Save**

### Step 4: Run Initial Setup

1. Select `initialSetup` from the function dropdown → click **▶ Run**
2. Authorize the permissions when prompted (Gmail read/send/label access)
3. Check the Execution Log for confirmation

### Step 5: Test

1. Select `runDailyDigest` → click **▶ Run**
2. Check your email for the digest!
3. Use `testWithWiderWindow` to test with 3 days of data

## Configuration Reference

| Setting | Default | Description |
|---------|---------|-------------|
| `BABY_BIRTHDATE` | `"2025-10-01"` | Child's birthdate — used to auto-calculate age, sizes, and gear stage |
| `DIGEST_RECIPIENTS` | `[]` | Array of email addresses to receive the daily digest |
| `LOCATIONS_OF_INTEREST` | Williamsburg, upstate NY | Locations to watch for housing and local activities |
| `HOURS_LOOKBACK` | `24` | How far back to scan for new emails |
| `DIGEST_HOUR` | `7` | What hour (24h format) to send the daily digest |
| `CLAUDE_MODEL` | `claude-haiku-4-5-20251001` | AI model — Haiku is recommended for cost efficiency |

## How Age-Aware Filtering Works

The script auto-calculates your child's age from their birthdate on every run and adjusts two things:

**Clothing sizes** — only surfaces listings in the right size range:

| Age | Sizes Surfaced |
|-----|---------------|
| 0–3 months | NB, 0-3M, 3M |
| 3–6 months | 3-6M, 6M, 3M |
| 6–9 months | 6-9M, 6-12M, 9M |
| 9–12 months | 9-12M, 6-12M, 12M |
| 12–18 months | 12M, 12-18M, 18M |
| 18–24 months | 18-24M, 18M, 24M, 2T |

**Gear stage** — tells Claude what equipment is relevant now:

| Age | Relevant Gear |
|-----|--------------|
| 0–4 months | Swaddles, bouncers, bassinets, play mats, nursing supplies |
| 4–7 months | Play gyms, activity centers, bumbo seats, teethers, carriers |
| 7–10 months | Baby gates, playpens, push toys, high chairs, sippy cups |
| 10–13 months | Push walkers, shape sorters, ride-ons, convertible car seats |
| 13–24 months | Ride-on toys, building blocks, toddler bikes, potty training |

## Utility Functions

| Function | Description |
|----------|-------------|
| `runDailyDigest` | Main function — runs the full pipeline |
| `testWithWiderWindow` | Same as above but looks back 3 days (for testing) |
| `previewPSPEmails` | Lists PSP emails found without classifying (dry run) |
| `showConfig` | Prints current configuration and baby age to the log |
| `initialSetup` | One-time setup: creates labels, sets daily trigger |

## Customization

### Adapt for a different listserv

The digest parsing logic (`parseDigestIntoListings_`) splits on `________` separator lines and extracts `View This Message:` / `Reply To This Message:` URLs — this is specific to the groups.io digest format used by PSP. To adapt for a different listserv:

1. Update the Gmail search query in `fetchPSPEmails_` to match the sender
2. Adjust `parseDigestIntoListings_` for the email's separator format
3. Adjust `extractLinks_` for the link format used
4. Update the keyword pre-filter in `isObviouslyIrrelevant_` for your domain

### Run twice daily

In `initialSetup`, change `.everyDays(1)` to `.everyHours(12)`.

### Use a smarter model

For better classification quality at higher cost, change `CLAUDE_MODEL` to `claude-sonnet-4-20250514`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Cannot call SpreadsheetApp.getUi()` | Make sure you're using v4+ of the script (this was fixed) |
| No emails found | Run `previewPSPEmails` to verify Gmail search finds your PSP emails |
| API error / 401 | Run `showConfig` to verify API key is set in Script Properties |
| Auth error on first run | Click through Google's permission prompts — the script only accesses your Gmail |
| Digest not arriving | Check spam folder; verify recipient emails in CONFIG |
| High API costs | Ensure you're on Haiku model; check pre-filter is dropping listings in the log |

## License

MIT — see [LICENSE](LICENSE).

## Credits

Built with [Claude](https://claude.ai) by Anthropic. Designed for the Park Slope Parents community in Brooklyn, NY.
