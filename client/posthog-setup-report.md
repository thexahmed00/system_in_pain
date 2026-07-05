# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the System Design Quest client. A `posthog-js` client-side SDK is initialised via `instrumentation-client.ts` (the correct approach for Next.js 15.3+) and proxied through `/ingest/*` rewrites so ad-blockers do not interfere. A `posthog-node` server-side client (`app/lib/posthog-server.ts`) captures the score-verification API route. Twelve events are tracked across five files covering the full player journey — from landing-page CTAs through canvas building, simulation execution, and level completion.

| Event | Description | File |
|---|---|---|
| `play_cta_clicked` | User clicks the 'Start playing' or 'Open canvas' CTA on the landing page | `app/page.tsx` |
| `hero_scenario_changed` | User switches the traffic scenario in the interactive StressTestHero diagram | `app/components/marketing/StressTestHero.tsx` |
| `simulation_run` | User clicks 'Run simulation' to execute the engine against their current architecture | `app/play/page.tsx` |
| `simulation_completed` | A simulation finishes and returns a result, capturing pass/fail, score, and key metrics | `app/play/page.tsx` |
| `level_completed` | User passes a level (simulation result is ok and passed), triggering the success modal | `app/play/page.tsx` |
| `component_added` | User drags a component from the palette and drops it onto the canvas | `app/play/page.tsx` |
| `node_deleted` | User deletes a selected node from the canvas | `app/play/page.tsx` |
| `canvas_reset` | User resets the canvas to the level's starter graph (or empty) | `app/play/page.tsx` |
| `level_changed` | User navigates to a different level using the prev/next level arrows | `app/play/page.tsx` |
| `level_next_clicked` | User clicks 'Next problem' in the success modal to advance to the next level | `app/components/play/SuccessModal.tsx` |
| `level_replay_clicked` | User clicks 'Replay' in the success modal to improve their score | `app/components/play/SuccessModal.tsx` |
| `simulation_verified` | Server-side API re-runs the simulation engine to verify a submitted architecture result | `app/api/simulate/route.ts` |

## Next steps

Five insights and a dashboard have been created to monitor player behaviour:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/498478/dashboard/1800936)
- [Landing → Play conversion funnel (wizard)](https://us.posthog.com/project/498478/insights/XhAt28X7)
- [Simulations run over time (wizard)](https://us.posthog.com/project/498478/insights/8aJxOQcA)
- [Level pass rate (wizard)](https://us.posthog.com/project/498478/insights/sSmHntjE)
- [Most-used components (wizard)](https://us.posthog.com/project/498478/insights/yvnMXxp7)
- [Level progression (wizard)](https://us.posthog.com/project/498478/insights/BI0E000A)

## Verify before merging

- [ ] Run a full production build (`npm run build -w client`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any monorepo bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
