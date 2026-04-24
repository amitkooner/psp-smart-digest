# Changelog

## v7 — 2026-04-23 (Location + Focus Refinement)
- **Split locations** into `PICKUP_LOCATIONS` (North Brooklyn only) and `HOUSING_LOCATIONS` (North Brooklyn + upstate)
- **Hard location post-filter** — deterministically drops gear/clothes/free stuff with pickup locations outside North Brooklyn (Park Slope, South Slope, Cobble Hill, Manhattan, etc.). Housing and activities are exempt.
- **Added FOCUS_ITEMS config** — easily update what you're currently looking for (strollers, summer clothes, play sets, activities) without touching the rest of the code
- **Claude prompt updated** to always populate the location field for reliable post-filtering
- **Added partner's email** to digest recipients
- **Fixed baby birthdate** to actual date
- **Redacted PII** for public GitHub repo

## v6 — 2026-04-23 (Breastfeeding Filter + Activities)
- **Breastfeeding/nursing filter** — drops breast pumps, nursing bras, Haakaa, Lansinoh, Spectra, Medela, Boppy, lactation items (family is formula feeding)
- **Walking groups and bonding events** added to keep-list: walking groups, stroller walks, playdates, mom/dad/parent groups, bonding events, music classes, story time
- **Expanded North Brooklyn locations** — added East Williamsburg, Bed-Stuy, Clinton Hill, Fort Greene, DUMBO, Downtown Brooklyn, Brooklyn Heights, High Falls

## v4 — 2026-03-22 (Cost Optimization)
- **Switched to Haiku** from Sonnet (~10x cheaper per API call)
- **Added keyword pre-filter** (`isObviouslyIrrelevant_`) that drops ~60-70% of listings before hitting Claude
- **Increased batch size** from 10 to 25 listings per API call
- **Reduced text truncation** from 1500 to 600 chars per listing
- Daily cost reduced from ~$0.36 to ~$0.01-0.03

## v3 — 2026-03-22 (Link Reliability)
- **Added digest pre-parsing** — splits digest emails into individual listings before sending to Claude
- **Added link extraction** — regex-extracts `View This Message` and `Reply To This Message` URLs
- **Link lookup map** — guarantees every classified item has a clickable link
- **Styled View/Reply button** in digest email

## v2 — 2026-03-22 (Bug Fix)
- Fixed `SpreadsheetApp.getUi()` error for standalone Apps Script projects

## v1 — 2026-03-22 (Initial Release)
- Gmail search for PSP emails (Classifieds, Advice, Events)
- Claude classification with age-aware prompting
- Auto-calculated baby age with clothing size and gear stage mapping
- HTML digest email with category grouping and urgency badges
- Gmail auto-labeling by category
- Daily trigger via Apps Script timer
