// ============================================================================
// PSP SMART DIGEST — AI-Powered Park Slope Parents Email Filter
// ============================================================================
// 
// SETUP INSTRUCTIONS:
// 1. Go to https://script.google.com and create a new project
// 2. Paste this entire file into the editor (replace any default code)
// 3. Update the CONFIG section below with your details
// 4. Run "initialSetup" from the function dropdown to:
//    - Store your API key securely
//    - Create Gmail labels
//    - Set up the daily trigger
// 5. Run "runDailyDigest" manually to test, then let the trigger handle it daily
//
// To get a Claude API key: https://console.anthropic.com/settings/keys
// ============================================================================

// ── CONFIGURATION ──────────────────────────────────────────────────────────
const CONFIG = {
  // Your daughter's birthdate (used to auto-calculate age for relevance filtering)
  BABY_BIRTHDATE: "2025-09-12",

  // Who receives the daily digest email
  DIGEST_RECIPIENTS: [
    "amit.kooner@gmail.com",
    "alecia.chen@gmail.com",
  ],

  // Pickup locations — North Brooklyn only (for gear, clothes, free stuff)
  PICKUP_LOCATIONS: [
    "Williamsburg",
    "East Williamsburg",
    "Greenpoint",
    "Bushwick",
    "Bed-Stuy",
    "Bedford-Stuyvesant",
    "Clinton Hill",
    "Fort Greene",
    "DUMBO",
    "Downtown Brooklyn",
    "Brooklyn Heights",
    "North Brooklyn",
  ],

  // Housing locations — includes upstate
  HOUSING_LOCATIONS: [
    "Williamsburg",
    "East Williamsburg",
    "Greenpoint",
    "Bushwick",
    "Bed-Stuy",
    "Bedford-Stuyvesant",
    "Clinton Hill",
    "Fort Greene",
    "DUMBO",
    "Downtown Brooklyn",
    "Brooklyn Heights",
    "North Brooklyn",
    "upstate",
    "Hudson Valley",
    "Catskills",
    "Ulster County",
    "Dutchess County",
    "High Falls",
  ],

  // Current focus items (update as needs change)
  FOCUS_ITEMS: [
    "strollers",
    "summer clothing sets (9 months and up)",
    "activities and classes for babies",
    "play sets and playgrounds",
    "baby formula",
  ],

  // Categories to surface (you can toggle these)
  CATEGORIES: {
    BABY_GEAR: true,       // Age-appropriate gear, furniture, toys
    CLOTHES: true,         // Baby/toddler clothes in the right size range
    ACTIVITIES: true,      // Classes, meetups, events for babies
    FREE_STUFF: true,      // Free items (FF posts)
    HOUSING: true,         // Rentals, sublets, housing in your areas
    DEALS: true,           // Notably good deals on relevant items
  },

  // How far back to look for emails (in hours)
  HOURS_LOOKBACK: 24,

  // Gmail label to apply to processed emails
  GMAIL_LABEL: "PSP/Processed",

  // Gmail labels for relevant categories (auto-created)
  CATEGORY_LABELS: {
    BABY_GEAR: "PSP/Baby Gear",
    ACTIVITIES: "PSP/Activities",
    FREE_STUFF: "PSP/Free Stuff",
    HOUSING: "PSP/Housing",
  },

  // What time to send the daily digest (hour in your timezone, 24hr format)
  DIGEST_HOUR: 7, // 7 AM

  // Claude model to use (Haiku is ideal for classification — ~10x cheaper than Sonnet)
  CLAUDE_MODEL: "claude-haiku-4-5-20251001",
};

// ── INITIAL SETUP (Run this once) ──────────────────────────────────────────

function initialSetup() {
  // Step 1: Check for API key in Script Properties
  // (Set it via Project Settings > Script Properties > ANTHROPIC_API_KEY)
  const props = PropertiesService.getScriptProperties();
  const existingKey = props.getProperty("ANTHROPIC_API_KEY");

  if (!existingKey) {
    // If running from Apps Script editor, you can set it manually:
    // Go to Project Settings (gear icon) > Script Properties > Add
    // Key: ANTHROPIC_API_KEY  Value: sk-ant-...
    Logger.log("⚠️  IMPORTANT: Set your API key in Project Settings > Script Properties");
    Logger.log("   Key name: ANTHROPIC_API_KEY");
    Logger.log("   Value: your sk-ant-... key from https://console.anthropic.com/settings/keys");
    Logger.log("");
  } else {
    Logger.log("✅ API key already configured");
  }

  // Step 2: Create Gmail labels
  createLabelsIfNeeded_();
  Logger.log("✅ Gmail labels created");

  // Step 3: Set up daily trigger
  deleteExistingTriggers_();
  ScriptApp.newTrigger("runDailyDigest")
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.DIGEST_HOUR)
    .create();
  Logger.log("✅ Daily trigger set for " + CONFIG.DIGEST_HOUR + ":00");

  Logger.log("");
  Logger.log("🎉 Setup complete! Run 'runDailyDigest' to test now, or wait for the daily trigger.");
}

// ── MAIN FUNCTION ──────────────────────────────────────────────────────────

function runDailyDigest() {
  const startTime = new Date();
  Logger.log("🚀 Starting PSP Smart Digest at " + startTime.toLocaleString());

  // 1. Calculate baby's current age
  const babyAge = calculateBabyAge_();
  Logger.log("👶 Baby age: " + babyAge.months + " months (" + babyAge.description + ")");

  // 2. Fetch recent PSP emails
  const emails = fetchPSPEmails_();
  Logger.log("📧 Found " + emails.length + " PSP emails in the last " + CONFIG.HOURS_LOOKBACK + " hours");

  if (emails.length === 0) {
    Logger.log("No new emails to process. Done!");
    return;
  }

  // 3. Pre-parse digest emails into individual listings with links extracted
  var allListings = [];
  for (var e = 0; e < emails.length; e++) {
    var email = emails[e];
    if (email.type === "classifieds" || email.type === "advice") {
      // Digest email — split into individual listings
      var listings = parseDigestIntoListings_(email);
      allListings = allListings.concat(listings);
    } else {
      // Standalone email (events, special notices) — treat as one listing
      var links = extractLinks_(email.body);
      allListings.push({
        listing_id: "email_" + e,
        subject: email.subject,
        from: email.from,
        date: email.date,
        body: truncateText_(email.body, 800),
        type: email.type,
        view_link: links.view_link,
        reply_link: links.reply_link,
        source_subject: email.subject,
        threadId: email.threadId,
      });
    }
  }

  Logger.log("📋 Parsed " + allListings.length + " individual listings from " + emails.length + " emails");

  // 3b. Pre-filter: drop obviously irrelevant listings using keywords BEFORE calling Claude
  var filteredListings = allListings.filter(function(listing) {
    return !isObviouslyIrrelevant_(listing.body, babyAge);
  });
  Logger.log("🔍 Pre-filter: " + filteredListings.length + " potentially relevant (dropped " +
    (allListings.length - filteredListings.length) + " obviously irrelevant)");

  // Build a link lookup map so we can attach links AFTER Claude classifies
  var linkMap = {};
  for (var l = 0; l < allListings.length; l++) {
    linkMap[allListings[l].listing_id] = {
      view_link: allListings[l].view_link,
      reply_link: allListings[l].reply_link,
    };
  }

  // 4. Classify with Claude (batch into chunks to stay under context limits)
  var allClassified = [];
  var chunks = chunkArray_(filteredListings, 25); // 25 listings per API call (larger batches = fewer calls)

  for (var i = 0; i < chunks.length; i++) {
    Logger.log("🤖 Classifying batch " + (i + 1) + " of " + chunks.length + " (" + chunks[i].length + " listings)...");
    var classified = classifyWithClaude_(chunks[i], babyAge);
    if (classified && classified.length > 0) {
      // Attach the pre-extracted links to each classified item
      for (var c = 0; c < classified.length; c++) {
        var item = classified[c];
        var links = linkMap[item.listing_id] || {};
        if (!item.reply_link || item.reply_link === "null" || item.reply_link === null) {
          item.reply_link = links.reply_link || links.view_link || null;
        }
        if (!item.view_link) {
          item.view_link = links.view_link || null;
        }
      }
      allClassified = allClassified.concat(classified);
    }
    // Small delay to respect rate limits
    if (i < chunks.length - 1) Utilities.sleep(1000);
  }

  Logger.log("✅ Classification complete: " + allClassified.length + " relevant items found");

  // 4b. Hard post-filter: drop items with pickup locations outside North Brooklyn
  // This is deterministic — Claude sometimes lets Park Slope items through
  var beforeFilter = allClassified.length;
  allClassified = allClassified.filter(function(item) {
    // Don't filter housing — those have different location rules
    if (item.category === "HOUSING") return true;
    // Don't filter activities — we'll go to nearby areas for good events
    if (item.category === "ACTIVITIES") return true;

    // Check the location field for non-North-Brooklyn areas
    var loc = (item.location || "").toLowerCase();

    var excludedAreas = [
      "park slope", "south slope", "windsor terrace", "kensington",
      "bay ridge", "sunset park", "borough park", "bensonhurst",
      "flatbush", "prospect park south", "ditmas park", "midwood",
      "sheepshead bay", "brighton beach", "coney island", "gravesend",
      "crown heights", "brownsville", "east new york",
      "cobble hill", "carroll gardens", "red hook", "gowanus",
      "boerum hill", "prospect heights",
      "manhattan", "queens", "bronx", "staten island",
      "upper west", "upper east", "midtown", "tribeca", "soho",
    ];

    for (var ex = 0; ex < excludedAreas.length; ex++) {
      // Only drop if the excluded area appears in the location field specifically
      // (not just in the description, which might mention it in passing)
      if (loc.indexOf(excludedAreas[ex]) > -1) return false;
    }
    return true;
  });

  if (beforeFilter > allClassified.length) {
    Logger.log("📍 Location post-filter: dropped " + (beforeFilter - allClassified.length) +
      " items outside North Brooklyn (kept " + allClassified.length + ")");
  }

  // 5. Apply Gmail labels to relevant threads
  applyGmailLabels_(allClassified, emails);

  // 6. Build and send digest email
  if (allClassified.length > 0) {
    sendDigestEmail_(allClassified, babyAge);
    Logger.log("📬 Digest email sent to " + CONFIG.DIGEST_RECIPIENTS.join(", "));
  } else {
    Logger.log("No relevant items found today — no digest sent.");
  }

  var elapsed = ((new Date() - startTime) / 1000).toFixed(1);
  Logger.log("⏱️ Completed in " + elapsed + " seconds");
}

// ── BABY AGE CALCULATOR ────────────────────────────────────────────────────

function calculateBabyAge_() {
  var birthdate = new Date(CONFIG.BABY_BIRTHDATE);
  var now = new Date();
  var ageMs = now - birthdate;
  var ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  var ageMonths = Math.floor(ageDays / 30.44); // average days per month
  var ageWeeks = Math.floor(ageDays / 7);

  var description = "";
  if (ageMonths < 1) {
    description = ageWeeks + " weeks old (newborn)";
  } else if (ageMonths < 12) {
    description = ageMonths + " months old";
  } else {
    var years = Math.floor(ageMonths / 12);
    var remainingMonths = ageMonths % 12;
    description = years + " year" + (years > 1 ? "s" : "") +
      (remainingMonths > 0 ? " and " + remainingMonths + " months" : "") + " old";
  }

  // Size ranges that are relevant for this age
  var clothingSizes = getClothingSizes_(ageMonths);
  var gearStage = getGearStage_(ageMonths);

  return {
    months: ageMonths,
    weeks: ageWeeks,
    days: ageDays,
    description: description,
    clothingSizes: clothingSizes,
    gearStage: gearStage,
  };
}

function getClothingSizes_(ageMonths) {
  // Returns array of relevant clothing sizes (current + one size up)
  if (ageMonths < 3) return ["NB", "0-3M", "3M"];
  if (ageMonths < 6) return ["3-6M", "6M", "3M"];
  if (ageMonths < 9) return ["6-9M", "6-12M", "9M"];
  if (ageMonths < 12) return ["9-12M", "6-12M", "12M"];
  if (ageMonths < 18) return ["12M", "12-18M", "18M"];
  if (ageMonths < 24) return ["18-24M", "18M", "24M", "2T"];
  if (ageMonths < 36) return ["2T", "3T", "24M"];
  if (ageMonths < 48) return ["3T", "4T"];
  return ["4T", "5T"];
}

function getGearStage_(ageMonths) {
  if (ageMonths < 4) {
    return "newborn: swaddles, bouncers, bassinets, play mats, infant car seats, nursing/pumping supplies";
  }
  if (ageMonths < 7) {
    return "pre-mobile: play gyms, activity centers/jumpers, exersaucers, bumbo seats, high chairs (starting solids soon), baby carriers/wraps, tummy time toys, rattles, teethers";
  }
  if (ageMonths < 10) {
    return "early crawler: baby gates, playpens/play yards, push toys, stacking toys, baby-proofing supplies, convertible high chairs, sippy cups, baby spoons";
  }
  if (ageMonths < 13) {
    return "cruiser/early walker: push walkers, shape sorters, ball pits, ride-on toys, toddler shoes, baby monitors, convertible car seats";
  }
  if (ageMonths < 24) {
    return "toddler: ride-on toys, play kitchens, building blocks, toddler bikes/trikes, potty training supplies, toddler beds, book sets";
  }
  return "preschooler: bikes, art supplies, play sets, educational toys, sports equipment";
}

// ── GMAIL FETCHING ─────────────────────────────────────────────────────────

function fetchPSPEmails_() {
  var hoursAgo = new Date(Date.now() - CONFIG.HOURS_LOOKBACK * 60 * 60 * 1000);
  var dateStr = Utilities.formatDate(hoursAgo, Session.getScriptTimeZone(), "yyyy/MM/dd");

  var query = "from:groups.parkslopeparents.com after:" + dateStr;
  var threads = GmailApp.search(query, 0, 50); // max 50 threads

  var emails = [];
  for (var t = 0; t < threads.length; t++) {
    var messages = threads[t].getMessages();
    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      // Only process messages newer than our lookback window
      if (msg.getDate() < hoursAgo) continue;

      var subject = msg.getSubject();
      var from = msg.getFrom();
      var body = msg.getPlainBody();

      // Determine email type
      var type = "other";
      if (subject.indexOf("Classifieds") > -1) type = "classifieds";
      else if (subject.indexOf("Advice") > -1) type = "advice";
      else if (from.indexOf("events=") > -1 || subject.indexOf("[PSP") > -1) type = "events";

      emails.push({
        id: msg.getId(),
        threadId: threads[t].getId(),
        subject: subject,
        from: from,
        date: msg.getDate().toLocaleString(),
        body: body,
        type: type,
        gmailThread: threads[t],
      });
    }
  }

  return emails;
}

// ── CLAUDE CLASSIFICATION ──────────────────────────────────────────────────

function classifyWithClaude_(emailBatch, babyAge) {
  var apiKey = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!apiKey) {
    Logger.log("❌ ERROR: No API key found. Run initialSetup() and set ANTHROPIC_API_KEY in Script Properties.");
    return [];
  }

  var pickupLocationsStr = CONFIG.PICKUP_LOCATIONS.join(", ");
  var housingLocationsStr = CONFIG.HOUSING_LOCATIONS.join(", ");
  var focusStr = CONFIG.FOCUS_ITEMS.join("; ");
  var sizesStr = babyAge.clothingSizes.join(", ");

  var systemPrompt = 'You are a smart email classifier for a parent with a ' + babyAge.description + ' baby girl.\n\n' +
    'CONTEXT:\n' +
    '- Baby is ' + babyAge.description + '\n' +
    '- Relevant clothing sizes: ' + sizesStr + '\n' +
    '- Relevant gear stage: ' + babyAge.gearStage + '\n' +
    '- The family lives in Williamsburg, Brooklyn and also has a place upstate in High Falls, NY\n' +
    '- Pickup locations (for gear, clothes, free stuff): ONLY items available for pickup in North Brooklyn: ' + pickupLocationsStr + '. Skip items only available in Park Slope, South Brooklyn, Manhattan, or other areas.\n' +
    '- Housing locations: ' + housingLocationsStr + '\n\n' +
    '- CURRENT FOCUS: The family is specifically looking for: ' + focusStr + '\n\n' +
    'TASK: Analyze each email/listing and extract ONLY items relevant to this family. Return a JSON array.\n\n' +
    'CLASSIFICATION RULES:\n' +
    '- BABY_GEAR: Prioritize the family\'s focus items: strollers, play sets. Also include other age-appropriate gear for the upcoming 3 months. ONLY include if pickup location is in North Brooklyn or not specified.\n' +
    '- CLOTHES: Summer clothing sets and outfits in sizes 9M and up (' + sizesStr + '). Gender-neutral or girl items only. ONLY include if pickup location is in North Brooklyn or not specified.\n' +
    '- ACTIVITIES: Baby-friendly events, classes, meetups, walking groups, bonding events, swaps, demos in or near North Brooklyn. Include things relevant to new parents.\n' +
    '- FREE_STUFF: Any free baby-related item useful for the family. ONLY include if pickup location is in North Brooklyn or not specified.\n' +
    '- HOUSING: Any housing mentions in/near: ' + housingLocationsStr + '. Include sublets, rentals, house shares, weekend spots.\n' +
    '- SKIP: Everything else (older kid stuff, irrelevant sizes, school topics, breastfeeding/nursing/pumping items — family is formula feeding, items only available in Park Slope or outside North Brooklyn, etc.)\n\n' +
    'For each relevant item, return:\n' +
    '{\n' +
    '  "listing_id": "the listing_id provided with the listing",\n' +
    '  "category": "BABY_GEAR" | "CLOTHES" | "ACTIVITIES" | "FREE_STUFF" | "HOUSING",\n' +
    '  "title": "short descriptive title",\n' +
    '  "description": "1-2 sentence summary of why this is relevant",\n' +
    '  "price": "$X or Free or null",\n' +
    '  "location": "pickup location if mentioned",\n' +
    '  "contact": "email or phone if mentioned",\n' +
    '  "urgency": "high" | "medium" | "low",\n' +
    '  "source_subject": "the source_subject provided with the listing",\n' +
    '  "time_sensitive": true/false (for events with dates)\n' +
    '}\n\n' +
    'IMPORTANT:\n' +
    '- Be selective. Only include genuinely relevant items.\n' +
    '- Always include the listing_id exactly as provided — this is used to attach reply links.\n' +
    '- ALWAYS include the pickup/meetup location in the "location" field, even if it\'s just a neighborhood name like "Park Slope" or "7th Ave". This is critical for filtering.\n' +
    '- Mark events and swaps as urgency "high" if registration is opening soon.\n' +
    '- Return ONLY the JSON array, no other text. If nothing is relevant, return [].';


  // Build the listing content for this batch
  var emailTexts = emailBatch.map(function(e, idx) {
    return "--- LISTING (listing_id: " + e.listing_id + ") ---\n" +
      "Source: " + e.source_subject + "\n" +
      "From: " + (e.from || "digest") + "\n" +
      "Date: " + (e.date || "") + "\n" +
      "Type: " + e.type + "\n\n" +
      e.body;
  }).join("\n\n");

  var payload = {
    model: CONFIG.CLAUDE_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: "Classify the following Park Slope Parents emails. Return ONLY a JSON array.\n\n" + emailTexts,
      },
    ],
  };

  try {
    var response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    var statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      Logger.log("❌ Claude API error (HTTP " + statusCode + "): " + response.getContentText());
      return [];
    }

    var result = JSON.parse(response.getContentText());
    var text = result.content[0].text;

    // Clean up the response — strip markdown fences if present
    text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    var classified = JSON.parse(text);
    return classified;
  } catch (e) {
    Logger.log("❌ Error calling Claude: " + e.toString());
    return [];
  }
}

// ── GMAIL LABELING ─────────────────────────────────────────────────────────

function createLabelsIfNeeded_() {
  var allLabels = ["PSP", CONFIG.GMAIL_LABEL];
  var catLabels = Object.values(CONFIG.CATEGORY_LABELS);
  allLabels = allLabels.concat(catLabels);

  var existingLabels = GmailApp.getUserLabels().map(function(l) {
    return l.getName();
  });

  for (var i = 0; i < allLabels.length; i++) {
    if (existingLabels.indexOf(allLabels[i]) === -1) {
      GmailApp.createLabel(allLabels[i]);
      Logger.log("  Created label: " + allLabels[i]);
    }
  }
}

function applyGmailLabels_(classifiedItems, originalEmails) {
  // Build a map of thread IDs to their Gmail thread objects
  var threadMap = {};
  for (var i = 0; i < originalEmails.length; i++) {
    threadMap[originalEmails[i].subject] = originalEmails[i].gmailThread;
  }

  // Apply category labels
  for (var j = 0; j < classifiedItems.length; j++) {
    var item = classifiedItems[j];
    var labelName = CONFIG.CATEGORY_LABELS[item.category];
    if (!labelName) continue;

    // Find the matching thread by subject
    var thread = threadMap[item.source_subject];
    if (thread) {
      try {
        var label = GmailApp.getUserLabelByName(labelName);
        if (label) label.addToThread(thread);
      } catch (e) {
        // Label might not exist or thread access issue — skip silently
      }
    }
  }
}

// ── DIGEST EMAIL BUILDER ───────────────────────────────────────────────────

function sendDigestEmail_(classifiedItems, babyAge) {
  // Group items by category
  var grouped = {};
  for (var i = 0; i < classifiedItems.length; i++) {
    var cat = classifiedItems[i].category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(classifiedItems[i]);
  }

  // Sort each group: high urgency first
  var urgencyOrder = { high: 0, medium: 1, low: 2 };
  Object.keys(grouped).forEach(function(cat) {
    grouped[cat].sort(function(a, b) {
      return (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2);
    });
  });

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "EEEE, MMMM d, yyyy");

  // Build HTML email
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="' +
    "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; " +
    'max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f7f4; color: #2d2d2d;">' +

    // Header
    '<div style="background: linear-gradient(135deg, #4a7c59, #6ba368); color: white; ' +
    'padding: 24px; border-radius: 12px; margin-bottom: 24px;">' +
    '<h1 style="margin: 0 0 8px 0; font-size: 24px;">🌿 PSP Smart Digest</h1>' +
    '<p style="margin: 0; opacity: 0.9; font-size: 14px;">' + today + '</p>' +
    '<p style="margin: 8px 0 0 0; opacity: 0.85; font-size: 13px;">' +
    'Filtered for your ' + babyAge.description + ' daughter &middot; ' +
    classifiedItems.length + ' relevant items found</p>' +
    '</div>';

  // Category sections
  var categoryConfig = {
    ACTIVITIES: { emoji: "📅", title: "Events & Activities", color: "#e8735a" },
    BABY_GEAR: { emoji: "🍼", title: "Baby Gear", color: "#4a7c59" },
    CLOTHES: { emoji: "👗", title: "Clothes (sizes: " + babyAge.clothingSizes.join(", ") + ")", color: "#6b7db3" },
    FREE_STUFF: { emoji: "🆓", title: "Free Stuff & Deals", color: "#d4a84b" },
    HOUSING: { emoji: "🏡", title: "Housing", color: "#8b6b99" },
  };

  // Render in this order
  var renderOrder = ["ACTIVITIES", "BABY_GEAR", "FREE_STUFF", "CLOTHES", "HOUSING"];

  for (var r = 0; r < renderOrder.length; r++) {
    var catKey = renderOrder[r];
    var items = grouped[catKey];
    if (!items || items.length === 0) continue;

    var cfg = categoryConfig[catKey];
    html += '<div style="margin-bottom: 20px;">' +
      '<h2 style="font-size: 18px; color: ' + cfg.color + '; border-bottom: 2px solid ' + cfg.color + '; ' +
      'padding-bottom: 8px; margin-bottom: 12px;">' + cfg.emoji + ' ' + cfg.title + '</h2>';

    for (var k = 0; k < items.length; k++) {
      var item = items[k];
      var urgencyBadge = "";
      if (item.urgency === "high") {
        urgencyBadge = '<span style="background: #e8735a; color: white; font-size: 10px; ' +
          'padding: 2px 6px; border-radius: 4px; margin-left: 8px; font-weight: 600;">🔥 ACT NOW</span>';
      }
      if (item.time_sensitive) {
        urgencyBadge += '<span style="background: #d4a84b; color: white; font-size: 10px; ' +
          'padding: 2px 6px; border-radius: 4px; margin-left: 4px;">⏰ TIME-SENSITIVE</span>';
      }

      html += '<div style="background: white; border-radius: 8px; padding: 14px; margin-bottom: 10px; ' +
        'border-left: 4px solid ' + cfg.color + ';">';

      // Title + price
      html += '<div style="display: flex; justify-content: space-between; align-items: center;">' +
        '<strong style="font-size: 15px;">' + escapeHtml_(item.title) + '</strong>';
      if (item.price) {
        html += '<span style="color: ' + cfg.color + '; font-weight: 700; font-size: 15px; white-space: nowrap; margin-left: 12px;">' +
          escapeHtml_(item.price) + '</span>';
      }
      html += '</div>';

      // Urgency badges
      if (urgencyBadge) html += '<div style="margin-top: 4px;">' + urgencyBadge + '</div>';

      // Description
      html += '<p style="margin: 8px 0 0 0; font-size: 13px; color: #555; line-height: 1.5;">' +
        escapeHtml_(item.description) + '</p>';

      // Location + contact
      var meta = [];
      if (item.location) meta.push("📍 " + escapeHtml_(item.location));
      if (item.contact) meta.push("✉️ " + escapeHtml_(item.contact));
      if (meta.length > 0) {
        html += '<p style="margin: 6px 0 0 0; font-size: 12px; color: #888;">' + meta.join(" &middot; ") + '</p>';
      }

      // Reply / View link — use reply_link first, fall back to view_link
      var actionLink = item.reply_link || item.view_link || null;
      if (actionLink) {
        html += '<a href="' + actionLink + '" style="display: inline-block; margin-top: 10px; ' +
          'padding: 6px 14px; font-size: 13px; color: white; background-color: ' + cfg.color + '; ' +
          'text-decoration: none; font-weight: 600; border-radius: 6px;">View / Reply →</a>';
      }

      html += '</div>';
    }

    html += '</div>';
  }

  // Footer
  html += '<div style="text-align: center; padding: 16px; font-size: 11px; color: #999; border-top: 1px solid #ddd;">' +
    '<p>Powered by Claude AI &middot; Auto-filtered from Park Slope Parents listserv</p>' +
    '<p>Baby age updates automatically — no maintenance needed 🎉</p>' +
    '<p style="margin-top: 8px;">To adjust categories or settings, edit your Google Apps Script</p>' +
    '</div>';

  html += '</body></html>';

  // Send to all recipients
  for (var r2 = 0; r2 < CONFIG.DIGEST_RECIPIENTS.length; r2++) {
    GmailApp.sendEmail(
      CONFIG.DIGEST_RECIPIENTS[r2],
      "🌿 PSP Digest: " + classifiedItems.length + " items for " + today,
      "Your PSP Smart Digest has " + classifiedItems.length + " relevant items. View this email in HTML for the full digest.",
      {
        htmlBody: html,
        name: "PSP Smart Digest",
      }
    );
  }
}

// ── DIGEST PARSING ─────────────────────────────────────────────────────────

/**
 * Quick keyword filter to drop obviously irrelevant listings BEFORE calling Claude.
 * This saves ~60-70% of API costs. We only filter out things that are clearly
 * not relevant — anything ambiguous still gets sent to Claude.
 */
function isObviouslyIrrelevant_(text, babyAge) {
  if (!text) return true;
  var lower = text.toLowerCase();

  // Always keep: events, swaps, housing, free stuff
  if (lower.indexOf("swap") > -1 || lower.indexOf("event") > -1) return false;
  if (lower.indexOf("ff:") > -1 || lower.indexOf("for free") > -1 || lower.indexOf("#forfree") > -1) return false;
  if (lower.indexOf("williamsburg") > -1 || lower.indexOf("upstate") > -1 ||
      lower.indexOf("hudson valley") > -1 || lower.indexOf("catskill") > -1 ||
      lower.indexOf("greenpoint") > -1 || lower.indexOf("bushwick") > -1 ||
      lower.indexOf("bed-stuy") > -1 || lower.indexOf("bedford") > -1 ||
      lower.indexOf("clinton hill") > -1 || lower.indexOf("fort greene") > -1 ||
      lower.indexOf("dumbo") > -1 || lower.indexOf("brooklyn heights") > -1 ||
      lower.indexOf("downtown brooklyn") > -1 || lower.indexOf("high falls") > -1) return false;
  if (lower.indexOf("housing") > -1 || lower.indexOf("sublet") > -1 || lower.indexOf("rental") > -1) return false;
  if (lower.indexOf("meetup") > -1 || lower.indexOf("class") > -1 || lower.indexOf("workshop") > -1) return false;
  if (lower.indexOf("walking group") > -1 || lower.indexOf("playdate") > -1) return false;
  if (lower.indexOf("mom group") > -1 || lower.indexOf("dad group") > -1 || lower.indexOf("parent group") > -1) return false;
  if (lower.indexOf("bonding") > -1 || lower.indexOf("new mom") > -1 || lower.indexOf("new parent") > -1) return false;
  if (lower.indexOf("music class") > -1 || lower.indexOf("story time") > -1 || lower.indexOf("storytime") > -1) return false;

  // Always keep: current focus items
  if (lower.indexOf("stroller") > -1 || lower.indexOf("bugaboo") > -1 || lower.indexOf("uppababy") > -1) return false;
  if (lower.indexOf("play set") > -1 || lower.indexOf("playset") > -1 || lower.indexOf("swing set") > -1) return false;
  if (lower.indexOf("summer clothes") > -1 || lower.indexOf("summer outfit") > -1) return false;

  // Always keep: baby/infant terms
  if (lower.indexOf("baby") > -1 || lower.indexOf("infant") > -1 || lower.indexOf("newborn") > -1) return false;
  if (lower.indexOf("crib") > -1 || lower.indexOf("carrier") > -1) return false;
  if (lower.indexOf("bottle") > -1 || lower.indexOf("formula") > -1) return false;
  if (lower.indexOf("playpen") > -1 || lower.indexOf("play gym") > -1 || lower.indexOf("bouncer") > -1) return false;
  if (lower.indexOf("high chair") > -1 || lower.indexOf("car seat") > -1 || lower.indexOf("monitor") > -1) return false;
  if (lower.indexOf("swaddle") > -1 || lower.indexOf("teether") > -1 || lower.indexOf("jumper") > -1) return false;

  // Drop: clearly older kid sizes (only if baby is under 2)
  if (babyAge.months < 24) {
    var olderKidPatterns = [/\b[3-9]T\b/, /\bsize\s*(8|9|10|11|12|13)\b/i, /\bkindergarten\b/i,
      /\bmiddle school\b/i, /\bhigh school\b/i, /\bgrade\s*[1-9]/i, /\bK-[0-9]/i,
      /\bteen\b/i, /\btween\b/i, /\byouth\s*(S|M|L|XL)\b/i];
    for (var p = 0; p < olderKidPatterns.length; p++) {
      if (olderKidPatterns[p].test(text)) {
        // But don't filter if it ALSO mentions baby sizes
        if (lower.indexOf("0-3") > -1 || lower.indexOf("3-6") > -1 || lower.indexOf("6-9") > -1 ||
            lower.indexOf("6-12") > -1 || lower.indexOf("9-12") > -1 || lower.indexOf("12-18") > -1 ||
            lower.indexOf("newborn") > -1) {
          return false;
        }
        return true;
      }
    }
  }

  // Drop: breastfeeding/nursing items (family is formula feeding)
  var bfPatterns = [/\bbreast\s*pump\b/i, /\bnursing\s*bra\b/i, /\bnursing\s*pad\b/i,
    /\bpumping\s*bra\b/i, /\blactation\b/i, /\bbreastfeed/i, /\bnipple\s*pad/i,
    /\bhaakaa\b/i, /\blansinoh\b/i, /\bspectra\b/i, /\bmedela\b/i,
    /\bmilk\s*storage\s*bag/i, /\bnursing\s*pillow\b/i, /\bboppy\b/i,
    /\bnursing\s*cover\b/i, /\bnursing\/pumping\b/i];
  for (var bf = 0; bf < bfPatterns.length; bf++) {
    if (bfPatterns[bf].test(text)) return true;
  }

  // Drop: clearly adult-only or irrelevant items
  var adultOnlyPatterns = [/\bcat litter\b/i, /\bdog food\b/i, /\bpet\b/i,
    /\biMac\b/i, /\blaptop\b/i, /\bcomputer\b/i,
    /\bmen'?s\s*(jeans|pants|shirt|suit|shoes)\b/i,
    /\bwomen'?s\s*(jeans|pants|dress|suit)\b/i,
    /\bcoffee table\b/i, /\boffice chair\b/i, /\boffice desk\b/i,
    /\bcouch\b/i, /\bsofa\b/i, /\bbookshelf\b/i,
    /\bbike\s*(size|frame)\s*\d{2}/i];
  for (var a = 0; a < adultOnlyPatterns.length; a++) {
    if (adultOnlyPatterns[a].test(text)) return true;
  }

  // Drop: school/education-specific advice threads (not baby relevant)
  var schoolPatterns = [/\bDOE\s*lawsuit\b/i, /\bIEP\b/, /\bschool\s*choice\b/i,
    /\b504\s*plan\b/i, /\bsmartwatch\b/i, /\bscreen\s*time\b/i,
    /\bhomework\b/i, /\btutoring\b/i];
  for (var s = 0; s < schoolPatterns.length; s++) {
    if (schoolPatterns[s].test(text)) return true;
  }

  // Default: keep it — let Claude decide
  return false;
}

/**
 * Splits a digest email into individual listings, each with its own
 * View/Reply links pre-extracted. This ensures every classified item
 * has a clickable link in the final digest.
 */
function parseDigestIntoListings_(email) {
  var body = email.body || "";
  var listings = [];

  // Digest emails separate listings with a line of underscores
  var separator = /_{10,}/g;
  var sections = body.split(separator);

  for (var i = 0; i < sections.length; i++) {
    var section = sections[i].trim();
    if (!section || section.length < 50) continue;

    // Skip the header/footer sections (TOC at top, unsubscribe at bottom)
    if (section.indexOf("Topics in this digest") > -1 && section.indexOf("Messages") > -1) continue;
    if (section.indexOf("The PSP Classifieds helps") > -1) continue;
    if (section.indexOf("Group Home:") > -1 && section.length < 500) continue;
    if (section.indexOf("Send new messages:") > -1 && section.length < 500) continue;

    // Extract links from this listing section
    var links = extractLinks_(section);

    // Try to extract the listing title from the numbered header (e.g., "1a. Selling Pottery Barn...")
    var titleMatch = section.match(/^\d+[a-z]?\.\s*(.*?)(?:\n|$)/m);
    var title = titleMatch ? titleMatch[1].trim() : "";

    // Extract the From line
    var fromMatch = section.match(/From:\s*(.*?)(?:\n|$)/);
    var from = fromMatch ? fromMatch[1].trim() : "";

    var listingId = "listing_" + email.id.substring(0, 8) + "_" + i;

    listings.push({
      listing_id: listingId,
      subject: title || email.subject,
      from: from,
      date: email.date,
      body: truncateText_(section, 600),
      type: email.type,
      view_link: links.view_link,
      reply_link: links.reply_link,
      source_subject: email.subject,
      threadId: email.threadId,
    });
  }

  return listings;
}

/**
 * Extracts "View This Message" and "Reply To This Message" URLs from a text block.
 * These are the PSP group links that let you click through to view/reply to a specific post.
 */
function extractLinks_(text) {
  var viewLink = null;
  var replyLink = null;

  // Pattern: "View This Message: URL" or "View/Reply Online (#NNN): URL"
  var viewMatch = text.match(/View This Message:\s*(https?:\/\/[^\s]+)/);
  if (viewMatch) viewLink = viewMatch[1].trim();

  // Alternate pattern used in some digests
  if (!viewLink) {
    var viewAlt = text.match(/View\/Reply Online[^:]*:\s*(https?:\/\/[^\s]+)/);
    if (viewAlt) viewLink = viewAlt[1].trim();
  }

  // Pattern: "Reply To This Message: URL"
  var replyMatch = text.match(/Reply To This Message:\s*(https?:\/\/[^\s]+)/);
  if (replyMatch) replyLink = replyMatch[1].trim();

  // For standalone event emails, look for RSVP or registration links
  if (!viewLink && !replyLink) {
    var rsvpMatch = text.match(/RSVP\s+(?:HERE\s*)?\(?\s*(https?:\/\/[^\s\)]+)/i);
    if (rsvpMatch) viewLink = rsvpMatch[1].trim();

    var registerMatch = text.match(/Register\s+(?:HERE\s*)?\(?\s*(https?:\/\/[^\s\)]+)/i);
    if (registerMatch) viewLink = registerMatch[1].trim();
  }

  return {
    view_link: viewLink,
    reply_link: replyLink || viewLink, // Fall back to view link if no reply link
  };
}

// ── UTILITY FUNCTIONS ──────────────────────────────────────────────────────

function truncateText_(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "\n... [truncated]";
}

function chunkArray_(arr, size) {
  var chunks = [];
  for (var i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function escapeHtml_(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function deleteExistingTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "runDailyDigest") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

// ── MANUAL TOOLS ───────────────────────────────────────────────────────────

/**
 * Run this to test with a wider lookback window (3 days)
 */
function testWithWiderWindow() {
  var originalLookback = CONFIG.HOURS_LOOKBACK;
  CONFIG.HOURS_LOOKBACK = 72; // 3 days
  runDailyDigest();
  CONFIG.HOURS_LOOKBACK = originalLookback;
}

/**
 * Run this to see what PSP emails are in your inbox (without classifying)
 */
function previewPSPEmails() {
  var emails = fetchPSPEmails_();
  Logger.log("Found " + emails.length + " PSP emails:");
  for (var i = 0; i < emails.length; i++) {
    Logger.log("  [" + emails[i].type + "] " + emails[i].subject + " (" + emails[i].date + ")");
  }
}

/**
 * Run this to check your current config
 */
function showConfig() {
  var babyAge = calculateBabyAge_();
  Logger.log("=== PSP Smart Digest Configuration ===");
  Logger.log("Baby age: " + babyAge.description);
  Logger.log("Clothing sizes: " + babyAge.clothingSizes.join(", "));
  Logger.log("Gear stage: " + babyAge.gearStage);
  Logger.log("Locations: " + CONFIG.LOCATIONS_OF_INTEREST.join(", "));
  Logger.log("Recipients: " + CONFIG.DIGEST_RECIPIENTS.join(", "));
  Logger.log("Lookback: " + CONFIG.HOURS_LOOKBACK + " hours");
  Logger.log("Digest time: " + CONFIG.DIGEST_HOUR + ":00");

  var hasKey = !!PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  Logger.log("API key: " + (hasKey ? "✅ configured" : "❌ not set"));
}
