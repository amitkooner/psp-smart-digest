# Changelog

## v4 — 2026-03-22 (Cost Optimization)
- **Switched to Haiku** from Sonnet (~10x cheaper per API call)
- **Added keyword pre-filter** (`isObviouslyIrrelevant_`) that drops ~60-70% of listings before hitting Claude — catches adult furniture, older kid sizes, pet supplies, school topics, etc.
- **Increased batch size** from 10 to 25 listings per API call (fewer calls)
- **Reduced text truncation** from 1500 to 600 chars per listing (less input tokens)
- **Reduced max_tokens** from 4096 to 2048 (less output tokens)
- Daily cost reduced from ~$0.36 to ~$0.01-0.03

## v3 — 2026-03-22 (Link Reliability)
- **Added digest pre-parsing** (`parseDigestIntoListings_`) — splits digest emails into individual listings at the `________` separator before sending to Claude
- **Added link extraction** (`extractLinks_`) — regex-extracts `View This Message` and `Reply To This Message` URLs from each listing
- **Link lookup map** — attaches pre-extracted links to classified items after Claude returns, guaranteeing every item has a clickable link
- **Styled View/Reply button** — upgraded from small text link to a colored button in the digest email

## v2 — 2026-03-22 (Bug Fix)
- Fixed `SpreadsheetApp.getUi()` error for standalone Apps Script projects

## v1 — 2026-03-22 (Initial Release)
- Gmail search for PSP emails (Classifieds, Advice, Events)
- Claude Sonnet classification with age-aware prompting
- Auto-calculated baby age with clothing size and gear stage mapping
- HTML digest email with category grouping and urgency badges
- Gmail auto-labeling by category
- Daily trigger via Apps Script timer
- Manual tools: `testWithWiderWindow`, `previewPSPEmails`, `showConfig`
