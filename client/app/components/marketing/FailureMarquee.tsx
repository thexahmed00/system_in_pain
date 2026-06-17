"use client";

const FAILURES = [
  "DATABASE OVERLOAD", "CACHE MISS STORM", "QUEUE BACKLOG", "API TIMEOUT",
  "RATE LIMIT REACHED", "REGIONAL OUTAGE", "SERVER CRASH", "NETWORK LATENCY SPIKE",
  "REPLICATION LAG", "CONNECTION POOL EXHAUSTED",
];

/** Infinite ticker of failure modes. Duplicated track for a seamless loop. */
export function FailureMarquee() {
  const track = [...FAILURES, ...FAILURES];
  return (
    <div className="relative flex overflow-hidden border-y border-line bg-surface/60 py-3">
      <div className="flex shrink-0 animate-marquee">
        {track.map((f, i) => (
          <span key={i} className="flex items-center gap-3 whitespace-nowrap px-6 label-spec">
            <span className="size-1.5 rounded-full bg-bottleneck/70" />
            {f}
          </span>
        ))}
      </div>
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-paper to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-paper to-transparent" />
    </div>
  );
}
