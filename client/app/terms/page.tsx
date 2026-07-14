import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — systemInPain",
  description: "The terms for using systemInPain.",
};

export default function TermsOfService() {
  return (
    <div className="relative min-h-screen bg-paper">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-blueprint opacity-[0.5]" />
      <div className="relative mx-auto max-w-2xl px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
          <ArrowLeft size={15} /> Back
        </Link>

        <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-ink">
          Terms of Service
        </h1>
        <p className="label-spec mt-2 !normal-case text-muted">Last updated July 14, 2026</p>

        <div className="legal-content mt-10 space-y-8 text-[15px] leading-relaxed text-ink-soft">
          <section>
            <h2>Agreement</h2>
            <p>
              By using systemInPain (&ldquo;we&rdquo;, &ldquo;us&rdquo;) at systeminpain.com, you agree
              to these terms. If you don&rsquo;t agree, please don&rsquo;t use the product.
            </p>
          </section>

          <section>
            <h2>What this is</h2>
            <p>
              systemInPain is an educational game for learning system design by building and
              simulating architectures. It&rsquo;s provided as-is, and levels, scoring, and content
              may change as we improve the product.
            </p>
          </section>

          <section>
            <h2>Accounts</h2>
            <p>
              Logging in (via Auth0) is required to progress past the first level, so we can save
              your progress across sessions. You&rsquo;re responsible for keeping your login secure.
              See our{" "}
              <Link href="/privacy" className="text-brand underline underline-offset-2">
                Privacy Policy
              </Link>{" "}
              for what account data we store and why.
            </p>
          </section>

          <section>
            <h2>Acceptable use</h2>
            <p>
              Don&rsquo;t attempt to disrupt, reverse-engineer for malicious purposes, or abuse the
              service (e.g. automated scraping, attacks on our infrastructure, or attempting to
              falsify scores through the verification API). We may suspend accounts that do.
            </p>
          </section>

          <section>
            <h2>No warranty</h2>
            <p>
              The product is provided &ldquo;as is&rdquo; without warranties of any kind. We don&rsquo;t
              guarantee it will be uninterrupted, error-free, or fit for a particular purpose beyond
              learning system design concepts.
            </p>
          </section>

          <section>
            <h2>Changes</h2>
            <p>
              We may update these terms as the product evolves. Material changes will update the
              date above; continued use means you accept the update.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              Questions? Email{" "}
              <a href="mailto:mustafa01.work@gmail.com" className="text-brand underline underline-offset-2">
                privacy@systeminpain.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
