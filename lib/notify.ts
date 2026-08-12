/**
 * Internal email notifications for new leads, sent via Mailgun.
 *
 * Fires from the API routes after the Sheets webhook. Always wrapped
 * non-fatally by callers — a Mailgun outage must never block lead capture.
 *
 * Requires MAILGUN_API_KEY (Vercel env / .env.local). Sender domain and
 * recipients are fixed below.
 */

const MAILGUN_DOMAIN = 'mg.speedxmedia.com';
const MAILGUN_API = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`;
const FROM = 'SpeedX RAP <rap@mg.speedxmedia.com>';
// Comma-separated override via NOTIFY_RECIPIENTS env var; defaults to the team.
const RECIPIENTS = (process.env.NOTIFY_RECIPIENTS ?? 'spencer@speedxmedia.com,marketing@speedxmedia.com')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1tjaY0KlDKRD9UfB0IGzqrGHVvKQEvEaFsIxIHHolmc0/edit';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
}

export interface StrategyCallNotification extends Attribution {
  name: string;
  email: string;
  phone: string;
  business: string;
  industry: string;
  website: string;
}

export interface HardLeadNotification extends Attribution {
  email: string;
  domain: string;
  submitted_url: string;
  overall_grade: string;
  revenue_opportunity: string;
  category_grades: Record<string, string>;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function notifyStrategyCall(lead: StrategyCallNotification): Promise<void> {
  const subject = `Strategy call request — ${lead.name}${lead.business ? ` (${lead.business})` : ''}`;

  const rows: Array<[string, string]> = [
    ['Name', lead.name],
    ['Email', lead.email],
    ['Phone', lead.phone],
    ['Business', lead.business],
    ['Industry', lead.industry],
    ['Website', lead.website],
    ['Submitted', receivedAt()],
  ];

  await send({
    subject,
    replyTo: lead.email,
    heading: 'New strategy call request',
    intro: 'A visitor requested a strategy call through the Revenue Activation Plan tool.',
    rows,
    attribution: lead,
    cta: { label: 'Open the Strategy Calls sheet', url: `${SHEET_URL}#gid=1698698234` },
  });
}

export async function notifyHardLead(lead: HardLeadNotification): Promise<void> {
  const subject = `New lead — ${lead.email}${lead.overall_grade ? ` — scored ${lead.overall_grade}` : ''}`;

  const rows: Array<[string, string]> = [
    ['Email', lead.email],
    ['Website', lead.submitted_url || lead.domain],
    ['Overall grade', lead.overall_grade],
    ['Revenue opportunity', lead.revenue_opportunity],
  ];
  for (const [category, grade] of Object.entries(lead.category_grades ?? {})) {
    rows.push([categoryLabel(category), grade]);
  }
  rows.push(['Submitted', receivedAt()]);

  await send({
    subject,
    replyTo: lead.email,
    heading: 'New lead captured',
    intro: 'A visitor unlocked their website score with a work email.',
    rows,
    attribution: lead,
    cta: { label: 'Open the Email Leads sheet', url: `${SHEET_URL}#gid=1246994800` },
  });
}

// ── Internals ─────────────────────────────────────────────────────────────────

interface Message {
  subject: string;
  replyTo: string;
  heading: string;
  intro: string;
  rows: Array<[string, string]>;
  attribution: Attribution;
  cta: { label: string; url: string };
}

async function send(msg: Message): Promise<void> {
  const apiKey = process.env.MAILGUN_API_KEY;
  if (!apiKey) {
    console.warn('[notify] MAILGUN_API_KEY not set — skipping email notification');
    return;
  }

  const body = new URLSearchParams({
    from: FROM,
    to: RECIPIENTS.join(','),
    subject: msg.subject,
    text: renderText(msg),
    html: renderHtml(msg),
  });
  if (msg.replyTo) body.set('h:Reply-To', msg.replyTo);

  const res = await fetch(MAILGUN_API, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`api:${apiKey}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Mailgun ${res.status}: ${text}`);
  }
  console.log(`[notify] Sent "${msg.subject}" to ${RECIPIENTS.join(', ')}`);
}

function attributionRows(a: Attribution): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (a.utm_source) rows.push(['Source', a.utm_source + (a.utm_medium ? ` / ${a.utm_medium}` : '')]);
  else if (a.utm_medium) rows.push(['Medium', a.utm_medium]);
  if (a.utm_campaign) rows.push(['Campaign', a.utm_campaign]);
  if (a.utm_term) rows.push(['Term', a.utm_term]);
  if (a.utm_content) rows.push(['Ad', a.utm_content]);
  if (a.gclid) rows.push(['Google click ID', a.gclid]);
  if (a.gbraid) rows.push(['Google click ID (gbraid)', a.gbraid]);
  if (a.wbraid) rows.push(['Google click ID (wbraid)', a.wbraid]);
  if (a.fbclid) rows.push(['Meta click ID', a.fbclid]);
  return rows;
}

function receivedAt(): string {
  return new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  }) + ' ET';
}

function categoryLabel(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderText(msg: Message): string {
  const lines = [msg.heading.toUpperCase(), '', ...msg.rows.map(([k, v]) => `${k}: ${v || '—'}`)];
  const attr = attributionRows(msg.attribution);
  if (attr.length) {
    lines.push('', 'ATTRIBUTION', ...attr.map(([k, v]) => `${k}: ${v}`));
  }
  lines.push('', `${msg.cta.label}: ${msg.cta.url}`);
  return lines.join('\n');
}

function renderHtml(msg: Message): string {
  const dataRows = msg.rows
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:9px 16px 9px 0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8a8a;white-space:nowrap;vertical-align:top;border-bottom:1px solid #ececec;">${esc(k)}</td>
          <td style="padding:9px 0;font-size:14px;color:#111111;border-bottom:1px solid #ececec;word-break:break-word;">${v ? esc(v) : '<span style="color:#bbbbbb;">—</span>'}</td>
        </tr>`
    )
    .join('');

  const attr = attributionRows(msg.attribution);
  const attributionBlock = attr.length
    ? `
      <p style="margin:28px 0 6px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8a8a;">Attribution</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        ${attr
          .map(
            ([k, v]) => `
        <tr>
          <td style="padding:7px 16px 7px 0;font-size:12px;color:#8a8a8a;white-space:nowrap;vertical-align:top;">${esc(k)}</td>
          <td style="padding:7px 0;font-size:12px;color:#444444;word-break:break-all;">${esc(v)}</td>
        </tr>`
          )
          .join('')}
      </table>`
    : '';

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f4;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f4f4f4;padding:32px 0;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Helvetica,Arial,sans-serif;">
            <tr>
              <td style="background:#0b0b0b;padding:20px 32px;">
                <span style="font-size:15px;font-weight:700;letter-spacing:-0.02em;color:#efefef;">SPEEDX</span><span style="font-size:15px;font-weight:700;letter-spacing:-0.02em;color:#c0392b;">MEDIA</span>
                <span style="float:right;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#777777;line-height:20px;">Revenue Activation Plan</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 6px;font-size:19px;font-weight:700;letter-spacing:-0.01em;color:#111111;">${esc(msg.heading)}</h1>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#8a8a8a;">${esc(msg.intro)}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                  ${dataRows}
                </table>
                ${attributionBlock}
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:32px;">
                  <tr>
                    <td style="background:#c0392b;border-radius:8px;">
                      <a href="${msg.cta.url}" style="display:inline-block;padding:12px 22px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${esc(msg.cta.label)}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;border-top:1px solid #ececec;">
                <p style="margin:0;font-size:11px;color:#b5b5b5;">Automated notification from the Revenue Activation Plan tool &middot; revenue-activation-plan.speedxmedia.com</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
