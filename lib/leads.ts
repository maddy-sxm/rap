/**
 * SpeedX RAP — Lead Storage Module
 *
 * ── LOCAL STUB ──────────────────────────────────────────────────────────────
 * By default, leads are written to two JSON files in /data:
 *   data/leads.json          ← email gate submissions
 *   data/strategy-calls.json ← strategy call modal submissions
 *
 * This is intentional for local development and early-stage use.
 * The files are human-readable and easy to export to a spreadsheet.
 *
 * ── PRODUCTION INTEGRATION POINT ────────────────────────────────────────────
 * When you're ready to connect a real backend, replace the bodies of
 * `persistLead()` and `persistStrategyCall()` below.  Everything else
 * (types, public API, routing) stays the same.
 *
 * Drop-in targets:
 *   • Webhook (Zapier / Make / n8n)   → fetch(process.env.WEBHOOK_URL, ...)
 *   • HubSpot CRM                     → HubSpot Contacts API v3
 *   • Google Sheets                   → Sheets API v4 (service account)
 *   • Supabase / PlanetScale / Neon   → insert into `leads` table
 *   • Resend / SendGrid               → notify team on new lead
 * ────────────────────────────────────────────────────────────────────────────
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Captured when the user passes through the email gate. */
export interface LeadRecord {
  leadId: string;                        // UUID — links gate lead → strategy call
  email: string;
  domain: string;                        // cleaned hostname (no https/www)
  submitted_url: string;                 // raw URL the user entered
  overall_grade: string;
  category_grades: Record<string, string>;
  revenue_opportunity: string;
  timestamp: string;                     // ISO 8601
  source: "gate";
}

/** Captured when the user submits the "Request a Strategy Call" modal. */
export interface StrategyCallRecord {
  callId: string;
  leadId: string | null;                 // linked gate lead, if available
  name: string;
  contact_email: string;
  business_name: string;
  industry: string;
  website: string;
  timestamp: string;
  source: "strategy_call";
}

// ─── File paths ───────────────────────────────────────────────────────────────

const DATA_DIR    = path.join(process.cwd(), "data");
const LEADS_FILE  = path.join(DATA_DIR, "leads.json");
const CALLS_FILE  = path.join(DATA_DIR, "strategy-calls.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeJson<T>(filePath: string, records: T[]) {
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2), "utf8");
}

// ─── Integration stubs ────────────────────────────────────────────────────────
//
// ── INTEGRATION POINT ── persistLead ────────────────────────────────────────
// Replace the file-write below with your real destination.
//
// Webhook example (Zapier / Make):
//   await fetch(process.env.LEAD_WEBHOOK_URL!, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(lead),
//   });
//
// HubSpot example:
//   await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`,
//     },
//     body: JSON.stringify({
//       properties: {
//         email: lead.email,
//         website: lead.submitted_url,
//         hs_lead_status: "NEW",
//       },
//     }),
//   });
// ────────────────────────────────────────────────────────────────────────────
async function persistLead(lead: LeadRecord): Promise<void> {
  ensureDataDir();
  const records = readJson<LeadRecord>(LEADS_FILE);
  records.push(lead);
  writeJson(LEADS_FILE, records);
}

// ── INTEGRATION POINT ── persistStrategyCall ─────────────────────────────────
// Same pattern — swap the file-write for your real endpoint.
// You may want to look up the original LeadRecord by `call.leadId` here
// and send both records together as a single enriched payload to your CRM.
// ────────────────────────────────────────────────────────────────────────────
async function persistStrategyCall(call: StrategyCallRecord): Promise<void> {
  ensureDataDir();
  const records = readJson<StrategyCallRecord>(CALLS_FILE);
  records.push(call);
  writeJson(CALLS_FILE, records);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save an email gate lead.
 * Returns the generated `leadId` so the client can pass it to the strategy
 * call form and keep both submissions linked.
 */
export async function saveLead(
  params: Omit<LeadRecord, "leadId" | "timestamp" | "source">
): Promise<string> {
  const leadId = crypto.randomUUID();
  const lead: LeadRecord = {
    ...params,
    leadId,
    timestamp: new Date().toISOString(),
    source: "gate",
  };
  await persistLead(lead);
  return leadId;
}

/**
 * Save a strategy call form submission.
 * Pass `leadId` from the earlier gate submission to link both records.
 */
export async function saveStrategyCall(
  params: Omit<StrategyCallRecord, "callId" | "timestamp" | "source">
): Promise<void> {
  const call: StrategyCallRecord = {
    ...params,
    callId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source: "strategy_call",
  };
  await persistStrategyCall(call);
}
