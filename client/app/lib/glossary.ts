/** Plain-language definitions for jargon shown in the play UI — surfaced via InfoTip. */
export const GLOSSARY = {
  p95Latency:
    "95% of requests finish at or under this time. The slowest 5% (often overloaded instances) are allowed to be slower.",
  p99Latency:
    "99% of requests finish at or under this time — a stricter tail-latency bar than p95 that catches worst-case slowness.",
  availability:
    "The share of legitimate requests that succeeded, out of everything sent your way. 99% still means 1 in 100 users saw an error.",
  throughput:
    "How many requests per second your system actually completed — not requested, completed.",
  errorRate:
    "The share of requests that failed outright: timeouts, drops, or capacity overload.",
  cost:
    "What your architecture costs to run per hour, based on the instances and components you've wired up.",
  rps:
    "Requests per second — the rate of incoming traffic this level throws at your system.",
  readWrite:
    "What fraction of requests are reads (fetches) vs writes (updates) — this decides which components sit on the hot path.",
  botTraffic:
    "Malicious/automated requests mixed into normal traffic. They never get cache hits, and only count against you if they get through — a WAF or rate limiter can filter them out.",
  performance:
    "How fast requests are served under normal load — driven mainly by p99 latency.",
  reliability:
    "How consistently the system stays up and correct — under failures, spikes, or attacks.",
  scalability:
    "Whether the system holds up when traffic multiplies — tested by separate spike scenarios, not the steady-state run.",
  security:
    "Whether malicious traffic gets filtered out before it can degrade the system for real users.",
} as const;
