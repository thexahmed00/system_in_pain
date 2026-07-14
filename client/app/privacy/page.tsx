import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — systemInPain",
  description: "How systemInPain collects, stores, and uses your data.",
};

export default function PrivacyPolicy() {
  return (
    <div className="relative min-h-screen bg-paper">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-blueprint opacity-[0.5]" />
      <div className="relative mx-auto max-w-2xl px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
          <ArrowLeft size={15} /> Back
        </Link>

        <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-ink">
          Privacy Policy
        </h1>
        <p className="label-spec mt-2 !normal-case text-muted">Last updated July 14, 2026</p>

        <div className="legal-content mt-10 space-y-8 text-[15px] leading-relaxed text-ink-soft">
          <section>
            <h2>What this covers</h2>
            <p>
              systemInPain (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a system-design learning game at{" "}
              <span className="text-ink">systeminpain.com</span>. This policy explains what data we
              collect when you use it, why, and how you can control it.
            </p>
          </section>

          <section>
            <h2>Data we collect</h2>
            <ul>
              <li>
                <strong className="text-ink">Account data (via Auth0).</strong> When you log in, our
                authentication provider Auth0 gives us your email address, display name, profile
                picture, and a stable user ID (&ldquo;sub&rdquo;). We store a copy of this in our
                database (via Supabase) so we can show your progress across sessions.
              </li>
              <li>
                <strong className="text-ink">Gameplay progress.</strong> Which levels you&rsquo;ve
                passed, your best scores, and stars earned. This is stored locally in your browser
                and, once you&rsquo;re logged in, associated with your account.
              </li>
              <li>
                <strong className="text-ink">Product analytics (via PostHog).</strong> If you accept
                analytics cookies, we record which pages and features you use (e.g. level starts,
                pass/fail events) and link them to your account ID so we can understand how the
                product is used and fix what&rsquo;s broken. This is off by default until you accept
                the cookie banner.
              </li>
              <li>
                <strong className="text-ink">Session cookie.</strong> A strictly necessary cookie
                that keeps you logged in. This is not analytics and is not affected by the cookie
                banner &mdash; it&rsquo;s required for the login feature to work at all.
              </li>
            </ul>
          </section>

          <section>
            <h2>Who processes it</h2>
            <ul>
              <li><strong className="text-ink">Auth0</strong> &mdash; authentication and session management.</li>
              <li><strong className="text-ink">Supabase</strong> &mdash; database storage for your profile and progress.</li>
              <li><strong className="text-ink">PostHog</strong> &mdash; product analytics, only after consent.</li>
              <li><strong className="text-ink">Vercel</strong> &mdash; hosting and infrastructure.</li>
            </ul>
            <p>
              We don&rsquo;t sell your data or share it with advertisers. It&rsquo;s used solely to
              run and improve the product.
            </p>
          </section>

          <section>
            <h2>Your rights</h2>
            <p>
              You can decline analytics cookies at any time from the cookie banner. To access,
              export, or delete the account data we hold about you, email us at{" "}
              <a href="mailto:mustafa01.work@gmail.com" className="text-brand underline underline-offset-2">
                mustafa01.work@gmail.com
              </a>{" "}
              and we&rsquo;ll act on it within 30 days. If you&rsquo;re in the EU/UK, this includes
              the rights to access, rectification, erasure, and data portability under GDPR.
            </p>
          </section>

          <section>
            <h2>Retention</h2>
            <p>
              Account and progress data is kept for as long as your account exists. Deleting your
              account (email us to request this) removes your profile row and gameplay history from
              our database.
            </p>
          </section>

          <section>
            <h2>Changes</h2>
            <p>
              If this policy changes materially, we&rsquo;ll update the date above. Continued use of
              the product after a change means you accept the update.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              Questions? Email{" "}
              <a href="mailto:mustafa01.work@gmail.com" className="text-brand underline underline-offset-2">
                mustafa01.work@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
