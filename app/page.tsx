"use client";

import { useState, FormEvent } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AppState = "landing" | "analyzing" | "gate" | "results";

interface GradeReport {
  overall_grade: string;
  category_grades: {
    website_conversion: string;
    search_visibility: string;
    paid_traffic_readiness: string;
    lead_capture: string;
  };
  headline: string;
  top_insights: Array<{ category: string; text: string }>;
  revenue_opportunity: string;
  cta_title: string;
  cta_body: string;
  analyzed_url?: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const GRADE_STYLE: Record<string, { color: string; bg: string; border: string; glow: string; label: string }> = {
  A: { color: "#10b981", bg: "rgba(16,185,129,0.07)",  border: "rgba(16,185,129,0.18)",  glow: "glow-a", label: "Strong" },
  B: { color: "#38bdf8", bg: "rgba(56,189,248,0.07)",  border: "rgba(56,189,248,0.18)",  glow: "glow-b", label: "Solid" },
  C: { color: "#f59e0b", bg: "rgba(245,158,11,0.07)",  border: "rgba(245,158,11,0.18)",  glow: "glow-c", label: "Gaps Present" },
  D: { color: "#f97316", bg: "rgba(249,115,22,0.07)",  border: "rgba(249,115,22,0.18)",  glow: "glow-d", label: "Underperforming" },
  F: { color: "#ef4444", bg: "rgba(239,68,68,0.07)",   border: "rgba(239,68,68,0.18)",   glow: "glow-f", label: "Critical" },
};

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode }> = {
  website_conversion: {
    label: "Website Conversion",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 3h12v2L8 10 2 5V3ZM2 7l6 4.5L14 7v6H2V7Z" fill="currentColor" opacity=".85" />
      </svg>
    ),
  },
  search_visibility: {
    label: "Search Visibility",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M6.5 1a5.5 5.5 0 1 0 3.536 9.574l3.196 3.195a.75.75 0 1 0 1.06-1.06L11.096 9.51A5.5 5.5 0 0 0 6.5 1Zm-4 5.5a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" fill="currentColor" />
      </svg>
    ),
  },
  paid_traffic_readiness: {
    label: "Paid Traffic Readiness",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 8h2l2-5 3 10 2-6.5L13 8h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  lead_capture: {
    label: "Lead Capture",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
};

const REVENUE_META: Record<string, { label: string; dotClass: string; description: string; textColor: string }> = {
  Low:      { label: "Low",      dotClass: "revenue-dot-low",  description: "Most available revenue opportunity appears to be captured. Incremental gains remain.", textColor: "#10b981" },
  Moderate: { label: "Moderate", dotClass: "revenue-dot-mod",  description: "Revenue is being missed across key channels. Strategic gaps are identifiable and addressable.", textColor: "#f59e0b" },
  High:     { label: "High",     dotClass: "revenue-dot-high", description: "Meaningful revenue is actively being lost. The gap between potential and performance is significant.", textColor: "#ef4444" },
};

const SCAN_STEPS = [
  "Fetching Website Structure",
  "Parsing Conversion Signals",
  "Reviewing Search Visibility Indicators",
  "Evaluating Paid Traffic Readiness",
  "Checking Lead Capture Pathways",
  "Scoring Revenue Opportunity",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}

// ─── SpeedX Logo ──────────────────────────────────────────────────────────────

function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  const s = size === "sm"
    ? { box: 22, icon: 12, textClass: "text-base" }
    : { box: 28, icon: 15, textClass: "text-lg" };
  return (
    <div className="flex items-center gap-2.5">
      <div
        style={{
          width: s.box, height: s.box,
          background: "#111111",
          border: "1px solid #2a2a2a",
          borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width={s.icon} height={s.icon} viewBox="0 0 18 18" fill="none">
          <path d="M3 9L7.5 4.5L12 9L9 9L9 13.5L6 13.5L6 9L3 9Z" fill="#efefef" />
          <path d="M9 9L13.5 4.5L15 6L11 9L15 9L15 13.5L12 13.5L12 9L9 9Z" fill="#efefef" opacity=".45" />
        </svg>
      </div>
      <span
        className={`font-bold tracking-tight ${s.textClass}`}
        style={{ color: "#efefef", fontFamily: "'Unbounded', sans-serif", letterSpacing: "-0.02em" }}
      >
        Speed<span style={{ color: "#888888" }}>X</span>
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [appState, setAppState] = useState<AppState>("landing");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [report, setReport] = useState<GradeReport | null>(null);
  const [urlError, setUrlError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [scanStep, setScanStep] = useState(0);
  const [submittingEmail, setSubmittingEmail] = useState(false);

  async function handleUrlSubmit(e: FormEvent) {
    e.preventDefault();
    setUrlError("");
    const trimmed = url.trim();
    if (!trimmed) { setUrlError("Please enter a website URL."); return; }

    setAppState("analyzing");
    setScanStep(0);

    // Start API fetch immediately — runs in parallel with the animation
    const apiFetch = fetch("/api/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
    });

    // Step animation: advance every 1200ms, hold 900ms after the last step
    const STEP_MS = 1200;
    const animationDone = new Promise<void>((resolve) => {
      let step = 0;
      function advance() {
        step++;
        if (step < SCAN_STEPS.length) {
          setScanStep(step);
        }
        if (step < SCAN_STEPS.length - 1) {
          setTimeout(advance, STEP_MS);
        } else {
          setScanStep(SCAN_STEPS.length - 1);
          setTimeout(resolve, 900);
        }
      }
      setTimeout(advance, STEP_MS);
    });

    try {
      // Wait for BOTH the API call and the full animation to complete
      const [res] = await Promise.all([apiFetch, animationDone]);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to analyze website.");
      }

      const data: GradeReport = await res.json();
      setReport(data);
      await new Promise((r) => setTimeout(r, 300));
      setAppState("gate");
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setAppState("landing");
    }
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setEmailError("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      setEmailError("Please enter a valid business email address.");
      return;
    }

    setSubmittingEmail(true);
    fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmedEmail, url, report }),
    }).catch(() => {});

    await new Promise((r) => setTimeout(r, 300));
    setSubmittingEmail(false);
    setAppState("results");
  }

  function reset() {
    setAppState("landing");
    setUrl("");
    setEmail("");
    setReport(null);
    setUrlError("");
    setEmailError("");
    setScanStep(0);
  }

  if (appState === "analyzing") {
    return <AnalyzingView url={url} scanStep={scanStep} />;
  }

  if (appState === "gate" && report) {
    return (
      <GateView
        report={report}
        url={url}
        email={email}
        setEmail={setEmail}
        emailError={emailError}
        submitting={submittingEmail}
        onSubmit={handleEmailSubmit}
      />
    );
  }

  if (appState === "results" && report) {
    return <ResultsView report={report} url={url} onReset={reset} />;
  }

  return <LandingView url={url} setUrl={setUrl} error={urlError} onSubmit={handleUrlSubmit} />;
}

// ─── Landing View ─────────────────────────────────────────────────────────────

function LandingView({
  url, setUrl, error, onSubmit,
}: {
  url: string;
  setUrl: (v: string) => void;
  error: string;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080808" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid #161616" }} className="px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Logo />
          <a
            href="mailto:hello@speedxmedia.com"
            className="text-sm transition-colors"
            style={{ color: "#3a3a3a" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#888888"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#3a3a3a"; }}
          >
            hello@speedxmedia.com
          </a>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-28">
        <div className="max-w-2xl w-full mx-auto text-center">

          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium mb-10"
            style={{ background: "#0e0e0e", border: "1px solid #1c1c1c", color: "#555555", letterSpacing: "0.13em", textTransform: "uppercase" }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#c0392b", boxShadow: "0 0 5px rgba(192,57,43,0.7)" }} />
            Website Revenue Score
          </div>

          {/* Headline */}
          <h1
            className="font-bold leading-tight mb-6"
            style={{ fontSize: "clamp(1.9rem, 4.8vw, 3.25rem)", color: "#efefef", fontFamily: "'Unbounded', sans-serif", letterSpacing: "-0.03em" }}
          >
            Find out how much revenue
            <br />
            <span className="gradient-text">your website is leaving behind.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg leading-relaxed mb-12 max-w-lg mx-auto" style={{ color: "#5a5a5a" }}>
            Enter your URL. We score it against the signals that determine whether
            visitors convert, search traffic compounds, and paid ads actually work.
          </p>

          {/* Form */}
          <form onSubmit={onSubmit} className="w-full max-w-xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#303030" }}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <path d="M6.5 1a5.5 5.5 0 1 0 3.536 9.574l3.196 3.195a.75.75 0 1 0 1.06-1.06L11.096 9.51A5.5 5.5 0 0 0 6.5 1Zm-4 5.5a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" fill="currentColor" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="yourdomain.com"
                  className="w-full input-focus rounded-xl pl-10 pr-4 py-4 text-base transition-all"
                  style={{ background: "#0e0e0e", border: "1px solid #1c1c1c", color: "#efefef" }}
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
              <button
                type="submit"
                className="rounded-xl font-semibold px-7 py-4 transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-2 text-sm"
                style={{ background: "#c0392b", color: "#fff", minWidth: 180, letterSpacing: "0.07em", textTransform: "uppercase" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#a93226")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#c0392b")}
              >
                Score My Website
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 text-sm rounded-lg px-4 py-3" style={{ color: "#f87171", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1a5.5 5.5 0 1 0 0 11A5.5 5.5 0 0 0 6.5 1Zm0 8.25a.625.625 0 1 1 0-1.25.625.625 0 0 1 0 1.25ZM6.5 3v3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                {error}
              </div>
            )}
          </form>

          <p className="mt-5 text-xs" style={{ color: "#2e2e2e" }}>
            30-second diagnostic &nbsp;&bull;&nbsp; No account required &nbsp;&bull;&nbsp; Used by growth teams
          </p>
        </div>

        {/* Category preview */}
        <div className="mt-20 max-w-3xl w-full mx-auto px-4">
          <p className="text-center text-xs font-medium uppercase mb-8" style={{ color: "#2e2e2e", letterSpacing: "0.14em" }}>
            What Gets Scored
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(CATEGORY_META).map(([key, meta]) => (
              <div
                key={key}
                className="rounded-xl p-4 text-center card-hover"
                style={{ background: "#0e0e0e", border: "1px solid #1c1c1c" }}
              >
                <div className="flex justify-center mb-2" style={{ color: "#484848" }}>
                  {meta.icon}
                </div>
                <p className="text-xs font-medium" style={{ color: "#484848" }}>{meta.label}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ─── Analyzing View ───────────────────────────────────────────────────────────

function AnalyzingView({ url, scanStep }: { url: string; scanStep: number }) {
  const domain = extractDomain(url);
  const progress = Math.round(((scanStep + 1) / SCAN_STEPS.length) * 94);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#080808" }}>
      <div className="max-w-sm w-full text-center">

        {/* Pulse ring */}
        <div className="relative inline-flex items-center justify-center mb-10">
          <div
            className="absolute w-24 h-24 rounded-full scan-pulse"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          />
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "#111111", border: "1px solid #222222" }}
          >
            <svg width="26" height="26" viewBox="0 0 18 18" fill="none">
              <path d="M3 9L7.5 4.5L12 9L9 9L9 13.5L6 13.5L6 9L3 9Z" fill="#efefef" />
              <path d="M9 9L13.5 4.5L15 6L11 9L15 9L15 13.5L12 13.5L12 9L9 9Z" fill="#efefef" opacity=".4" />
            </svg>
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-1.5" style={{ color: "#efefef", fontFamily: "'Unbounded', sans-serif", fontSize: "1rem", letterSpacing: "-0.01em" }}>
          Analyzing your website
        </h2>
        <p className="text-sm mb-8" style={{ color: "#3a3a3a" }}>
          {domain}
        </p>

        {/* Progress bar */}
        <div className="w-full rounded-full overflow-hidden mb-8" style={{ background: "#181818", height: 2 }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #555555, #888888)",
              transition: "width 0.9s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>

        {/* Scan steps */}
        <div className="space-y-1.5 text-left">
          {SCAN_STEPS.map((step, i) => {
            const isDone = i < scanStep;
            const isCurrent = i === scanStep;
            return (
              <div
                key={step}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-500 step-appear"
                style={{
                  opacity: isDone || isCurrent ? 1 : 0.2,
                  background: isCurrent ? "rgba(255,255,255,0.025)" : "transparent",
                  border: isCurrent ? "1px solid rgba(255,255,255,0.05)" : "1px solid transparent",
                  color: isDone ? "#383838" : isCurrent ? "#c8c8c8" : "#2e2e2e",
                  animationDelay: `${i * 0.04}s`,
                }}
              >
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M2.5 7L5.5 10 11.5 4" stroke="#484848" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isCurrent ? (
                  <svg className="spinner" width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="7" cy="7" r="5" stroke="#333333" strokeWidth="1.5" />
                    <path d="M7 2A5 5 0 0 1 12 7" stroke="#888888" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: "#1c1c1c" }} />
                )}
                <span style={{ fontSize: "0.8125rem" }}>{step}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Gate View (email capture) ────────────────────────────────────────────────

function GateView({
  report, url, email, setEmail, emailError, submitting, onSubmit,
}: {
  report: GradeReport;
  url: string;
  email: string;
  setEmail: (v: string) => void;
  emailError: string;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
}) {
  const domain = extractDomain(url);
  const g = GRADE_STYLE[report.overall_grade] ?? GRADE_STYLE["C"];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden" style={{ background: "#080808" }}>

      {/* Blurred results preview in background */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ filter: "blur(24px)", opacity: 0.12, transform: "scale(1.08)" }}
        aria-hidden="true"
      >
        <div className="max-w-md w-full px-8">
          <div className="flex justify-center mb-8">
            <div
              style={{
                width: 110, height: 110, borderRadius: "50%",
                border: `2px solid ${g.color}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 52, fontWeight: 800, color: g.color,
                background: g.bg,
              }}
            >
              {report.overall_grade}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(report.category_grades).map(([key, grade]) => {
              const gs = GRADE_STYLE[grade] ?? GRADE_STYLE["C"];
              return (
                <div key={key} style={{ background: "#0e0e0e", border: "1px solid #1c1c1c", borderRadius: 12, padding: "14px 16px" }}>
                  <div className="text-xs mb-1" style={{ color: "#3a3a3a" }}>{CATEGORY_META[key]?.label}</div>
                  <div className="text-2xl font-bold" style={{ color: gs.color }}>{grade}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gate card */}
      <div
        className="relative z-10 w-full max-w-md animate-fade-in-up"
        style={{
          background: "rgba(10,10,10,0.97)",
          border: "1px solid #1c1c1c",
          borderRadius: 20,
          padding: "40px 36px",
          backdropFilter: "blur(16px)",
          boxShadow: "0 0 80px rgba(0,0,0,0.7)",
        }}
      >
        {/* Lock icon */}
        <div className="flex justify-center mb-6">
          <div
            style={{ width: 48, height: 48, borderRadius: 12, background: "#111111", border: "1px solid #1c1c1c", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
              <rect x="4" y="10" width="14" height="10" rx="2.5" stroke="#555555" strokeWidth="1.5" />
              <path d="M7 10V7a4 4 0 0 1 8 0v3" stroke="#555555" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="11" cy="15" r="1.25" fill="#555555" />
            </svg>
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-bold mb-2.5" style={{ color: "#efefef", fontFamily: "'Unbounded', sans-serif", fontSize: "1.125rem", letterSpacing: "-0.02em" }}>
            Your Revenue Score is ready.
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "#5a5a5a" }}>
            We've completed a diagnostic of <span style={{ color: "#888888", fontWeight: 500 }}>{domain}</span>.
            Enter your work email to unlock your score and strategic insights.
          </p>
        </div>

        {/* Hint badges */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: "#111111", border: "1px solid #1c1c1c", color: "#484848" }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: g.color }} />
            <span style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>Overall Grade: Hidden</span>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: "#111111", border: "1px solid #1c1c1c", color: "#484848" }}
          >
            4 Categories
          </div>
        </div>

        {/* Email form */}
        <form onSubmit={onSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full input-focus-blue rounded-xl px-4 py-3.5 text-sm mb-3 transition-all"
            style={{ background: "#111111", border: "1px solid #1c1c1c", color: "#efefef" }}
            autoFocus
            autoComplete="email"
          />

          {emailError && (
            <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ color: "#f87171", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.1)" }}>
              {emailError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl font-semibold py-3.5 text-sm transition-all duration-200 flex items-center justify-center gap-2"
            style={{ background: "#c0392b", color: "#fff", opacity: submitting ? 0.65 : 1, letterSpacing: "0.07em", textTransform: "uppercase" }}
            onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = "#a93226"; }}
            onMouseLeave={(e) => { if (!submitting) e.currentTarget.style.background = "#c0392b"; }}
          >
            {submitting ? (
              <>
                <svg className="spinner" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".2" />
                  <path d="M7 2A5 5 0 0 1 12 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Unlocking...
              </>
            ) : (
              <>
                Reveal My Score
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-xs" style={{ color: "#2e2e2e" }}>
          Used to deliver your score. SpeedX may send relevant strategic follow-up.
        </p>
      </div>
    </div>
  );
}

// ─── Results View ─────────────────────────────────────────────────────────────

function ResultsView({ report, url, onReset }: { report: GradeReport; url: string; onReset: () => void }) {
  const domain = extractDomain(url);
  const overall = GRADE_STYLE[report.overall_grade] ?? GRADE_STYLE["C"];
  const rev = REVENUE_META[report.revenue_opportunity] ?? REVENUE_META["Moderate"];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#080808" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid #161616" }} className="px-6 py-4 sticky top-0 z-10">
        <div style={{ backdropFilter: "blur(12px)", background: "rgba(8,8,8,0.88)", position: "absolute", inset: 0 }} />
        <div className="max-w-3xl mx-auto flex items-center justify-between relative z-10">
          <Logo />
          <button
            onClick={onReset}
            className="text-sm flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
            style={{ color: "#484848", border: "1px solid #1c1c1c", background: "transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#888888"; e.currentTarget.style.borderColor = "#2a2a2a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#484848"; e.currentTarget.style.borderColor = "#1c1c1c"; }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 2L2 6.5 6.5 11M2 6.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>New Analysis</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-10 sm:py-16">
        <div className="max-w-2xl mx-auto">

          {/* ── Overall Grade ── */}
          <div className="text-center mb-12 animate-fade-in-up">
            <p className="text-xs font-medium uppercase mb-6" style={{ color: "#2e2e2e", letterSpacing: "0.14em" }}>
              Website Revenue Score
            </p>

            <div className="inline-flex items-center justify-center mb-6">
              <div
                className={`grade-reveal ${overall.glow}`}
                style={{
                  width: 130, height: 130, borderRadius: "50%",
                  border: `1.5px solid ${overall.color}`,
                  background: overall.bg,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: overall.color, fontFamily: "'Unbounded', sans-serif" }}>
                  {report.overall_grade}
                </span>
                <span className="text-xs font-medium" style={{ color: overall.color, opacity: 0.6, marginTop: 3, letterSpacing: "0.06em" }}>
                  {overall.label}
                </span>
              </div>
            </div>

            <p className="text-sm mb-3" style={{ color: "#3a3a3a" }}>{domain}</p>
            <p className="text-base leading-relaxed max-w-lg mx-auto" style={{ color: "#7a7a7a" }}>
              {report.headline}
            </p>
          </div>

          {/* ── Category Grades ── */}
          <div className="mb-10 animate-fade-in-up animation-delay-200">
            <p className="text-xs font-medium uppercase mb-5" style={{ color: "#2e2e2e", letterSpacing: "0.14em" }}>
              Category Breakdown
            </p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(report.category_grades).map(([key, grade], i) => {
                const gs = GRADE_STYLE[grade] ?? GRADE_STYLE["C"];
                const meta = CATEGORY_META[key];
                const hasInsight = report.top_insights.some((ins) => ins.category === key);
                const cardContent = (
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div style={{ color: gs.color, opacity: 0.6 }}>{meta?.icon}</div>
                        <span className="text-xs font-medium" style={{ color: "#484848" }}>
                          {meta?.label}
                        </span>
                      </div>
                      {hasInsight && (
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ color: "#2e2e2e", flexShrink: 0, marginTop: 1 }}>
                          <path d="M6 1v10M6 11l-3-3M6 11l3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div
                          className="text-5xl font-bold leading-none"
                          style={{ color: gs.color, fontFamily: "'Unbounded', sans-serif" }}
                        >
                          {grade}
                        </div>
                        <div className="text-xs mt-1.5" style={{ color: "#3a3a3a", letterSpacing: "0.04em" }}>
                          {gs.label}
                        </div>
                      </div>
                      <div className="flex flex-col-reverse gap-1">
                        {["F", "D", "C", "B", "A"].map((g) => (
                          <div key={g} className="w-1.5 rounded-sm" style={{ height: 5, background: g === grade ? gs.color : "#1c1c1c", opacity: g === grade ? 1 : 0.6 }} />
                        ))}
                      </div>
                    </div>
                  </>
                );

                const sharedStyle: React.CSSProperties = {
                  background: "#0e0e0e",
                  border: `1px solid ${gs.border}`,
                  display: "block",
                  textDecoration: "none",
                };

                return hasInsight ? (
                  <a
                    key={key}
                    href={`#insight-${key}`}
                    className={`rounded-2xl p-5 card-hover animate-fade-in-up animation-delay-${(i + 2) * 100}`}
                    style={{ ...sharedStyle, cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#303030"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = gs.border; }}
                  >
                    {cardContent}
                  </a>
                ) : (
                  <div
                    key={key}
                    className={`rounded-2xl p-5 card-hover animate-fade-in-up animation-delay-${(i + 2) * 100}`}
                    style={sharedStyle}
                  >
                    {cardContent}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Strategic Insights ── */}
          <div className="mb-10 animate-fade-in-up animation-delay-400">
            <p className="text-xs font-medium uppercase mb-5" style={{ color: "#2e2e2e", letterSpacing: "0.14em" }}>
              What the Score Reveals
            </p>
            <div className="space-y-3">
              {report.top_insights.map((insight, i) => {
                const meta = insight.category !== "general" ? CATEGORY_META[insight.category] : null;
                return (
                  <div
                    key={i}
                    id={insight.category !== "general" ? `insight-${insight.category}` : undefined}
                    className="insight-card px-5 py-4 rounded-xl"
                    style={{ background: "#0e0e0e", border: "1px solid #1c1c1c", borderLeft: "2px solid #1c1c1c", scrollMarginTop: "80px" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderLeftColor = "#3a3a3a"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderLeftColor = "#1c1c1c"; }}
                  >
                    {meta && (
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <span style={{ color: "#3a3a3a" }}>{meta.icon}</span>
                        <span className="text-xs font-medium uppercase" style={{ color: "#3a3a3a", letterSpacing: "0.1em" }}>
                          {meta.label}
                        </span>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed" style={{ color: "#7a7a7a" }}>
                      {insight.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Revenue Opportunity ── */}
          <div className="mb-12 animate-fade-in-up animation-delay-500">
            <p className="text-xs font-medium uppercase mb-5" style={{ color: "#2e2e2e", letterSpacing: "0.14em" }}>
              Revenue Opportunity Signal
            </p>
            <div
              className="rounded-2xl px-6 py-5 flex items-center gap-5"
              style={{ background: "#0e0e0e", border: "1px solid #1c1c1c" }}
            >
              <div className="flex items-center gap-2 flex-shrink-0">
                {["Low", "Moderate", "High"].map((level) => (
                  <div
                    key={level}
                    className="w-3 h-3 rounded-full transition-all duration-300"
                    style={{
                      background: level === report.revenue_opportunity
                        ? (REVENUE_META[level]?.textColor ?? "#888888")
                        : "#1c1c1c",
                      boxShadow: level === report.revenue_opportunity
                        ? `0 0 8px ${REVENUE_META[level]?.textColor ?? "#888888"}70`
                        : "none",
                      transform: level === report.revenue_opportunity ? "scale(1.3)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-semibold" style={{ color: rev.textColor }}>
                    {rev.label} Opportunity
                  </span>
                </div>
                <p className="text-sm" style={{ color: "#5a5a5a" }}>{rev.description}</p>
              </div>
            </div>
          </div>

          {/* ── CTA ── */}
          <div
            className="rounded-2xl p-8 text-center animate-fade-in-up animation-delay-600"
            style={{ background: "#0e0e0e", border: "1px solid #1c1c1c", position: "relative", overflow: "hidden" }}
          >
            {/* Subtle top edge highlight */}
            <div
              style={{
                position: "absolute", top: 0, left: "20%", right: "20%", height: 1,
                background: "linear-gradient(90deg, transparent, #2a2a2a, transparent)",
                pointerEvents: "none",
              }}
            />

            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium mb-5"
              style={{ background: "#131313", border: "1px solid #222222", color: "#555555", letterSpacing: "0.1em", textTransform: "uppercase" }}
            >
              <svg width="9" height="9" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 1L6.8 4.2H10.3L7.5 6.3 8.5 9.7 5.5 7.8 2.5 9.7 3.5 6.3.7 4.2H4.2Z" fill="currentColor" />
              </svg>
              Full Revenue Activation Plan
            </div>

            <h3
              className="text-2xl font-bold mb-3"
              style={{ color: "#efefef", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "'Unbounded', sans-serif", fontSize: "1.125rem" }}
            >
              {report.cta_title}
            </h3>
            <p className="text-sm leading-relaxed mb-7 max-w-sm mx-auto" style={{ color: "#5a5a5a" }}>
              {report.cta_body}
            </p>

            <a
              href="mailto:hello@speedxmedia.com?subject=Revenue%20Activation%20Plan%20Request"
              className="inline-flex items-center gap-2 rounded-xl font-semibold px-8 py-4 text-sm transition-all duration-200"
              style={{ background: "#c0392b", color: "#fff", letterSpacing: "0.07em", textTransform: "uppercase" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#a93226"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#c0392b"; }}
            >
              Request a Strategy Call
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>

            <p className="mt-4 text-xs" style={{ color: "#2e2e2e" }}>
              No obligation &nbsp;&bull;&nbsp; Strategy-first conversation
            </p>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="px-6 py-8" style={{ borderTop: "1px solid #161616" }}>
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Logo size="sm" />
        <p className="text-xs text-center" style={{ color: "#282828" }}>
          &copy; {new Date().getFullYear()} SpeedX Media. Results are diagnostic estimates based on publicly accessible page data.
        </p>
        <a
          href="mailto:hello@speedxmedia.com"
          className="text-xs transition-colors"
          style={{ color: "#2e2e2e" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#888888"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#2e2e2e"; }}
        >
          hello@speedxmedia.com
        </a>
      </div>
    </footer>
  );
}
