/**
 * RAP Webhook — Google Apps Script (reference copy, versioned in the repo).
 *
 * Receives lead payloads from the RAP site's API routes and appends them to
 * the Google Sheet, routing each payload `type` to its tab.
 *
 * HEADER-DRIVEN: instead of hardcoding column order, this script reads row 1
 * of the target tab and matches payload keys to headers (case-insensitive,
 * spaces == underscores, so a "Utm Source" header matches `utm_source`).
 * Any payload key with no matching header gets a NEW column appended
 * automatically. That means adding a field like `gclid` or `phone` to the
 * site requires NO script change — the column appears on the first
 * submission that carries it. Existing columns and their order are untouched.
 *
 * ── How to deploy an update ──────────────────────────────────────────────────
 * 1. Open script.google.com → project "RAP Webhook (Juan)" (owner jlondom@gmail.com)
 * 2. Replace the contents of Code.gs with this file
 * 3. Deploy → Manage deployments → ✎ (edit) → Version: "New version" → Deploy
 *    The webhook URL stays the same across versions — nothing to change on the site.
 *
 * NOTE: this is a standalone script (not container-bound), so it must use
 * SpreadsheetApp.openById — do NOT switch to getActiveSpreadsheet().
 */

var SPREADSHEET_ID = "1tjaY0KlDKRD9UfB0IGzqrGHVvKQEvEaFsIxIHHolmc0";

var TYPE_TO_TAB = {
  soft_lead: "Soft Leads",
  hard_lead: "Email Leads",
  strategy_call: "Strategy Calls",
};

function doPost(e) {
  // Serialize concurrent submissions so two requests can't both decide to
  // create the same new header column.
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    var tabName = TYPE_TO_TAB[data.type];
    if (!tabName) {
      return jsonResponse({ ok: false, error: "Unknown type: " + data.type });
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);

    delete data.type;
    var record = { timestamp: new Date() };
    for (var key in data) record[key] = data[key];

    appendByHeaders(sheet, record);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Legacy header names that should receive a differently-named payload key.
// Both sides are compared post-normalization, so "Date Submitted" ⇒
// date_submitted ⇒ timestamp.
var HEADER_ALIASES = {
  date_submitted: "timestamp", // Strategy Calls + Soft Leads legacy column
  tested_site: "website",      // Soft Leads legacy column
};

function appendByHeaders(sheet, record) {
  var lastCol = sheet.getLastColumn();
  var headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var canonical = headers.map(canonicalKey);

  // Add a header column for any payload key the sheet doesn't have yet.
  for (var key in record) {
    if (canonical.indexOf(canonicalKey(key)) === -1) {
      headers.push(key);
      canonical.push(canonicalKey(key));
      sheet.getRange(1, headers.length).setValue(key);
    }
  }

  var row = headers.map(function (_, i) {
    for (var key in record) {
      if (canonicalKey(key) === canonical[i]) return sanitizeValue(record[key]);
    }
    return "";
  });
  sheet.appendRow(row);
}

function canonicalKey(h) {
  var norm = String(h).trim().toLowerCase().replace(/[\s-]+/g, "_");
  return HEADER_ALIASES[norm] || norm;
}

// Sheets parses cell text starting with = + - @ as a formula (a phone number
// like "+1 (305)..." renders as #ERROR!). A leading apostrophe forces text
// and is not displayed.
function sanitizeValue(v) {
  if (typeof v === "string" && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

// ── One-time repair: run manually from the editor (select repairSheets → Run) ─
//
// Recovers from a wiped header row (row 1). When headers are lost, doPost
// can't match any column, so it auto-creates a duplicate set of columns on the
// right and appends leads there. This function restores the canonical headers,
// migrates every value from the duplicate block back into its proper column,
// deletes the duplicate columns, then freezes and protects row 1 (warning on
// edit) so a sort or stray edit can't silently break routing again.
// Safe to run more than once.

var REPAIR_HEADERS = {
  "Strategy Calls": ["Name", "Email", "Business Name", "Website", "Date Submitted",
    "UTM Source", "UTM Medium", "UTM Campaign", "UTM Term", "UTM Content",
    "timestamp", "phone", "business", "industry", "leadId",
    "gclid", "gbraid", "wbraid", "fbclid"],
  "Email Leads": ["Email", "Domain", "Submitted URL", "Overall Grade", "Revenue Opportunity",
    "Timestamp", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "gclid", "gbraid", "wbraid", "fbclid"],
  "Soft Leads": ["Tested Site", "Date Submitted", "utm_source", "utm_medium",
    "utm_campaign", "utm_term", "utm_content", "timestamp", "website",
    "gclid", "gbraid", "wbraid", "fbclid"],
};

function repairSheets() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // pause incoming webhook writes while we operate
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var report = [];
    for (var tabName in REPAIR_HEADERS) {
      var sheet = ss.getSheetByName(tabName);
      if (!sheet) { report.push(tabName + ": tab not found"); continue; }

      var canonical = REPAIR_HEADERS[tabName];
      var n = canonical.length;
      var lastCol = sheet.getLastColumn();
      var lastRow = sheet.getLastRow();

      // 1. Restore the canonical header row
      sheet.getRange(1, 1, 1, n).setValues([canonical]);

      // 2. Migrate data out of any duplicate columns to the right
      var migrated = 0;
      if (lastCol > n) {
        var extraHeaders = sheet.getRange(1, n + 1, 1, lastCol - n).getValues()[0];
        var targetCol = {};
        for (var i = 0; i < n; i++) {
          var key = canonicalKey(canonical[i]);
          if (!(key in targetCol)) targetCol[key] = i + 1; // first match wins
        }
        if (lastRow > 1) {
          var extra = sheet.getRange(2, n + 1, lastRow - 1, lastCol - n).getValues();
          for (var r = 0; r < extra.length; r++) {
            var rowHasData = false;
            for (var c = 0; c < extra[r].length; c++) {
              var v = extra[r][c];
              if (v === "" || v === null) continue;
              rowHasData = true;
              var t = targetCol[canonicalKey(extraHeaders[c])];
              if (t) {
                var cell = sheet.getRange(r + 2, t);
                if (cell.getValue() === "") cell.setValue(sanitizeValue(v));
              }
            }
            if (rowHasData) migrated++;
          }
          sheet.getRange(2, n + 1, lastRow - 1, lastCol - n).clearContent();
        }
        // 3. Remove the now-empty duplicate columns
        sheet.deleteColumns(n + 1, lastCol - n);
      }

      // 4. Freeze + protect the header row against future accidents
      sheet.setFrozenRows(1);
      var protection = sheet.getRange("1:1").protect();
      protection.setDescription("Webhook header row — edits break lead routing");
      protection.setWarningOnly(true);

      report.push(tabName + ": " + migrated + " hidden rows migrated back");
    }
    Logger.log(report.join("\n"));
    return report.join("\n");
  } finally {
    lock.releaseLock();
  }
}
