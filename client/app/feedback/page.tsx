"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Card, Button } from "@/app/components/ui";
import posthog from "posthog-js";

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-line-strong bg-paper px-3.5 py-2.5 text-[15px] text-ink " +
  "placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/40";

export default function FeedbackPage() {
  const { user } = useUser();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || status === "sending") return;

    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, name: name || undefined, email: email || undefined }),
      });
      if (!res.ok) throw new Error("request failed");
      posthog.capture("feedback_submitted");
      setStatus("sent");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="relative min-h-screen bg-paper">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-blueprint opacity-[0.5]" />
      <div className="relative mx-auto max-w-lg px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
          <ArrowLeft size={15} /> Back
        </Link>

        <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-ink">
          Send feedback
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Bug, confusing level, feature idea — it goes straight to the person building this.
        </p>

        <Card elevation="raised" className="mt-8">
          {status === "sent" ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 size={40} className="text-brand" />
              <p className="font-display text-lg font-bold text-ink">Thanks — got it.</p>
              <p className="text-sm text-ink-soft">We read every message.</p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={() => setStatus("idle")}>
                Send another
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-ink">
                  Your feedback
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's on your mind?"
                  className={inputClass}
                />
              </div>

              {!user && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink">
                      Name <span className="text-muted">(optional)</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
                      Email <span className="text-muted">(optional, for a reply)</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              {status === "error" && (
                <p className="text-sm text-bottleneck">
                  Something went wrong sending that — mind trying again?
                </p>
              )}

              <Button type="submit" variant="primary" className="w-full" disabled={status === "sending"}>
                <Send size={16} /> {status === "sending" ? "Sending…" : "Send feedback"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
