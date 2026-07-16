import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BOLT_PATH =
  "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z";

// No remote font fetch here on purpose — this endpoint is hit by external
// crawlers (Twitter/Slack/PH bots) on every share, and we already hit a
// transient Google Fonts fetch failure during a plain `next build` earlier
// this session. System-ui renders reliably with zero network dependency.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#355cff",
          backgroundImage:
            "radial-gradient(circle at 78% 15%, rgba(255,255,255,0.16) 0%, transparent 45%), radial-gradient(circle at 8% 92%, rgba(0,0,0,0.18) 0%, transparent 40%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              width: 56,
              height: 56,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 14,
              background: "rgba(255,255,255,0.16)",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
              <path d={BOLT_PATH} />
            </svg>
          </div>
          <span style={{ fontSize: 28, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: -0.5 }}>
            systeminpain.com
          </span>
        </div>

        <div style={{ display: "flex", marginTop: 56, fontSize: 108, fontWeight: 800, color: "white", letterSpacing: -3, lineHeight: 1 }}>
          Is system<span style={{ color: "#ffd166" }}>&nbsp;In&nbsp;</span>Pain
        </div>

        <div style={{ display: "flex", marginTop: 28, fontSize: 34, fontWeight: 500, color: "rgba(255,255,255,0.88)", maxWidth: 980 }}>
          Build it. Break it. Watch it fail — in real time.
        </div>
      </div>
    ),
    { ...size },
  );
}
