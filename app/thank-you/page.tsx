"use client";

import { useEffect } from "react";
import Link from "next/link";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

export default function ThankYouPage() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (typeof window.fbq === "function") {
      window.fbq("track", "Lead");
    }

    if (typeof window.gtag === "function") {
      window.gtag("event", "conversion", {
        send_to: "AW-17879019755",
      });
    }
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        background: "#0a0a0a",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(192,57,43,0.08), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 520,
          background: "#0e0e0e",
          border: "1px solid #242424",
          borderRadius: 20,
          padding: "48px 36px",
          textAlign: "center",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.03) inset, 0 40px 80px -20px rgba(0,0,0,0.6)",
        }}
      >
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
          style={{
            background: "#131313",
            border: "1px solid #222222",
            color: "#666666",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#10b981",
              display: "inline-block",
              boxShadow: "0 0 4px rgba(16,185,129,0.7)",
            }}
          />
          Request Received
        </div>

        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 28px",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M4.5 12.5l5 5L19.5 7"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1
          style={{
            color: "#efefef",
            fontFamily: "'Unbounded', sans-serif",
            fontSize: "1.6rem",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            marginBottom: 14,
          }}
        >
          Thank you —<br />
          your strategy call is queued.
        </h1>

        <p
          style={{
            color: "#888888",
            fontSize: "0.9rem",
            lineHeight: 1.7,
            marginBottom: 32,
            maxWidth: 380,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          The SpeedX team has your Revenue Activation Plan details and will be
          in touch within one business day to schedule your session.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            textAlign: "left",
            background: "#0a0a0a",
            border: "1px solid #1c1c1c",
            borderRadius: 12,
            padding: "18px 20px",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              fontSize: "0.7rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#666666",
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            What happens next
          </div>
          {[
            "We review your submitted site and the grading results.",
            "You'll get a calendar link within one business day.",
            "On the call we walk through your Revenue Activation Plan.",
          ].map((line, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                fontSize: "0.85rem",
                color: "#aaaaaa",
                lineHeight: 1.55,
              }}
            >
              <span style={{ color: "#c0392b", fontWeight: 700, flexShrink: 0 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{line}</span>
            </div>
          ))}
        </div>

        <Link
          href="/"
          style={{
            display: "inline-block",
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: 10,
            color: "#aaaaaa",
            fontSize: "0.8rem",
            padding: "11px 24px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            textDecoration: "none",
            transition: "color 0.2s, border-color 0.2s",
          }}
        >
          Back to SpeedX
        </Link>
      </div>
    </main>
  );
}
