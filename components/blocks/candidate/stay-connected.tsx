'use client';
import * as React from "react";
import type { StayConnected } from "@/lib/blocks/candidate/schemas";

export function CandidateStayConnectedBlock({ content }: { content: StayConnected }) {
  const [email, setEmail] = React.useState("");
  const [zip, setZip] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const zipOk = !content.showZip || /^\d{5}(-\d{4})?$/.test(zip);
    if (!emailOk) return setError("Please enter a valid email.");
    if (!zipOk) return setError("Please enter a valid ZIP code.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, zip, candidate_slug: content.candidateSlug }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Bad response");
      setSubmitted(true);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <h2 className="text-2xl font-bold md:text-3xl text-center">{content.headline}</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-gray-700 dark:text-gray-300">
        Join the mailing list for updates on upcoming events, campaign news, and volunteer opportunities.
      </p>

      {submitted ? (
        <div role="status" aria-live="polite"
          className="mx-auto mt-8 max-w-xl rounded-2xl border border-green-600/30 bg-green-50 p-6 text-center text-sm text-green-800 dark:border-green-600/40 dark:bg-green-900/20 dark:text-green-200">
          <div className="mx-auto mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white">✓</div>
          <div className="font-semibold">You're on the list!</div>
          <p className="mt-1 text-xs opacity-90">
            Thanks for subscribing. We'll send updates about events and ways to get involved{content.showZip && zip ? ` (${zip})` : ""}.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 md:flex-row">
          <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Your email address"
                 className="w-full flex-1 rounded-xl border px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" aria-label="Email address" disabled={submitting}/>
          {content.showZip && (
            <input type="text" value={zip} onChange={(e)=>setZip(e.target.value)} placeholder="ZIP code"
                   className="w-full flex-1 rounded-xl border px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" aria-label="ZIP code" disabled={submitting}/>
          )}
          <button type="submit" disabled={submitting}
                  className="w-full rounded-xl bg-indigo-600 px-6 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 md:w-auto">
            {submitting ? "Subscribing…" : "Subscribe"}
          </button>
          {error && <div className="w-full text-center text-xs text-red-600 md:w-auto" role="alert" aria-live="assertive">{error}</div>}
        </form>
      )}
      <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
        Your information will only be used for campaign updates. Unsubscribe anytime.
      </p>
    </section>
  );
}
