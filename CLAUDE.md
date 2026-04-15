# SpeedX Revenue Activation Plan (RAP) — Project Brief

This file exists so a future Claude (in chat mode, without filesystem access)
can understand the project well enough to propose accurate code changes
without needing to re-explore everything from scratch.

## What this app is

A single-page Next.js lead-gen site. A visitor enters a URL, watches a
grading animation, gets prompted for an email to unlock the results, sees
their "Revenue Activation Plan" scorecard, then can request a strategy call
via a modal. Successful strategy call submissions redirect to `/thank-you`,
which fires ad-platform conversion events.

**Live URL**: https://revenue-activation-plan.speedxmedia.com/
**Repo**: github.com/maddy-sxm/rap (main branch auto-deploys to Vercel)
**Stack**: Next.js 14.2.5 (App Router) · React 18 · TypeScript · Tailwind · deployed on Vercel

## Architecture at a glance

```
app/
├── layout.tsx              Root layout — fonts, Meta Pixel, Google Ads tag
├── page.tsx                THE ENTIRE FUNNEL — one big client component
├── thank-you/
│   └── page.tsx            Post-conversion page, fires Lead + Google Ads conversion
└── api/
    ├── grade/              Scores a website (POST { url } → GradeReport)
    ├── soft-lead/          Sheets webhook — type:"soft_lead" (URL submit)
    ├── leads/              Sheets webhook — type:"hard_lead" (email gate)
    ├── strategy-call/      Sheets webhook — type:"strategy_call" (modal)
    └── capture/            Legacy/unused — just logs, kept for now

lib/
├── grader.ts               Website grading logic (called by /api/grade)
└── leads.ts                Local JSON "stub" — non-fatal, NOT the source of truth

data/                       Local dev test data (leads.json, strategy-calls.json) — not read in prod
```

### The funnel state machine

`app/page.tsx` is a single `"use client"` component. It holds an `appState`
that drives what view renders:

```
landing → analyzing → gate → results
                              └─► opens StrategyCallModal → redirects to /thank-you
```

Every view is a sub-component in the same file (`LandingView`, `AnalyzingView`,
`GateView`, `ResultsView`, `StrategyCallModal`). They all share state via props
from `Home`.

## Lead data flow (important — this was broken once)

Three separate submissions, each hits the **same** Google Sheets webhook but
with a different `type` field. The Apps Script routes each `type` to a
different tab.

| Step           | Endpoint             | Type            | Sheet tab       | Fires at                        |
|----------------|---------------------|-----------------|-----------------|---------------------------------|
| URL submit     | `/api/soft-lead`    | `soft_lead`     | `Soft Leads`    | User clicks "Score My Website"  |
| Email gate     | `/api/leads`        | `hard_lead`     | `Email Leads`   | User unlocks results with email |
| Strategy call  | `/api/strategy-call`| `strategy_call` | `Strategy Calls`| User submits modal              |

**Webhook URL** (all three POST to this):
`https://script.google.com/macros/s/AKfycbzAM0j6l0PF70JdG6pAgGMGeFsEv98FPTL2mnGyeVS1CTakVKycXkaNq8yjUxl-ElxV/exec`

**Sheet**:
https://docs.google.com/spreadsheets/d/1tjaY0KlDKRD9UfB0IGzqrGHVvKQEvEaFsIxIHHolmc0/edit

**Apps Script project**: standalone, owned by `jlondom@gmail.com`. Uses
`SpreadsheetApp.openById(SPREADSHEET_ID)` (NOT `getActiveSpreadsheet()`,
since it's not container-bound). If you ever need to redeploy or change the
script, open script.google.com → the "RAP Webhook (Juan)" project → edit
`Code.gs` → Deploy → Manage deployments → New version. The URL stays the
same across versions. Do NOT create a container-bound script on the sheet
itself — that path was blocked before because it was owned by another user.

**Gotcha — local JSON stub**: `lib/leads.ts` still writes to `data/leads.json`
and `data/strategy-calls.json`. This crashes on Vercel (read-only FS) so
every call to it is wrapped in try/catch as **non-fatal**. Google Sheets is
the source of truth. Do not rely on the JSON files for anything real.

**Gotcha — idempotency**: All three routes dedupe on a `submissionId` UUID
via an in-memory `Set` with a 60s TTL. The client sends `submissionId:
crypto.randomUUID()` and the server ignores repeats. This matters if you
add retries, React Strict Mode doubles, or rapid double-clicks.

## UTM attribution

UTM params are captured on the **first** landing page load into
`sessionStorage["speedx_utms"]` so attribution survives navigation inside
the session. Every lead API call pulls from sessionStorage and falls back
to the current URL's query string. Don't change this without thinking
about attribution — losing first-touch UTMs costs the business money.

## Tracking / ad pixels (in `app/layout.tsx`)

Installed via `next/script` with `strategy="afterInteractive"`:

- **Meta Pixel** `2351628112024068`
  - `fbq('track', 'PageView')` on every page (from layout)
  - `fbq('track', 'Lead')` on `/thank-you` (from thank-you/page.tsx)
- **Google Ads** `AW-17879019755`
  - `gtag('config', 'AW-17879019755')` on every page (from layout)
  - `gtag('event', 'conversion', { send_to: 'AW-17879019755' })` on `/thank-you`
  - **TODO**: add the conversion label once Google Ads creates the conversion
    action. It'll look like `AW-17879019755/aBcDeFgHiJ`. Update
    `app/thank-you/page.tsx` line ~21.

A `<noscript>` fallback `<img>` for the Meta Pixel is in `<body>` per Meta's
Next.js guidance — **not** in `<head>` (HTML spec).

## Design system

The site uses **inline styles** extensively, not Tailwind, for visual
details. Tailwind is used for layout utilities only. Core tokens that
appear repeatedly — match these when adding new UI:

### Colors
- Backgrounds: `#080808` (page), `#0a0a0a` (inputs), `#0e0e0e` (panels), `#131313` (pills)
- Borders:     `#161616`, `#1c1c1c`, `#222222`, `#242424`, `#2a2a2a`
- Text:        `#efefef` (primary), `#aaaaaa`, `#888888`, `#777777`, `#666666`, `#3a3a3a`
- Red accent:  `#c0392b` (brand), `#a93226` (hover), `rgba(192,57,43,0.7)` (glow)
- Success:     `#10b981`, `rgba(16,185,129,0.1)` bg, `rgba(16,185,129,0.25)` border
- Grade hues:  A `#10b981`, B `#38bdf8`, C `#f59e0b`, D/F `#ef4444` (see `GRADE_STYLE` in page.tsx)

### Typography
- Headings: `'Unbounded', sans-serif`, weight 700, letter-spacing `-0.01em` to `-0.02em`
- Body: Inter (default), `1.5`–`1.7` line height
- Labels: 0.7rem, uppercase, `letter-spacing: 0.1em`, color `#666666`–`#888888`
- Both fonts loaded from Google Fonts in `app/layout.tsx`

### Shapes
- Panels: `borderRadius: 20`
- Inputs/buttons: `borderRadius: 10–12`
- Pills: `rounded-full`
- Boxed info groups: `borderRadius: 12`, `border: 1px solid #1c1c1c`

### Motion
- Color/background transitions: `0.2s`
- The grading animation has bespoke keyframes in `AnalyzingView` — reuse
  those patterns if adding anything similar.

## Conventions to preserve

- **Single client component for the funnel** — don't split `page.tsx`
  into route segments unless you have a strong reason. State passing is
  already wired through props; breaking it apart would churn a lot.
- **Inline styles for visuals** — stay consistent with what's there. Don't
  Tailwind-ify existing inline styles just because. New UI can use either,
  but match the surrounding component.
- **API routes have explicit CORS headers** and `OPTIONS` handlers — keep
  that pattern if you add new routes.
- **Every lead submission sends `submissionId`** — add it to any new
  client-side form you wire up, so the server can dedupe.
- **UTMs are read from sessionStorage first, URL second** — copy the
  pattern from `handleUrlSubmit` or the strategy call `handleSubmit`.
- **Non-fatal local-file writes** — if you add anything that writes to
  `data/`, wrap it in try/catch. Vercel's FS is read-only.

## Known TODOs / loose ends

- [ ] Google Ads conversion **label** is not set — only the account ID.
      Update `send_to` in `app/thank-you/page.tsx` once the conversion
      action is created in Google Ads.
- [ ] `/api/capture` is dead code. Can be deleted when convenient.
- [ ] `lib/leads.ts` local JSON stub is vestigial — Sheets is the real
      store. Can be simplified or removed.
- [ ] No server-side error monitoring (Sentry, etc.) — currently relying
      on Vercel function logs.
- [ ] Meta `Lead` event isn't deduped across refreshes of `/thank-you` —
      low priority since real conversions come from the redirect, not
      bookmarks.

## How to continue development in chat mode

If you're starting a fresh Claude chat (not Claude Code) to work on this
project, paste the prompt below. It loads this file as context and tells
Claude what kind of response style to use for follow-up edits.

---

### 📋 Starter prompt for chat mode

```
I'm working on the SpeedX Revenue Activation Plan (RAP) — a Next.js 14 lead-gen
site at https://revenue-activation-plan.speedxmedia.com/. The repo is
github.com/maddy-sxm/rap and it auto-deploys to Vercel on push to main.

Below is the project brief (CLAUDE.md). Read it in full before answering anything.
It explains the architecture, data flow, design tokens, conventions, and gotchas
you need to know to make correct changes.

When I ask for a change:
1. Tell me which file(s) to edit and show me the exact diff (old → new)
   in a fenced code block I can paste into my editor.
2. If the change touches a convention listed in the brief (UTM handling,
   submissionId, inline styles, Sheets webhook, tracking pixels) — say so
   and show me you considered it. Don't silently break conventions.
3. Match the existing design tokens (colors, fonts, spacing, radii) — don't
   invent new ones.
4. If a request is ambiguous, ask ONE clarifying question before coding.
   Don't make assumptions about unclear requirements.
5. If my request would break something listed in "Known TODOs / loose ends"
   or the webhook routing, flag it before writing code.
6. Keep replies terse. Show diffs, not prose. No "here's what I did"
   summaries unless I ask.

After each change, remind me which sheet tabs / tracking pixels / routes
are affected so I know what to test.

--- BEGIN CLAUDE.md ---

[PASTE THE CONTENTS OF CLAUDE.md HERE]

--- END CLAUDE.md ---

My first task:
[describe what you want changed]
```

---

### How to use the prompt

1. Open a new chat on claude.ai (any Claude model — Opus or Sonnet).
2. Copy the prompt above.
3. Replace `[PASTE THE CONTENTS OF CLAUDE.md HERE]` with the full contents
   of this file (you can just copy-paste the whole markdown).
4. Replace `[describe what you want changed]` with your actual task.
5. Send. Claude will propose a diff; paste it into Cursor / VS Code, run
   locally to test, then commit and push.

Once you've iterated on the change and confirmed it works, commit with a
clear message (match the existing style in `git log`). Vercel auto-deploys.
