# 🌿 PSP Smart Digest

**AI-powered daily digest that filters your Park Slope Parents listserv emails and surfaces only what's relevant to your family.**

Built with Google Apps Script + Claude API (Haiku). Zero maintenance — your child's age updates automatically and the relevance filters adapt as they grow.

---

## The Problem

The [Park Slope Parents](https://www.parkslopeparents.com/) listserv is an incredible community resource — but it's *high volume*. On a typical day you'll receive 20-30 emails containing hundreds of individual listings across classifieds, advice threads, and event announcements. When you have a 6-month-old, you don't need to see 5T clothing bundles, middle school advice, or adult furniture listings.

## The Solution

PSP Smart Digest runs daily in your Google account and:

1. **Pulls** all new PSP emails from the last 24 hours
2. **Parses** digest emails into individual listings, extracting View/Reply links for each one
3. **Pre-filters** obviously irrelevant items using keyword matching (~60-70% dropped before AI)
4. **Classifies** remaining items with Claude, using your child's auto-calculated age to determine relevance
5. **Post-filters** items outside your pickup radius (deterministic, not AI)
6. **Sends** a clean, categorized HTML digest email to you (and your partner)
7. **Labels** relevant Gmail threads by category for easy browsing

### What Gets Surfaced

| Category | What it catches | Examples |
|----------|----------------|---------|
| 🍼 Baby Gear | Age-appropriate gear, toys, furniture | Strollers, play sets, high chairs, carriers |
| 👗 Clothes | Only in your child's current size range | 6-9M summer outfits (not 3T jackets) |
| 📅 Activities | Baby-friendly events, meetups, swaps | Walking groups, bonding events, The Big Swap |
| 🆓 Free Stuff | Free items useful for your family | Toy organizers, baby gear |
| 🏡 Housing | Listings near your locations of interest | Sublets, weekend rentals |

Everything else is filtered out — older kid clothes, school advice, pet supplies, adult furniture, items outside your pickup area, etc.

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────────┐
│  Gmail       │    │ Google Apps   │    │  Claude API  │    │ Digest Email  │
│  (PSP emails)│───▶│ Script       │───▶│  (Haiku)     │───▶│ (to you +     │
│              │    │ (daily 7am)  │    │  classify    │    │  partner)     │
└─────────────┘    └──────────────┘    └──────────────┘    └───────────────┘
                          │                                        │
                    ┌─────┴──────┐                          ┌──────┴──────┐
                    │ Pre-filter  │                          │ Post-filter  │
                    │ (keywords)  │                          │ (location)   │
                    └────────────┘                          └─────────────┘
                  Drops ~60-70% of                        Drops items outside
                  listings before                         your pickup area
                  API call                                (deterministic)
```

## Three-Layer Filtering

The system uses three layers to maximize relevance while minimizing cost:

1. **Keyword pre-filter** (before API call) — drops obviously irrelevant listings using regex patterns: older kid sizes, adult furniture, pet supplies, school topics, breastfeeding items (configurable), etc. Saves ~60-70% of API costs.

2. **AI classification** (Claude Haiku) — classifies remaining listings using your child's auto-calculated age, relevant clothing sizes, gear stage, focus items, and pickup locations.

3. **Location post-filter** (after API call) — deterministically drops items with pickup locations outside your configured area. Housing and activities are exempt (different location rules).

## Cost

| Component | Cost |
|-----------|------|
| Google Apps Script | Free |
| Claude API (Haiku) | ~$0.01–0.03/day |
| **Monthly estimate** | **~$0.50–1.00** |

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
BABY_BIRTHDATE: "2025-01-01",  // ← Your child's actual birthdate

DIGEST_RECIPIENTS: [
  "your-email@gmail.com",       // ← Your email
  "partner-email@gmail.com",    // ← Partner's email (optional)
],

PICKUP_LOCATIONS: [              // ← Neighborhoods you'll pick up items from
  "Williamsburg",
  "Greenpoint",
  // ...
],

HOUSING_LOCATIONS: [             // ← Areas to watch for housing (can be broader)
  "Williamsburg",
  "upstate",
  "Hudson Valley",
  // ...
],

FOCUS_ITEMS: [                   // ← What you're specifically looking for right now
  "strollers",
  "summer clothing sets (9 months and up)",
  "activities and classes for babies",
  "play sets and playgrounds",
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
| `BABY_BIRTHDATE` | `"2025-01-01"` | Child's birthdate — used to auto-calculate age, sizes, and gear stage |
| `DIGEST_RECIPIENTS` | `[]` | Array of email addresses to receive the daily digest |
| `PICKUP_LOCATIONS` | North Brooklyn | Neighborhoods you'll travel to for item pickup |
| `HOUSING_LOCATIONS` | North Brooklyn + upstate | Locations to watch for housing listings |
| `FOCUS_ITEMS` | Strollers, summer clothes, activities, play sets | What you're specifically looking for right now |
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
| 0–4 months | Swaddles, bouncers, bassinets, play mats, infant car seats |
| 4–7 months | Play gyms, activity centers, bumbo seats, teethers, carriers |
| 7–10 months | Baby gates, playpens, push toys, high chairs, sippy cups |
| 10–13 months | Push walkers, shape sorters, ride-ons, convertible car seats |
| 13–24 months | Ride-on toys, building blocks, toddler bikes, potty training |

## Customization

### Update your focus items

As your child's needs change, update the `FOCUS_ITEMS` array — no other code changes needed:

```javascript
FOCUS_ITEMS: [
  "winter jackets",
  "toddler bikes",
  "preschool recommendations",
],
```

### Change digest time

Edit `DIGEST_HOUR` in CONFIG (24-hour format), then re-run `initialSetup`.

### Adjust pickup radius

Add or remove neighborhoods from `PICKUP_LOCATIONS`. The post-filter has a built-in exclusion list for areas outside North Brooklyn — edit the `excludedAreas` array in the post-filter section to customize.

### Filter out specific item types

Add patterns to the `isObviouslyIrrelevant_` function. For example, the breastfeeding filter:

```javascript
var bfPatterns = [/\bbreast\s*pump\b/i, /\blactation\b/i, /\bhaakaa\b/i, ...];
```

### Run twice daily

In `initialSetup`, change `.everyDays(1)` to `.everyHours(12)`.

### Use a smarter model

For better classification quality at higher cost, change `CLAUDE_MODEL` to `claude-sonnet-4-20250514`.

## Utility Functions

| Function | Description |
|----------|-------------|
| `runDailyDigest` | Main function — runs the full pipeline |
| `testWithWiderWindow` | Same as above but looks back 3 days (for testing) |
| `previewPSPEmails` | Lists PSP emails found without classifying (dry run) |
| `showConfig` | Prints current configuration and baby age to the log |
| `initialSetup` | One-time setup: creates labels, sets daily trigger |

## Adapting for a Different Listserv

The digest parsing logic is specific to PSP's groups.io format. To adapt:

1. Update the Gmail search query in `fetchPSPEmails_` to match the sender
2. Adjust `parseDigestIntoListings_` for the email's separator format
3. Adjust `extractLinks_` for the link format used
4. Update the keyword pre-filter in `isObviouslyIrrelevant_` for your domain
5. Update the location post-filter's `excludedAreas` for your geography

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No emails found | Run `previewPSPEmails` to verify Gmail search finds your PSP emails |
| API error / 401 | Run `showConfig` to verify API key is set in Script Properties |
| Auth error on first run | Click through Google's permission prompts — the script only accesses your Gmail |
| Digest not arriving | Check spam folder; verify recipient emails in CONFIG |
| High API costs | Ensure you're on Haiku model; check pre-filter is dropping listings in the log |
| Items from wrong area | Check the post-filter log line; add neighborhoods to `excludedAreas` if needed |
| Wrong baby age | Verify `BABY_BIRTHDATE` format is `YYYY-MM-DD` |

## License

MIT — see [LICENSE](LICENSE).

## Credits

Built with [Claude](https://claude.ai) by Anthropic. Designed for the Park Slope Parents community in Brooklyn, NY.
